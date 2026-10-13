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
      select: { id: true, name: true },
    }),
  ]);

  return (
    <PageFrame
      title="Route"
      subtitle={`Build the order yourself or start from overdue follow-ups and scheduled lunches. Google Routes is ${googleRoutesConfigured() ? "configured" : "not configured"}, so this screen does not invent driving times.`}
    >
      <RoutePlanner
        offices={offices}
        saved={(route?.stops ?? []).map((stop) => ({
          id: stop.id,
          name: stop.account.name,
          reason: stop.reason,
        }))}
      />
    </PageFrame>
  );
}
