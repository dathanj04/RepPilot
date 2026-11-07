import { connection } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseOrgSettings } from "@/lib/org-settings";
import { classifyAccount, daysBetween } from "@/lib/domain/markers";
import { formatDay } from "@/lib/format";
import type { MapAccount } from "@/components/map/territory-map";
import { TerritoryMapLoader } from "@/components/map/map-loader";
import { googleMapsBrowserKey } from "@/lib/maps-config";

export const instant = false;
export const metadata = { title: "Map" };

export default async function MapPage() {
  await connection();
  const user = await requireAppUser();
  const now = new Date();
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: user.organizationId } });
  const settings = parseOrgSettings(org.settings);
  const [accounts, tasks, territory] = await Promise.all([
    prisma.account.findMany({
      where: { organizationId: user.organizationId },
      include: {
        contacts: { where: { isPrimary: true }, take: 1 },
        territory: { select: { name: true } },
        assignments: { include: { user: { select: { name: true } } }, take: 1 },
      },
      orderBy: { name: "asc" },
    }),
    prisma.followUpTask.findMany({
      where: { organizationId: user.organizationId, status: "OPEN", priority: "HIGH", dueDate: { lte: now } },
    }),
    prisma.territory.findFirst({ where: { organizationId: user.organizationId } }),
  ]);
  const overdueIds = new Set(tasks.map((task) => task.accountId).filter(Boolean));
  const pins: MapAccount[] = accounts.map((account) => ({
    id: account.id,
    name: account.name,
    specialty: account.specialty,
    street: account.street,
    city: account.city,
    state: account.state,
    zip: account.zip,
    lat: account.latitude,
    lng: account.longitude,
    tone: classifyAccount({
      lastVisitAt: account.lastVisitAt,
      nextFollowUpAt: account.nextFollowUpAt,
      hasHighPriorityOverdue: overdueIds.has(account.id),
      now,
      recentDays: settings.recentVisitDays,
      overdueDays: settings.overdueVisitDays,
    }),
    lastVisit: account.lastVisitAt ? formatDay(account.lastVisitAt, user.timezone) : null,
    daysSince: account.lastVisitAt ? daysBetween(now, account.lastVisitAt) : null,
    nextFollowUp: account.nextFollowUpAt ? formatDay(account.nextFollowUpAt, user.timezone) : null,
    contact: account.contacts[0]?.name ?? null,
    status: account.status,
    territory: account.territory?.name ?? null,
    owner: account.assignments[0]?.user.name ?? null,
  }));
  const boundary = polygonFrom(territory?.boundary);
  const first = pins.find((pin) => pin.lat != null && pin.lng != null);
  return (
    <TerritoryMapLoader
      accounts={pins}
      boundary={boundary}
      googleMapsKey={googleMapsBrowserKey()}
      center={first ? [first.lat!, first.lng!] : [33.15, -96.82]}
    />
  );
}

function polygonFrom(value: unknown): [number, number][] | null {
  if (!value || typeof value !== "object" || !("coordinates" in value)) return null;
  const coordinates = (value as { coordinates?: number[][][] }).coordinates?.[0];
  if (!coordinates) return null;
  return coordinates.map(([lng, lat]) => [lat!, lng!] as [number, number]);
}
