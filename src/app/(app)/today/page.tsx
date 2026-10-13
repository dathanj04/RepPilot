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
import { MetricCard, PageFrame } from "@/components/ui/page";

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

  const visits = route?.stops ?? [];

  return (
    <PageFrame title={greeting} subtitle={briefing} action={<Link className="inline-flex h-11 items-center rounded-xl bg-[#10263E] px-4 text-sm font-medium text-white" href="/map">Open map</Link>}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Visits planned" value={String(visits.length)} hint="Saved route stops" />
        <MetricCard label="Lunches scheduled" value={String(lunches.length)} hint="Still ahead of you" />
        <MetricCard label="Pending confirmations" value={String(pendingConfirmations.length)} hint="Waiting on the office" />
        <MetricCard label="Follow-ups due" value={String(dueToday.length)} hint={`${staleAccounts} offices quiet for ${settings.staleBriefingDays} days`} />
      </div>
      <div className="mt-6 grid items-start gap-4 lg:grid-cols-3">
        <section className="rounded-2xl bg-[#10263E] p-5 text-white lg:col-span-1">
          <p className="text-xs font-medium tracking-wide text-white/60">SUGGESTED NEXT STOP</p>
          {nextStop ? (
            <>
              <h2 className="mt-2 text-xl font-semibold">{nextStop.name}</h2>
              <p className="mt-1 text-sm text-white/70">{nextStop.street}, {nextStop.city}</p>
              <p className="mt-3 text-xs text-white/60">Driving time is not shown. Open the map for the office pin.</p>
              <div className="mt-4 flex gap-2">
                <Link className="inline-flex h-11 items-center rounded-xl bg-[#19B78A] px-4 text-sm font-semibold text-[#06281f]" href={`/accounts/${nextStop.id}/check-in`}>Check in</Link>
                <Link className="inline-flex h-11 items-center rounded-xl bg-white/10 px-4 text-sm font-medium" href={`/accounts/${nextStop.id}`}>Account</Link>
              </div>
            </>
          ) : <p className="mt-3 text-sm text-white/70">No suggested stop yet. Add offices or save a route.</p>}
        </section>
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-[#10263E]">Today&apos;s visits</h2>
            <Link className="text-sm font-medium text-[#10263E]" href="/route">Route</Link>
          </div>
          {visits.length === 0 ? <p className="text-sm text-[#66758B]">No saved stops. Plan a route when you know the order.</p> : null}
          <ul className="space-y-2">
            {visits.map((stop, index) => (
              <li key={stop.id}>
                <Link href={`/accounts/${stop.accountId}/check-in`} className="flex items-center gap-3 rounded-xl bg-[#F5F7FA] px-3 py-3">
                  <span className="grid size-8 place-items-center rounded-full bg-[#10263E] text-sm font-semibold text-white">{index + 1}</span>
                  <span>
                    <span className="block font-medium">{stop.account.name}</span>
                    <span className="block text-xs text-[#66758B]">{stop.account.city}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section className="space-y-4">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-[#10263E]">Upcoming lunches</h2>
              <Link className="text-sm font-medium text-[#10263E]" href="/lunches">All</Link>
            </div>
            {lunches.length === 0 ? <p className="text-sm text-[#66758B]">No lunches on the books.</p> : null}
            <ul className="space-y-2">
              {lunches.slice(0, 3).map((lunch) => (
                <li key={lunch.id}>
                  <Link href={`/lunches/${lunch.id}`} className="block rounded-xl bg-[#F5F7FA] px-3 py-3">
                    <span className="block font-medium">{lunch.account.name}</span>
                    <span className="block text-xs text-[#66758B]">{formatWhen(lunch.slotStartsAt, user.timezone)} · {lunch.status.replaceAll("_", " ").toLowerCase()}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-[#10263E]">Follow-ups</h2>
              <Link className="text-sm font-medium text-[#10263E]" href="/tasks">Tasks</Link>
            </div>
            {dueToday.length === 0 ? <p className="text-sm text-[#66758B]">Nothing due today.</p> : null}
            <ul className="space-y-2">
              {dueToday.slice(0, 4).map((task) => (
                <li key={task.id}>
                  <Link href="/tasks" className="block rounded-xl bg-[#F5F7FA] px-3 py-3">
                    <span className="block font-medium">{task.title}</span>
                    <span className="block text-xs text-[#66758B]">{task.account?.name ?? "Follow-up"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </PageFrame>
  );
}
