"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { accountEditScope } from "@/lib/permissions";
import { consumeSharedRateLimit } from "@/lib/domain/rate-limit-store";
import { planningSchema, readPlanning, type RoutePlanning, type SavedPlanning } from "@/lib/domain/route-planning";
import { calculateRoadPlan } from "@/lib/maps/planning-roads";
import { geocodeAddress } from "@/lib/maps/tomtom";

async function authorizedPlan(value: unknown) {
  const user = await getCurrentUser();
  const parsed = planningSchema.safeParse(value);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Review the route fields.");
  const plan = parsed.data;
  const ids = [...new Set([plan.start, ...plan.stops, ...(plan.end ? [plan.end] : [])].flatMap(p => p.accountId ? [p.accountId] : []))];
  const accounts = await prisma.account.findMany({ where: { ...accountEditScope(user), id: { in: ids }, status: "ACTIVE" }, select: { id: true, name: true, latitude: true, longitude: true, street: true, city: true, state: true, zip: true } });
  if (accounts.length !== ids.length) throw new Error("Some offices are no longer available or assigned to you.");
  for (const p of [plan.start, ...plan.stops, ...(plan.end ? [plan.end] : [])]) {
    if (!p.accountId) continue;
    const a = accounts.find(a => a.id === p.accountId)!;
    if (a.latitude == null || a.longitude == null) throw new Error(a.name + " needs map coordinates before routing.");
    Object.assign(p, { name: a.name, lat: a.latitude, lng: a.longitude, address: [a.street,a.city,a.state,a.zip].join(", ") });
  }
  const start = new Date(plan.departure), finish = new Date(plan.workEnd);
  const [lunches, meetings] = await Promise.all([
    prisma.lunchBooking.findMany({ where: { organizationId: user.organizationId, representativeId: user.id, accountId: { in: ids }, status: { notIn: ["CANCELED","COMPLETED"] }, slotStartsAt: { gte: start, lte: finish } }, select: { accountId:true, slotStartsAt:true,slotEndsAt:true } }),
    prisma.meeting.findMany({ where: { organizationId: user.organizationId, userId:user.id, accountId:{in:ids}, status:"CONFIRMED", startsAt:{gte:start,lte:finish} }, select:{accountId:true,startsAt:true,endsAt:true} }),
  ]);
  for (const stop of plan.stops) {
    const appointments = [...lunches.filter(x => x.accountId === stop.accountId).map(x => ({start:x.slotStartsAt,end:x.slotEndsAt})), ...meetings.filter(x => x.accountId === stop.accountId).map(x => ({start:x.startsAt,end:x.endsAt}))];
    if (appointments.length > 1) throw new Error(stop.name + " has multiple appointments that day. Use separate routes to preserve both.");
    if (appointments[0]) Object.assign(stop, { appointment: appointments[0].start.toISOString(), locked:true, minutes:Math.max(stop.minutes,Math.ceil((+appointments[0].end - +appointments[0].start)/60000)) });
  }
  return { user, plan };
}
function failure(e: unknown) { return { error: e instanceof Error ? e.message : "The route could not be updated. Your saved route is unchanged." }; }

