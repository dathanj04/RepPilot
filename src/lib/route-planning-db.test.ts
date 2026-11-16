import { afterAll,beforeAll,describe,it,expect,vi } from "vitest";
vi.mock("server-only",()=>({}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
const actor=vi.hoisted(()=>({id:"",organizationId:"",roleKey:"ORG_ADMIN"}));
vi.mock("@/lib/auth",()=>({getCurrentUser:async()=>actor}));
vi.mock("@/lib/domain/rate-limit-store",()=>({consumeSharedRateLimit:async()=>({ok:true})}));
vi.mock("@/lib/maps/planning-roads",async()=>{
 const {scheduleRoute}=await import("@/lib/domain/route-planning");
 return {calculateRoadPlan:async(plan:import("@/lib/domain/route-planning").RoutePlanning)=>{
  const legs=Array.from({length:plan.stops.length+(plan.end?1:0)},()=>({durationSeconds:60,distanceMeters:1000}));
  return {plan,road:{...scheduleRoute(plan,legs),legs,geometry:[[33,-96],[34,-97]],distanceMeters:legs.length*1000,durationSeconds:legs.length*60,checkedAt:new Date().toISOString()}};
 }};
});
import {prisma,createPrisma} from "@/lib/db";
import {savePlanningAction,deletePlanningAction,planningToCalendarAction} from "./route-planning-actions";
import type {RoutePlanning} from "./domain/route-planning";
describe.skipIf(process.env.ROUTE_DB_INTEGRATION!=="true")("route persistence in isolated PostgreSQL",()=>{
 let plan:RoutePlanning,routeId:string,updatedAt:string;
 beforeAll(async()=>{
  const suffix=crypto.randomUUID();
  const org=await prisma.organization.create({data:{name:"Route test",slug:"route-test-"+suffix}});
  const user=await prisma.user.create({data:{email:suffix+"@example.invalid",name:"Route tester",passwordHash:"test-only"}});
  Object.assign(actor,{id:user.id,organizationId:org.id});
  const accounts=await Promise.all(Array.from({length:16},(_,i)=>prisma.account.create({data:{organizationId:org.id,name:"Office "+i,specialty:"Pediatrics",street:i+" Main",city:"Plano",state:"TX",zip:"75024",latitude:33+i/100,longitude:-96}})));
  const stops=accounts.map(a=>({key:a.id,accountId:a.id,name:a.name,address:"",lat:a.latitude!,lng:a.longitude!,minutes:30,locked:false,appointment:null}));
  plan={version:1,name:"16-office acceptance",departure:"2026-12-20T14:00:00.000Z",workEnd:"2026-12-21T04:00:00.000Z",breakStart:null,breakEnd:null,start:stops[0],end:null,stops};
 });
 afterAll(async()=>{if(actor.organizationId)await prisma.organization.delete({where:{id:actor.organizationId}});if(actor.id)await prisma.user.delete({where:{id:actor.id}});await prisma.$disconnect();});
 it("saves all 16 stops, durations, date and timing in one persistent route",async()=>{
  const r=await savePlanningAction(plan,null,null);expect(r).not.toHaveProperty("error");if("error"in r)throw Error(r.error);
  routeId=r.id;updatedAt=r.updatedAt;expect(r.planning.stops).toHaveLength(16);
  const second=createPrisma(process.env.DATABASE_URL!);try{const fresh=await second.dailyRoute.findUniqueOrThrow({where:{id:r.id},include:{stops:{orderBy:{position:"asc"}}}});expect(fresh.stops).toHaveLength(16);expect((fresh.planning as unknown as RoutePlanning).stops[0].minutes).toBe(30);}finally{await second.$disconnect();}
 });
 it("reopens and persists manual reorder and edited duration",async()=>{
  plan.stops.reverse();plan.stops[0].minutes=45;
  const r=await savePlanningAction(plan,routeId,updatedAt);expect(r).not.toHaveProperty("error");if("error"in r)throw Error(r.error);updatedAt=r.updatedAt;
  const reopened=await prisma.dailyRoute.findUniqueOrThrow({where:{id:routeId},include:{stops:{orderBy:{position:"asc"}}}});
  expect(reopened.stops[0].accountId).toBe(plan.stops[0].accountId);expect((reopened.planning as unknown as RoutePlanning).stops[0].minutes).toBe(45);
 });
 it("refuses stale overwrites and other-user updates or deletion",async()=>{
  expect(await savePlanningAction(plan,routeId,"2020-01-01T00:00:00.000Z")).toHaveProperty("error");
  const original=actor.id;actor.id="another-user";expect(await savePlanningAction(plan,routeId,updatedAt)).toHaveProperty("error");expect(await deletePlanningAction(routeId)).toHaveProperty("error");actor.id=original;
  expect(await prisma.dailyRoute.count({where:{id:routeId}})).toBe(1);
 });
 it("calendar export is repeatable without duplicating 16 visits",async()=>{
  expect(await planningToCalendarAction(routeId)).toEqual({ok:true});expect(await planningToCalendarAction(routeId)).toEqual({ok:true});
  expect(await prisma.calendarEventMapping.count({where:{organizationId:actor.organizationId,externalEventId:{startsWith:"route:"+routeId+":"}}})).toBe(16);
 });
 it("duplicates independently then deletes only the owned copy",async()=>{
  const r=await savePlanningAction({...plan,name:"Copy"},null,null);if("error"in r)throw Error(r.error);expect(r.id).not.toBe(routeId);expect(await deletePlanningAction(r.id)).toEqual({ok:true});expect(await prisma.dailyRoute.count({where:{id:routeId}})).toBe(1);
 });
});
