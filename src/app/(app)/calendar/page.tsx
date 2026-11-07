import Link from "next/link";
import { eachDayOfInterval, endOfMonth, format, getDay, isSameDay, startOfMonth } from "date-fns";
import { connection } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatWhen } from "@/lib/format";
import { PageFrame } from "@/components/ui/page";
import { disconnectCalendarAction } from "@/lib/meetings/actions";
import { googleCalendarConfigured, microsoftCalendarConfigured } from "@/lib/calendar/oauth";

export const instant = false;
export const metadata = { title: "Calendar" };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  await connection();
  const user = await requireAppUser();
  const { notice } = await searchParams;
  const now = new Date();
  const [connections, events, tasks] = await Promise.all([
    prisma.calendarConnection.findMany({ where: { userId: user.id } }),
    prisma.calendarEventMapping.findMany({
      where: { organizationId: user.organizationId, userId: user.id, startsAt: { gte: new Date(now.getTime() - 86400000) } },
      orderBy: { startsAt: "asc" },
      take: 30,
    }),
    prisma.followUpTask.findMany({
      where: { organizationId: user.organizationId, ownerId: user.id, status: "OPEN", dueDate: { not: null } },
      include: { account: true },
      orderBy: { dueDate: "asc" },
      take: 20,
    }),
  ]);
  const googleReady = googleCalendarConfigured();
  const microsoftReady = microsoftCalendarConfigured();

  const monthStart = startOfMonth(now);
  const days = eachDayOfInterval({ start: monthStart, end: endOfMonth(now) });
  const lead = getDay(monthStart);

  return (
    <PageFrame title="Calendar" subtitle="Internal lunches and follow-ups live here. External calendars stay disconnected until OAuth succeeds.">
      {notice ? <p className="mb-3 rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-slate-200">{notice}</p> : null}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.8fr)]">
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-[#10263E]">{format(now, "MMMM yyyy")}</h2>
            <div className="flex gap-3 text-xs text-[#66758B]">
              <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-[#19B78A]" /> Internal</span>
              <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-[#F3B544]" /> Follow-up</span>
              <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-[#7C8BA1]" /> External</span>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-[#66758B]">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day} className="py-1">{day}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: lead }, (_, index) => <div key={`pad-${index}`} />)}
            {days.map((day) => {
              const dayEvents = events.filter((event) => isSameDay(event.startsAt, day));
              const dayTasks = tasks.filter((task) => task.dueDate && isSameDay(task.dueDate, day));
              return (
                <div key={day.toISOString()} className={`min-h-16 min-w-0 overflow-hidden rounded-xl p-1 text-xs md:min-h-20 ${isSameDay(day, now) ? "bg-[#E7F8F3]" : "bg-[#F5F7FA]"}`}>
                  <p className="px-1 font-medium text-[#10263E]">{format(day, "d")}</p>
                  <div className="mt-1 flex flex-wrap gap-1 px-1 md:hidden" aria-hidden="true">
                    {dayEvents.slice(0, 3).map((event) => (
                      <span key={event.id} className={`size-1.5 rounded-full ${event.provider === "internal" || event.syncState === "internal" ? "bg-[#19B78A]" : "bg-[#7C8BA1]"}`} />
                    ))}
                    {dayTasks.slice(0, 2).map((task) => (
                      <span key={task.id} className="size-1.5 rounded-full bg-[#F3B544]" />
                    ))}
                  </div>
                  {dayEvents.slice(0, 2).map((event) => (
                    <p key={event.id} className={`mt-1 hidden truncate rounded-md px-1 py-0.5 md:block ${event.provider === "internal" || event.syncState === "internal" ? "bg-[#19B78A]/20 text-[#06281f]" : "bg-[#7C8BA1]/20 text-[#10263E]"}`}>{event.title}</p>
                  ))}
                  {dayTasks.slice(0, 1).map((task) => (
                    <p key={task.id} className="mt-1 hidden truncate rounded-md bg-[#F3B544]/30 px-1 py-0.5 md:block">{task.title}</p>
                  ))}
                </div>
              );
            })}
          </div>
        </section>
        <div className="space-y-4">
          <section className="rounded-2xl bg-white p-4 text-sm shadow-sm ring-1 ring-slate-200">
            <h2 className="font-semibold text-[#10263E]">External calendars</h2>
            <p className="mt-2">Google Calendar: {statusLabel(connections.find((item) => item.provider === "google")?.status, googleReady)}</p>
            <p>Microsoft 365: {statusLabel(connections.find((item) => item.provider === "microsoft")?.status, microsoftReady)}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {googleReady ? <a className="inline-flex h-10 items-center rounded-xl bg-[#10263E] px-3 text-xs font-medium text-white" href="/api/calendar/google/start">Connect Google</a> : <span className="text-xs text-[#66758B]">Google OAuth credentials are not set.</span>}
              {microsoftReady ? <a className="inline-flex h-10 items-center rounded-xl bg-[#10263E] px-3 text-xs font-medium text-white" href="/api/calendar/microsoft/start">Connect Microsoft 365</a> : <span className="text-xs text-[#66758B]">Microsoft OAuth credentials are not set.</span>}
            </div>
            {connections.some((item) => item.status === "connected") ? (
              <form action={disconnectCalendarAction} className="mt-3 flex gap-2">
                <button name="provider" value="google" className="h-10 rounded-xl px-3 text-xs ring-1 ring-slate-200" type="submit">Disconnect Google</button>
                <button name="provider" value="microsoft" className="h-10 rounded-xl px-3 text-xs ring-1 ring-slate-200" type="submit">Disconnect Microsoft</button>
              </form>
            ) : null}
            <p className="mt-2 text-xs text-[#66758B]">Busy time from an unconnected calendar is not read, and it is not treated as free. Offices never see private event titles. The month grid shows RepPilot records only until a connection has been authorized.</p>
          </section>
          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <h2 className="font-semibold text-[#10263E]">Internal schedule</h2>
            {events.length === 0 ? <p className="mt-2 text-sm text-[#66758B]">No internal events yet.</p> : null}
            <ul className="mt-2 space-y-2">
              {events.map((event) => (
                <li key={event.id} className="rounded-xl bg-[#F5F7FA] p-3">
                  <p className="font-medium">{event.title}</p>
                  <p className="text-sm text-[#66758B]">{formatWhen(event.startsAt, user.timezone)} · {event.provider === "internal" || event.syncState === "internal" ? "Internal" : `${event.provider} · ${event.syncState}`}</p>
                  {event.lunchBookingId ? <Link className="mt-1 inline-flex h-9 items-center text-sm font-medium text-[#10263E]" href={`/lunches/${event.lunchBookingId}`}>Open lunch</Link> : null}
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <h2 className="font-semibold text-[#10263E]">Follow-ups with dates</h2>
            <ul className="mt-2 space-y-2">
              {tasks.map((task) => (
                <li key={task.id} className="rounded-xl bg-[#F5F7FA] p-3 text-sm">
                  <p className="font-medium">{task.title}</p>
                  <p className="text-[#66758B]">{task.dueDate ? formatWhen(task.dueDate, user.timezone) : ""}{task.account ? ` · ${task.account.name}` : ""}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </PageFrame>
  );
}

function statusLabel(status: string | undefined, credentials: boolean) {
  if (!credentials) return "Credentials not configured";
  if (!status || status === "not_connected") return "Not connected";
  return status;
}
