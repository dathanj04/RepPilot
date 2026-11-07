import { connection } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { RoutePlanner } from "@/components/route/route-planner";
import { googleRoutesConfigured } from "@/lib/maps-config";
import { PageFrame } from "@/components/ui/page";

export const instant = false;
export const metadata = { title: "Route" };

export default async function RoutePage() {
  await connection();
  const user = await requireAppUser();
  const [route, offices] = await Promise.all([
    prisma.dailyRoute.findFirst({
      where: { organizationId: user.organizationId, userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { stops: { include: { account: true }, orderBy: { position: "asc" } } },
    }),
    prisma.account.findMany({
      where: { organizationId: user.organizationId, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, latitude: true, longitude: true },
    }),
  ]);

  return (
    <PageFrame
      title="Route"
      subtitle={
        googleRoutesConfigured()
          ? "Suggest stops from your records, then check drive time. A duration appears only after Google Routes returns one. Confirmed lunch times are not reordered."
          : "Suggest stops from your records and open them in Google Maps. Drive time stays blank until a server Google Maps key with the Routes API is set."
      }
    >
      <RoutePlanner
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
