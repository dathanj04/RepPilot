"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { accountEditScope } from "@/lib/permissions";
import { consumeSharedRateLimit } from "@/lib/domain/rate-limit-store";
import { optimizeDrive } from "./tomtom";
import { formatDriveDuration } from "./provider";

export async function optimizeRouteAction(accountIds: string[], saveLasso = false) {
  const user = await getCurrentUser();
  if (!Array.isArray(accountIds) || accountIds.length < 2 || accountIds.length > 12 || accountIds.some(id => typeof id !== "string") || new Set(accountIds).size !== accountIds.length) return { error: "Select 2–12 different saved accounts. Narrow your lasso if it includes more." };
  const accounts = await prisma.account.findMany({ where: { ...accountEditScope(user), id: { in: accountIds }, status: "ACTIVE" }, select: { id: true, name: true, latitude: true, longitude: true } });
  if (accounts.length !== accountIds.length) return { error: "Some accounts are unavailable or are not assigned to you. Refresh the map and try again." };
  const stops = accountIds.map(id => accounts.find(a => a.id === id)!);
  if (stops.some(a => a.latitude == null || a.longitude == null)) return { error: "Every selected account needs a map location." };
  const now = new Date(), tomorrow = new Date(now.getTime() + 24 * 60 * 60_000);
  const [lunch, meeting] = await Promise.all([
    prisma.lunchBooking.findFirst({ where: { organizationId: user.organizationId, representativeId: user.id, accountId: { in: accountIds }, status: { notIn: ["CANCELED", "COMPLETED"] }, slotEndsAt: { gt: now }, slotStartsAt: { lt: tomorrow } }, select: { id: true } }),
    prisma.meeting.findFirst({ where: { organizationId: user.organizationId, userId: user.id, accountId: { in: accountIds }, status: "CONFIRMED", endsAt: { gt: now }, startsAt: { lt: tomorrow } }, select: { id: true } }),
  ]);
  if (lunch || meeting) return { error: "This selection includes an appointment in the next 24 hours. Build its route manually to preserve scheduled times; remove that account to optimize the remaining stops." };
  const limit = await consumeSharedRateLimit(prisma, `maps:optimize:${user.id}`, 10, 10 * 60_000);
  if (!limit.ok) return { error: "Optimization is paused for a few minutes. Your saved routes are unchanged." };
  const result = await optimizeDrive(stops.map(a => ({ lat: a.latitude!, lng: a.longitude! })));
  if (result.status !== "ok") return { error: result.status === "error" ? result.message : "TomTom Routing must be configured to optimize a route." };
  const ordered = result.value.order.map(index => stops[index]);
  const summary = `${formatDriveDuration(result.value.plan.durationSeconds)} · ${(result.value.plan.distanceMeters / 1609.344).toFixed(1)} driving miles. TomTom road optimization with traffic; first and last stops held fixed. Estimate checked ${now.toISOString()}.`;
  let routeId: string | null = null;
  if (saveLasso) {
    const route = await prisma.dailyRoute.create({ data: { organizationId: user.organizationId, userId: user.id, routeDate: now, status: "saved", summary, stops: { create: ordered.map((a,index) => ({ accountId: a.id, position: index + 1, reason: "Selected with map lasso; ordered using TomTom roads." })) } } });
    routeId = route.id;
    revalidatePath("/route");
    revalidatePath("/today");
  }
  return { accountIds: ordered.map(a => a.id), routeId, plan: { summary, trafficApplied: result.value.plan.trafficApplied, legs: result.value.plan.legs.map((leg,index) => ({ ...leg, from: ordered[index].name, to: ordered[index + 1].name })) } };
}
