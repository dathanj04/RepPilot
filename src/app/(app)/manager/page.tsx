import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { requireAppUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canReviewCompliance, canViewTeam } from "@/lib/permissions";
import { decideCateringAction, reviewExceptionAction } from "@/lib/actions";
import { formatCents, summarizeSpending } from "@/lib/domain/spending";
import { formatWhen } from "@/lib/format";
import { EXCEPTION_LIMIT } from "@/lib/domain/policy";

export const instant = false;
export const metadata = { title: "Team" };

export default async function ManagerPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  await connection();
  const { notice } = await searchParams;
  const user = await requireAppUser();
  if (!canViewTeam(user.roleKey)) notFound();
  const now = new Date();
  const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [members, accounts, visits, tasks, lunches, spending, cateringRequests, exceptions, territories] = await Promise.all([
    prisma.organizationMembership.findMany({
      where: { organizationId: user.organizationId },
      include: { user: true, role: true },
    }),
    prisma.account.count({ where: { organizationId: user.organizationId, status: "ACTIVE" } }),
    prisma.accountInteraction.findMany({
      where: { organizationId: user.organizationId, occurredAt: { gte: month } },
      select: { userId: true },
    }),
    prisma.followUpTask.count({ where: { organizationId: user.organizationId, status: "OPEN" } }),
    prisma.lunchBooking.findMany({
      where: { organizationId: user.organizationId, status: { notIn: ["CANCELED", "COMPLETED"] }, slotStartsAt: { gte: now } },
      include: { account: true, representative: true },
      orderBy: { slotStartsAt: "asc" },
    }),
    prisma.officeSpendingEntry.findMany({ where: { organizationId: user.organizationId } }),
    prisma.cateringOrder.findMany({
      where: { organizationId: user.organizationId, approvalStatus: "PENDING" },
      include: { account: true, booking: { include: { representative: true } } },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    prisma.policyExceptionRequest.findMany({
      where: { organizationId: user.organizationId },
      include: { requestedBy: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.territory.findMany({
      where: { organizationId: user.organizationId },
      include: { assignments: { include: { user: true } }, accounts: { select: { id: true } } },
    }),
  ]);
  const summary = summarizeSpending(
    spending.map((row) => ({
      kind: row.kind === "recorded" ? "recorded" : "commitment",
      amountCents: row.amountCents,
      occurredOn: row.occurredOn,
      bookingId: row.bookingId,
    })),
    now.getUTCFullYear(),
  );
  const visitsByUser = new Map<string, number>();
  for (const visit of visits) {
    visitsByUser.set(visit.userId, (visitsByUser.get(visit.userId) ?? 0) + 1);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-5">
      <h1 className="text-2xl font-semibold">Team</h1>
      {notice ? <p className="rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-slate-200">{notice}</p> : null}
      <p className="text-sm text-[#66758B]">Coverage and workload for {user.organizationName}. Referral counts are not shown.</p>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Active offices" value={String(accounts)} />
        <Stat label="Open follow-ups" value={String(tasks)} />
        <Stat label="Recorded spending" value={formatCents(summary.recordedYearToDateCents)} />
        <Stat label="Commitments" value={formatCents(summary.upcomingCommitmentCents)} />
      </div>
      <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <h2 className="font-semibold">Roster</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {members.map((member) => (
            <li key={member.id}>
              <p className="font-medium">{member.user.name}</p>
              <p className="text-[#66758B]">{member.role.name} · {visitsByUser.get(member.userId) ?? 0} check-ins this month</p>
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <h2 className="font-semibold">Territories</h2>
        {territories.length === 0 ? <p className="mt-2 text-sm text-[#66758B]">No territories assigned.</p> : null}
        <ul className="mt-2 space-y-2 text-sm">
          {territories.map((territory) => (
            <li key={territory.id}>
              <p className="font-medium">{territory.name}</p>
              <p className="text-[#66758B]">{territory.accounts.length} offices · {territory.assignments.map((item) => item.user.name).join(", ") || "Unassigned"}</p>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="text-sm font-semibold">Upcoming lunches</h2>
        <ul className="mt-2 space-y-2">
          {lunches.map((lunch) => (
            <li key={lunch.id} className="rounded-2xl bg-white p-4 text-sm ring-1 ring-slate-200">
              <p className="font-medium">{lunch.account.name}</p>
              <p className="text-[#66758B]">{lunch.representative.name} · {formatWhen(lunch.slotStartsAt, lunch.timezone)}</p>
              <p className="capitalize">{lunch.status.replaceAll("_", " ").toLowerCase()}{lunch.confirmedAt ? "" : " · waiting on the office"}</p>
              <Link className="underline" href={`/lunches/${lunch.id}`}>Open</Link>
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <h2 className="font-semibold">Catering approvals</h2>
        <p className="mt-1 text-xs text-[#66758B]">A catering decision is separate from the lunch time. Approving it does not place or pay for an order.</p>
        {cateringRequests.length === 0 ? <p className="mt-2 text-sm text-[#66758B]">No catering requests are waiting.</p> : null}
        <ul className="mt-3 space-y-3">
          {cateringRequests.map((order) => {
            const ownLunch = order.booking.representativeId === user.id;
            const lunchReady = ["SCHEDULED", "CONFIRMED", "CHANGE_REQUESTED", "COMPLETED"].includes(order.booking.status);
            return (
              <li key={order.id} className="text-sm">
                <p className="font-medium">{order.account.name}</p>
                <p className="text-[#66758B]">{order.booking.representative.name} · lunch {order.booking.status.replaceAll("_", " ").toLowerCase()} · {order.estimatedAmountCents != null ? formatCents(order.estimatedAmountCents) : "No estimate"}</p>
                {canReviewCompliance(user.roleKey) || user.roleKey === "MANAGER" ? (
                  ownLunch || !lunchReady ? (
                    <p className="mt-1 text-xs">{ownLunch ? "You own this lunch, so someone else reviews the catering." : "The lunch time is still waiting for the representative."}</p>
                  ) : (
                    <form action={decideCateringAction} className="mt-2 grid gap-2">
                      <input type="hidden" name="bookingId" value={order.bookingId} />
                      <input name="note" placeholder="Review note" className="h-11 rounded-xl border px-3" />
                      <div className="grid grid-cols-2 gap-2">
                        <button name="decision" value="approve" className="h-11 rounded-xl bg-[#10263E] text-white" type="submit">Approve catering</button>
                        <button name="decision" value="decline" className="h-11 rounded-xl bg-white ring-1 ring-slate-200" type="submit">Decline</button>
                      </div>
                    </form>
                  )
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
      <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <h2 className="font-semibold">Policy exceptions</h2>
        <p className="mt-1 text-xs text-[#66758B]">{EXCEPTION_LIMIT}</p>
        {exceptions.length === 0 ? <p className="mt-2 text-sm text-[#66758B]">No exception requests.</p> : null}
        <ul className="mt-3 space-y-3">
          {exceptions.map((request) => (
            <li key={request.id} className="text-sm">
              <p className="font-medium capitalize">{request.status}{request.prohibited ? " · prohibited" : ""}</p>
              <p>{request.reason}</p>
              <p className="text-xs text-[#66758B]">{request.requestedBy.name}</p>
              {canReviewCompliance(user.roleKey) && request.status === "pending" ? (
                <form action={reviewExceptionAction} className="mt-2 grid gap-2">
                  <input type="hidden" name="requestId" value={request.id} />
                  <input name="note" placeholder="Review note" className="h-11 rounded-xl border px-3" />
                  <div className="grid grid-cols-2 gap-2">
                    <button name="decision" value="approve" className="h-11 rounded-xl bg-[#10263E] text-white" type="submit" disabled={request.prohibited}>Approve</button>
                    <button name="decision" value="deny" className="h-11 rounded-xl bg-white ring-1 ring-slate-200" type="submit">Deny</button>
                  </div>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <p className="text-xl font-semibold">{value}</p>
      <p className="text-xs text-[#66758B]">{label}</p>
    </div>
  );
}
