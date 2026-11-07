"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { consumeSharedRateLimit } from "@/lib/domain/rate-limit-store";
import { appointmentTravelWarnings, formatDriveDuration } from "@/lib/maps/provider";
import { computeDrive, searchPlaces } from "@/lib/maps/google";
import { findDuplicateAccount } from "@/lib/services/accounts";
import { googleMapsServerKey } from "@/lib/maps-config";

const TRAVEL_BUFFER_MINUTES = 10;

function validPoint(point: { lat: number; lng: number } | null) {
  if (!point) return null;
  if (!Number.isFinite(point.lat) || point.lat < -90 || point.lat > 90) return null;
  if (!Number.isFinite(point.lng) || point.lng < -180 || point.lng > 180) return null;
  return point;
}

async function recordMapsCall(input: { organizationId: string; actorId: string; action: string; status: string; resultCount?: number }) {
  await prisma.auditLog.create({
    data: {
      organizationId: input.organizationId,
      actorId: input.actorId,
      action: input.action,
      entityType: "MapApi",
      entityId: input.action,
      metadata: {
        status: input.status,
        resultCount: input.resultCount ?? null,
      },
    },
  });
}

export async function searchPlacesAction(query: string, bias: { lat: number; lng: number } | null) {
  const user = await getCurrentUser();
  const text = query.trim();
  if (text.length < 3 || text.length > 120) {
    return { configured: Boolean(googleMapsServerKey()), places: [], message: "Enter at least 3 characters, such as a specialty and city." };
  }
  if (!googleMapsServerKey()) {
    return {
      configured: false,
      places: [],
      message: "Places search needs a server Google Maps key with the Places API (New) enabled. No sample offices were added.",
    };
  }
  const limit = await consumeSharedRateLimit(prisma, `maps:places:${user.id}`, 20, 10 * 60_000);
  if (!limit.ok) {
    return { configured: true, places: [], message: "Places search is paused for a few minutes so this organization does not burn the map quota." };
  }
  const result = await searchPlaces({ query: text, bias: validPoint(bias) });
  if (result.status !== "ok") {
    await recordMapsCall({
      organizationId: user.organizationId,
      actorId: user.id,
      action: "maps.places",
      status: result.status,
      resultCount: 0,
    });
    return {
      configured: true,
      places: [],
      message: result.status === "error" ? result.message : "Places search did not return offices.",
    };
  }
  await recordMapsCall({
    organizationId: user.organizationId,
    actorId: user.id,
    action: "maps.places",
    status: "ok",
    resultCount: result.value.length,
  });
  if (result.value.length === 0) {
    return { configured: true, places: [], message: "Google Places returned no office with a complete street address. Nothing was invented." };
  }
  return { configured: true, places: result.value, message: "These results are not saved until you add an office." };
}

export async function addDiscoveredAccountAction(formData: FormData) {
  const user = await getCurrentUser();
  const data = {
    name: String(formData.get("name") || "").trim(),
    specialty: String(formData.get("specialty") || "").trim(),
    street: String(formData.get("street") || "").trim(),
    city: String(formData.get("city") || "").trim(),
    state: String(formData.get("state") || "").trim(),
    zip: String(formData.get("zip") || "").trim(),
    latitude: Number(formData.get("latitude")),
    longitude: Number(formData.get("longitude")),
  };
  if (!data.name || !data.specialty || !data.street || !data.city || !data.state || !data.zip) {
    return { error: "Name, specialty, and a complete address are required." };
  }
  if (!Number.isFinite(data.latitude) || !Number.isFinite(data.longitude)) {
    return { error: "This place did not include coordinates, so it was not added." };
  }
  const duplicate = await findDuplicateAccount(prisma, {
    organizationId: user.organizationId,
    name: data.name,
    street: data.street,
    zip: data.zip,
  });
  if (duplicate) return { error: "An office with this name and address is already in your organization.", accountId: duplicate.id };
  const account = await prisma.account.create({
    data: {
      organizationId: user.organizationId,
      name: data.name,
      officeType: "Clinic",
      specialty: data.specialty,
      street: data.street,
      city: data.city,
      state: data.state,
      zip: data.zip,
      latitude: data.latitude,
      longitude: data.longitude,
      status: "ACTIVE",
    },
  });
  await prisma.accountAssignment.create({
    data: { organizationId: user.organizationId, accountId: account.id, userId: user.id },
  });
  await prisma.auditLog.create({
    data: {
      organizationId: user.organizationId,
      actorId: user.id,
      action: "account.created",
      entityType: "Account",
      entityId: account.id,
      metadata: { name: data.name, source: "places" },
    },
  });
  revalidatePath("/map");
  revalidatePath("/accounts");
  return { accountId: account.id };
}

