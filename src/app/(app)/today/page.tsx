import Link from "next/link";
import { connection } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseOrgSettings } from "@/lib/org-settings";
import { buildDailyBriefing, greetingFor, narrativeUsesOnlyAllowedNumbers } from "@/lib/domain/briefing";
import { polishBriefing } from "@/lib/ai/gemini";
import { hourInZone, formatWhen } from "@/lib/format";
import { processDueReminders } from "@/lib/services/reminders";
import { deliverEmail } from "@/lib/email/send";
import { renderReminderEmail } from "@/lib/email/templates";
import { appUrl } from "@/lib/permissions";

export const instant = false;
export const metadata = { title: "Today" };

export default async function TodayPage() {
  await connection();
  const user = await requireAppUser();
  const now = new Date();
  await processDueReminders(prisma, now, {
    appUrl: appUrl(),
    render: renderReminderEmail,
    send: deliverEmail,
  });
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: user.organizationId } });
  const settings = parseOrgSettings(org.settings);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const week = new Date(now);
  week.setDate(week.getDate() + 7);

  const [tasks, lunches, accounts, route] = await Promise.all([
    prisma.followUpTask.findMany({
      where: { organizationId: user.organizationId, ownerId: user.id, status: "OPEN" },
      include: { account: true },
      orderBy: { dueDate: "asc" },
    }),
    prisma.lunchBooking.findMany({
      where: {
        organizationId: user.organizationId,
        representativeId: user.id,
        status: { notIn: ["CANCELED", "COMPLETED"] },
        slotStartsAt: { gte: now },
      },
      include: { account: true },
      orderBy: { slotStartsAt: "asc" },
    }),
    prisma.account.findMany({ where: { organizationId: user.organizationId, status: "ACTIVE" } }),
    prisma.dailyRoute.findFirst({
      where: { organizationId: user.organizationId, userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { stops: { include: { account: true }, orderBy: { position: "asc" } } },
    }),
  ]);

  const dueToday = tasks.filter((task) => task.dueDate && task.dueDate <= end);
  const pendingConfirmations = lunches.filter((lunch) => lunch.status === "SCHEDULED" || lunch.status === "CHANGE_REQUESTED");
  const staleAccounts = accounts.filter((account) => {
    if (!account.lastVisitAt) return true;
    return (now.getTime() - account.lastVisitAt.getTime()) / 86400000 >= settings.staleBriefingDays;
  }).length;
  const todaysVisits = lunches.filter((lunch) => lunch.slotStartsAt < week).length + (route?.stops.length ?? 0);
  const calculated = buildDailyBriefing({
    plannedVisits: route?.stops.length ?? 0,
    lunches: lunches.length,
    pendingConfirmations: pendingConfirmations.length,
    followUpsDue: dueToday.length,
    staleAccounts,
    staleDays: settings.staleBriefingDays,
  });
  const allowed = [route?.stops.length ?? 0, lunches.length, pendingConfirmations.length, dueToday.length, staleAccounts, settings.staleBriefingDays, todaysVisits];
  const polished = await polishBriefing(calculated, allowed);
  const briefing = narrativeUsesOnlyAllowedNumbers(polished, allowed) ? polished : calculated;
  const nextStop = route?.stops[0]?.account ?? accounts.find((account) => account.nextFollowUpAt && account.nextFollowUpAt <= end) ?? null;
  const greeting = greetingFor(hourInZone(now, user.timezone), user.name);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{greeting}</h1>
        <p className="mt-2 rounded-2xl bg-white p-4 text-sm leading-6 shadow-sm ring-1 ring-slate-200">{briefing}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[
          ["Visits planned", String(route?.stops.length ?? 0)],
          ["Lunches scheduled", String(lunches.length)],
          ["Pending confirmations", String(pendingConfirmations.length)],
          ["Follow-ups due", String(dueToday.length)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="text-2xl font-semibold">{value}</p>
            <p className="text-xs text-[#66758B]">{label}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Link className="rounded-xl bg-[#10263E] px-3 py-3 text-center text-sm font-medium text-white" href="/route">Plan my route</Link>
        <Link className="rounded-xl bg-white px-3 py-3 text-center text-sm font-medium ring-1 ring-slate-200" href="/calendar">Today&apos;s visits</Link>
        <Link className="rounded-xl bg-white px-3 py-3 text-center text-sm font-medium ring-1 ring-slate-200" href="/lunches">Pending lunches</Link>
        <Link className="rounded-xl bg-white px-3 py-3 text-center text-sm font-medium ring-1 ring-slate-200" href="/tasks">Follow-ups</Link>
      </div>
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-sm font-semibold">Suggested next stop</h2>
        {nextStop ? (
          <div className="mt-2">
            <p className="font-medium">{nextStop.name}</p>
            <p className="text-sm text-[#66758B]">{nextStop.street}, {nextStop.city}</p>
            {nextStop.latitude != null && nextStop.longitude != null ? (
              <p className="mt-1 text-xs text-[#66758B]">Open the map for straight-line distance. Driving time is not estimated here.</p>
            ) : null}
            <Link className="mt-3 inline-flex h-11 items-center rounded-xl bg-[#19B78A] px-4 text-sm font-semibold text-[#06281f]" href={`/accounts/${nextStop.id}`}>
              Open account
            </Link>
          </div>
        ) : (
          <p className="mt-2 text-sm text-[#66758B]">No suggested stop yet. Add offices or save a route.</p>
        )}
      </section>
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Upcoming</h2>
        {lunches.length === 0 && dueToday.length === 0 ? (
          <p className="rounded-2xl bg-white p-4 text-sm text-[#66758B] ring-1 ring-slate-200">Nothing scheduled. The map is the fastest way to pick a stop.</p>
        ) : null}
        {lunches.slice(0, 4).map((lunch) => (
          <Link key={lunch.id} href={`/lunches/${lunch.id}`} className="block rounded-2xl bg-white p-4 ring-1 ring-slate-200">
            <p className="font-medium">{lunch.account.name}</p>
            <p className="text-sm text-[#66758B]">{formatWhen(lunch.slotStartsAt, user.timezone)} · {lunch.status.replaceAll("_", " ").toLowerCase()}</p>
          </Link>
        ))}
        {dueToday.map((task) => (
          <Link key={task.id} href="/tasks" className="block rounded-2xl bg-white p-4 ring-1 ring-slate-200">
            <p className="font-medium">{task.title}</p>
            <p className="text-sm text-[#66758B]">{task.account?.name ?? "Follow-up"} · due today</p>
          </Link>
        ))}
      </section>
      <p className="text-xs text-[#66758B]">
        {staleAccounts} accounts have not been visited in {settings.staleBriefingDays} days. Distances on the map are straight-line until a Google Routes key is connected.
      </p>
    </div>
  );
}
