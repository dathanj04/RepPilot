import Link from "next/link";
import { connection } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatWhen } from "@/lib/format";

export const instant = false;
export const metadata = { title: "Calendar" };

export default async function CalendarPage() {
  await connection();
  const user = await requireAppUser();
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
  const googleReady = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const microsoftReady = Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET);

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-5">
      <h1 className="text-2xl font-semibold">Calendar</h1>
      <section className="rounded-2xl bg-white p-4 text-sm ring-1 ring-slate-200">
        <h2 className="font-semibold">Connections</h2>
        <p className="mt-2">Google Calendar: {statusLabel(connections.find((item) => item.provider === "google")?.status, googleReady)}</p>
        <p>Microsoft 365: {statusLabel(connections.find((item) => item.provider === "microsoft")?.status, microsoftReady)}</p>
        <p className="mt-2 text-xs text-[#66758B]">
          RepPilot keeps an internal schedule for lunches you authorize. External calendars stay disconnected until OAuth credentials are configured and a connection is tested. Busy time from an unconnected calendar is not read.
        </p>
      </section>
      <section>
        <h2 className="text-sm font-semibold">Scheduled lunches</h2>
        {events.length === 0 ? <p className="mt-2 text-sm text-[#66758B]">No internal events yet.</p> : null}
        <ul className="mt-2 space-y-2">
          {events.map((event) => (
            <li key={event.id} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <p className="font-medium">{event.title}</p>
              <p className="text-sm text-[#66758B]">{formatWhen(event.startsAt, user.timezone)} · {event.syncState}</p>
              {event.lunchBookingId ? <Link className="text-sm underline" href={`/lunches/${event.lunchBookingId}`}>Open lunch</Link> : null}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="text-sm font-semibold">Follow-ups with dates</h2>
        <ul className="mt-2 space-y-2">
          {tasks.map((task) => (
            <li key={task.id} className="rounded-xl bg-white p-3 text-sm ring-1 ring-slate-200">
              <p className="font-medium">{task.title}</p>
              <p className="text-[#66758B]">{task.dueDate ? formatWhen(task.dueDate, user.timezone) : ""}{task.account ? ` · ${task.account.name}` : ""}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function statusLabel(status: string | undefined, credentials: boolean) {
  if (!credentials) return "Credentials not configured";
  if (!status || status === "not_connected") return "Not connected";
  return status;
}
