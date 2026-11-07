import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatWhen } from "@/lib/format";
import { decideMeetingAction } from "@/lib/meetings/actions";
import { PageFrame } from "@/components/ui/page";

export const instant = false;

export default async function MeetingRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  await connection();
  const user = await requireAppUser();
  const { id } = await params;
  const { notice } = await searchParams;
  const request = await prisma.meetingRequest.findFirst({
    where: { id, organizationId: user.organizationId },
    include: { meeting: true, history: { orderBy: { createdAt: "asc" } }, invitation: { include: { slots: { orderBy: { startsAt: "asc" } } } } },
  });
  if (!request || request.invitation.createdById !== user.id) notFound();
  const open = request.status === "PENDING" || request.status === "RESCHEDULE_PROPOSED";

  return (
    <PageFrame title={request.officeName} subtitle={`${request.status.replaceAll("_", " ")} · ${formatWhen(request.requestedStartsAt, user.timezone)}`} action={<Link href="/meetings" className="inline-flex h-11 items-center rounded-xl px-4 text-sm font-medium ring-1 ring-slate-200">All requests</Link>}>
      {notice ? <p className="mb-3 rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-slate-200">{notice}</p> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <h2 className="font-semibold">Request</h2>
          <p className="mt-2 text-sm">{request.purpose}</p>
          <p className="mt-2 text-sm text-[#66758B]">{request.requesterName}{request.requesterEmail ? ` · ${request.requesterEmail}` : ""}</p>
          {request.meeting ? (
            <p className="mt-3 text-sm">Confirmed in RepPilot. External calendar: {request.meeting.syncState.replaceAll("_", " ")}{request.meeting.externalEventId ? "" : ". No external event id is stored."}</p>
          ) : (
            <p className="mt-3 text-sm">No confirmed meeting exists yet.</p>
          )}
        </section>
        <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <h2 className="font-semibold">History</h2>
          <ol className="mt-2 space-y-2 text-sm">
            {request.history.map((event) => (
              <li key={event.id}>{event.fromStatus ?? "start"} → {event.toStatus} · {event.actorLabel}</li>
            ))}
          </ol>
        </section>
        {open ? (
          <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 lg:col-span-2">
            <h2 className="font-semibold">Decide</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <form action={decideMeetingAction} className="grid gap-2">
                <input type="hidden" name="requestId" value={request.id} />
                <input type="hidden" name="decision" value="approve" />
                <button className="h-12 rounded-xl bg-[#19B78A] font-semibold text-[#06281f]" type="submit">Approve and confirm</button>
                <p className="text-xs text-[#66758B]">Availability is checked again. A conflict leaves this request pending.</p>
              </form>
              <form action={decideMeetingAction} className="grid gap-2">
                <input type="hidden" name="requestId" value={request.id} />
                <input type="hidden" name="decision" value="decline" />
                <input name="note" placeholder="Note to keep on the request" className="h-11 rounded-xl border px-3" />
                <button className="h-12 rounded-xl bg-white font-medium ring-1 ring-slate-200" type="submit">Decline</button>
              </form>
              <form action={decideMeetingAction} className="grid gap-2 md:col-span-2">
                <input type="hidden" name="requestId" value={request.id} />
                <input type="hidden" name="decision" value="propose" />
                <p className="text-sm">Propose another offered time. Use the same date and time you put on the invitation.</p>
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" name="proposeDate" required className="h-11 rounded-xl border px-3" />
                  <input type="time" name="proposeTime" required defaultValue="09:00" className="h-11 rounded-xl border px-3" />
                </div>
                <button className="h-12 rounded-xl bg-[#10263E] font-medium text-white" type="submit">Propose a different time</button>
              </form>
            </div>
          </section>
        ) : null}
        {request.status === "CONFIRMED" ? (
          <form action={decideMeetingAction} className="flex gap-2 lg:col-span-2">
            <input type="hidden" name="requestId" value={request.id} />
            <button name="decision" value="complete" className="h-11 rounded-xl bg-white px-4 text-sm font-medium ring-1 ring-slate-200" type="submit">Mark completed</button>
            <button name="decision" value="cancel" className="h-11 rounded-xl bg-white px-4 text-sm font-medium ring-1 ring-slate-200" type="submit">Cancel meeting</button>
          </form>
        ) : null}
      </div>
    </PageFrame>
  );
}