export async function computeDriveAction(input: { origin: { lat: number; lng: number } | null; accountIds: string[] }) {
  const user = await getCurrentUser();
  const ids = input.accountIds.filter((id, index) => input.accountIds.indexOf(id) === index).slice(0, 12);
  if (ids.length === 0) return { configured: false, plan: null, warnings: [] as string[], message: "Add at least one office." };
  const [accounts, lunches] = await Promise.all([
    prisma.account.findMany({ where: { organizationId: user.organizationId, id: { in: ids } } }),
    prisma.lunchBooking.findMany({
      where: {
        organizationId: user.organizationId,
        representativeId: user.id,
        accountId: { in: ids },
        status: { notIn: ["CANCELED", "COMPLETED"] },
        slotStartsAt: { gte: new Date() },
      },
      orderBy: { slotStartsAt: "asc" },
    }),
  ]);
  if (accounts.length !== ids.length) {
    return { configured: false, plan: null, warnings: [], message: "One of those offices is outside your organization." };
  }
  const byId = new Map(accounts.map((account) => [account.id, account]));
  const ordered = ids.map((id) => byId.get(id)!);
  const missing = ordered.filter((account) => account.latitude == null || account.longitude == null);
  const nextLunch = new Map<string, Date>();
  for (const lunch of lunches) {
    if (!nextLunch.has(lunch.accountId)) nextLunch.set(lunch.accountId, lunch.slotStartsAt);
  }
  const timed = ordered.map((account) => ({
    name: account.name,
    location: account.latitude != null && account.longitude != null ? { lat: account.latitude, lng: account.longitude } : null,
    fixedAt: nextLunch.get(account.id)?.toISOString() ?? null,
  }));
  if (missing.length > 0) {
    return {
      configured: Boolean(googleMapsServerKey()),
      plan: null,
      warnings: appointmentTravelWarnings({ stops: timed, legs: null, bufferMinutes: TRAVEL_BUFFER_MINUTES }),
      message: `${missing.map((account) => account.name).join(", ")} still need coordinates. Drive time was not estimated.`,
    };
  }
  const origin = validPoint(input.origin);
  const points = [
    ...(origin ? [origin] : []),
    ...ordered.flatMap((account) => {
      const point = validPoint(account.latitude != null && account.longitude != null ? { lat: account.latitude, lng: account.longitude } : null);
      return point ? [point] : [];
    }),
  ];
  if (points.length < 2) {
    return {
      configured: Boolean(googleMapsServerKey()),
      plan: null,
      warnings: [],
      message: "Share your location or add a second office before asking for drive time.",
    };
  }
  if (!googleMapsServerKey()) {
    return {
      configured: false,
      plan: null,
      warnings: appointmentTravelWarnings({ stops: timed, legs: null, bufferMinutes: TRAVEL_BUFFER_MINUTES }),
      message: "Google Routes is not configured. No drive time is shown.",
    };
  }
  const limit = await consumeSharedRateLimit(prisma, `maps:routes:${user.id}`, 30, 10 * 60_000);
  if (!limit.ok) {
    return { configured: true, plan: null, warnings: [], message: "Drive-time checks are paused for a few minutes." };
  }
  const result = await computeDrive(points);
  await recordMapsCall({
    organizationId: user.organizationId,
    actorId: user.id,
    action: "maps.routes",
    status: result.status,
  });
  if (result.status !== "ok") {
    return {
      configured: true,
      plan: null,
      warnings: appointmentTravelWarnings({ stops: timed, legs: null, bufferMinutes: TRAVEL_BUFFER_MINUTES }),
      message: result.status === "error" ? result.message : "Routes did not return a drive time.",
    };
  }
  const originOffset = input.origin ? 1 : 0;
  const betweenStops = result.value.legs.slice(originOffset);
  const labels = input.origin ? ["Your location", ...ordered.map((account) => account.name)] : ordered.map((account) => account.name);
  const legs = result.value.legs.map((leg, index) => ({
    from: labels[index] ?? "Stop",
    to: labels[index + 1] ?? "Stop",
    distanceMeters: leg.distanceMeters,
    durationSeconds: leg.durationSeconds,
  }));
  return {
    configured: true,
    plan: {
      source: "google_routes" as const,
      durationSeconds: result.value.durationSeconds,
      distanceMeters: result.value.distanceMeters,
      trafficApplied: result.value.trafficApplied,
      summary: formatDriveDuration(result.value.durationSeconds),
      legs,
    },
    warnings: appointmentTravelWarnings({ stops: timed, legs: betweenStops, bufferMinutes: TRAVEL_BUFFER_MINUTES }),
    message: result.value.trafficApplied
      ? "Drive time is from Google Routes and includes current traffic."
      : "Drive time is from Google Routes. Traffic did not change the no-traffic duration.",
  };
}