export async function evaluatePlanningAction(value: unknown, optimize = false) {
  try {
    const { user, plan } = await authorizedPlan(value);
    const limit = await consumeSharedRateLimit(prisma, "route-plan:" + user.id, 30, 10 * 60000);
    if (!limit.ok) throw new Error("Routing is paused briefly to protect your usage allowance.");
    return { value: await calculateRoadPlan(plan, optimize) };
  } catch(e) { return failure(e); }
}
export async function savePlanningAction(value: unknown, id: string | null, expectedUpdatedAt: string | null) {
  try {
    const { user, plan } = await authorizedPlan(value);
    // Recompute on the server. Never persist client-supplied geometry or timings.
    const limit = await consumeSharedRateLimit(prisma, "route-plan:" + user.id, 30, 10 * 60000);
    if (!limit.ok) throw new Error("Routing is paused briefly. Keep this draft and save again shortly.");
    const calculated = await calculateRoadPlan(plan);
    const planning = JSON.parse(JSON.stringify({ ...calculated.plan, road:calculated.road }));
    const result = await prisma.$transaction(async tx => {
      if (id) {
        const existing = await tx.dailyRoute.findFirst({where:{id,organizationId:user.organizationId,userId:user.id}});
        if (!existing) throw new Error("Saved route was not found.");
        if (!expectedUpdatedAt || existing.updatedAt.toISOString() !== expectedUpdatedAt) throw new Error("This route changed in another session. Reopen it before saving.");
        const changed = await tx.dailyRoute.updateMany({where:{id,organizationId:user.organizationId,userId:user.id,updatedAt:new Date(expectedUpdatedAt)},data:{planning,routeDate:new Date(plan.departure),summary:plan.name}});
        if (changed.count !== 1) throw new Error("Another session updated this route. Reopen it before saving.");
        await tx.routeStop.deleteMany({where:{routeId:id}});
        await tx.routeStop.createMany({data:plan.stops.flatMap((s,i)=>s.accountId ? [{routeId:id,accountId:s.accountId,position:i+1,reason:"Planned visit · "+s.minutes+" minutes"}]:[])});
        return tx.dailyRoute.findUniqueOrThrow({where:{id}});
      }
      return tx.dailyRoute.create({data:{organizationId:user.organizationId,userId:user.id,routeDate:new Date(plan.departure),summary:plan.name,planning,status:"saved",stops:{create:plan.stops.flatMap((s,i)=>s.accountId ? [{accountId:s.accountId,position:i+1,reason:"Planned visit · "+s.minutes+" minutes"}]:[])}}});
    });
    revalidatePath("/route"); revalidatePath("/map"); revalidatePath("/today");
    return { id:result.id, updatedAt:result.updatedAt.toISOString(), planning:planning as SavedPlanning };
  } catch(e) { return failure(e); }
}
export async function deletePlanningAction(id: string) {
  try {
    const user = await getCurrentUser();
    const result = await prisma.dailyRoute.deleteMany({where:{id,organizationId:user.organizationId,userId:user.id}});
    if (!result.count) throw new Error("Route was not found.");
    revalidatePath("/route"); revalidatePath("/map");
    return { ok:true };
  } catch(e) { return failure(e); }
}
export async function geocodeRoutePointAction(address: string) {
  try {
    const user = await getCurrentUser();
    if (typeof address !== "string" || address.trim().length < 5 || address.length > 500) throw new Error("Enter a complete address.");
    const limit = await consumeSharedRateLimit(prisma, "route-geocode:"+user.id, 30, 10*60000);
    if (!limit.ok) throw new Error("Address search is paused briefly.");
    const result = await geocodeAddress(address.trim());
    if (result.status !== "ok") throw new Error("Address could not be located. Include street, city and state.");
    return { point:{key:crypto.randomUUID(),accountId:null,name:address.trim(),address:address.trim(),...result.value} };
  } catch(e) { return failure(e); }
}
export async function planningToCalendarAction(id: string) {
  try {
    const user=await getCurrentUser();
    const route=await prisma.dailyRoute.findFirst({where:{id,organizationId:user.organizationId,userId:user.id}});
    const plan=readPlanning(route?.planning);
    if(!route || !plan?.road) throw new Error("Save a calculated route before adding it to Calendar.");
    await prisma.$transaction(async tx=>{
      const prefix="route:"+id+":";
      await tx.calendarEventMapping.deleteMany({where:{organizationId:user.organizationId,userId:user.id,provider:"internal",externalEventId:{startsWith:prefix}}});
      await tx.calendarEventMapping.createMany({data:plan.stops.map((s,i)=>({organizationId:user.organizationId,userId:user.id,provider:"internal",syncState:"internal",externalEventId:prefix+s.key,title:"Visit: "+s.name,startsAt:new Date(plan.road!.timings[i].arrival),endsAt:new Date(plan.road!.timings[i].departure)}))});
    });
    revalidatePath("/calendar");
    return {ok:true};
  } catch(e){return failure(e);}
}
