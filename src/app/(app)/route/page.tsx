import { connection } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { RoutePlanner } from "@/components/route/route-planner";

export const instant = false;
export const metadata = { title: "Route" };

export default async function RoutePage() {
  await connection();
  const user = await requireAppUser();
  const route = await prisma.dailyRoute.findFirst({
    where: { organizationId: user.organizationId, userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { stops: { include: { account: true }, orderBy: { position: "asc" } } },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-5">
      <h1 className="text-2xl font-semibold">Plan my route</h1>
      <p className="mt-2 mb-4 text-sm text-[#66758B]">
        Suggestions come from overdue follow-ups, stale visits, and lunches already on your calendar. They stay advisory until you save them. Google Routes is {process.env.GOOGLE_MAPS_API_KEY ? "configured" : "not configured"}, so this screen does not invent driving times.
      </p>
      <RoutePlanner
        saved={(route?.stops ?? []).map((stop) => ({
          id: stop.id,
          name: stop.account.name,
          reason: stop.reason,
        }))}
      />
    </div>
  );
}
