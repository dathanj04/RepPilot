import { connection } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { accountEditScope } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { RoutePlanner } from "@/components/route/route-planner";
import { googleRoutesConfigured } from "@/lib/maps-config";
import { PageFrame } from "@/components/ui/page";

export const instant = false;
export const metadata = { title: "Route" };

export default async function RoutePage({ searchParams }: { searchParams: Promise<{ route?: string }> }) {
  const selected = await searchParams;
  await connection();
  const user = await requireAppUser();
  const [route, offices] = await Promise.all([
    prisma.dailyRoute.findFirst({
      where: { organizationId: user.organizationId, userId: user.id, ...(selected.route ? { id: selected.route } : {}) },
      orderBy: { createdAt: "desc" },
      include: { stops: { include: { account: true }, orderBy: { position: "asc" } } },
    }),
    prisma.account.findMany({
      where: { ...accountEditScope(user), status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, latitude: true, longitude: true },
    }),
  ]);

  return (
    <PageFrame
      title="Route"
      subtitle={
        googleRoutesConfigured()
          ? "Lasso saved accounts on the Territory map or add stops here, then optimize your route using TomTom roads and traffic."
          : "Suggest stops from your records and open them in Google Maps. Drive time stays blank until TomTom or Google Routes is configured."
      }
    >
      <RoutePlanner
        key={route?.id ?? "new"}
        initialStops={(route?.stops ?? []).map(s => ({ accountId: s.accountId, name: s.account.name, reasons: [s.reason], straightLineMiles: null, lat: s.account.latitude, lng: s.account.longitude }))}
        offices={offices.map((office) => ({ id: office.id, name: office.name, lat: office.latitude, lng: office.longitude }))}
        savedSummary={route?.summary ?? null}
        saved={(route?.stops ?? []).map((stop) => ({
          id: stop.id,
          name: stop.account.name,
          reason: stop.reason,
        }))}
      />
    </PageFrame>
  );
}
