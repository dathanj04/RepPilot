import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatCents } from "@/lib/domain/spending";
import { formatWhen } from "@/lib/format";
import { CATERING_PROVIDERS } from "@/lib/domain/catalog";
import { previewBookingPolicy } from "@/lib/services/orders";
import { canRecordOrder } from "@/lib/domain/policy";
import { exceptionAction, handoffAction, recordOrderAction, requestCateringAction } from "@/lib/actions";
import { MENU_UNAVAILABLE, budgetRemainingCents, cateringGates } from "@/lib/domain/catering";
import { approveLunchAction } from "@/lib/meetings/actions";
import { EXCEPTION_LIMIT, LEGALITY_FOOTER } from "@/lib/domain/policy";
import { canReviewCompliance } from "@/lib/permissions";
import { revealToken } from "@/lib/services/links";
import { PageFrame } from "@/components/ui/page";

export const instant = false;

export default async function LunchDetailPage({
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
  const lunch = await prisma.lunchBooking.findFirst({
    where: { id, organizationId: user.organizationId },
    include: {
      account: true,
      order: {
        include: {
          receipts: {
            select: { id: true, note: true, reference: true, amountCents: true, createdAt: true, fileName: true, contentType: true, byteSize: true },
            orderBy: { createdAt: "desc" },
          },
        },
      },
      reminders: { orderBy: { scheduledFor: "asc" } },
      changeRequests: { orderBy: { createdAt: "desc" } },
      spending: true,
      secureLinks: true,
    },
  });
  if (!lunch) notFound();
  const attendees = lunch.confirmedAttendees ?? lunch.expectedAttendees;
  const amountCents = lunch.order?.finalAmountCents ?? lunch.order?.estimatedAmountCents ?? lunch.estimatedBudgetCents ?? 0;
  const preview = await previewBookingPolicy(prisma, {
    organizationId: user.organizationId,
    bookingId: lunch.id,
    orderTotalCents: amountCents,
    attendees,
  });
  const exception = await prisma.policyExceptionRequest.findFirst({
    where: { organizationId: user.organizationId, bookingId: lunch.id },
    orderBy: { createdAt: "desc" },
  });
  const approvals = await prisma.approval.findMany({
    where: {
      organizationId: user.organizationId,
      OR: [
        { subjectType: "LunchBooking", subjectId: lunch.id },
        ...(lunch.order ? [{ subjectType: "CateringOrder", subjectId: lunch.order.id }] : []),
        ...(exception ? [{ subjectType: "PolicyExceptionRequest", subjectId: exception.id }] : []),
      ],
    },
    orderBy: { createdAt: "asc" },
  });
  const policyGate = canRecordOrder({
    decision: preview.decision,
    exceptionStatus: (exception?.status as "approved" | "pending" | "denied" | "prohibited" | undefined) ?? "none",
  });
  const approvalGate = cateringGates({
    lunchStatus: lunch.status,
    approvalStatus: lunch.order?.approvalStatus ?? "NOT_REQUESTED",
  });
  const gate = approvalGate.reason
    ? { allowed: false, reason: approvalGate.reason }
    : policyGate;
  const remaining = budgetRemainingCents(
    preview.policy?.perPersonCapCents ?? null,
    attendees,
    lunch.order?.estimatedAmountCents ?? lunch.estimatedBudgetCents,
  );
  const confirmLink = lunch.secureLinks.find((link) => link.purpose === "lunch_confirmation" && !link.revokedAt);
  let confirmPath = "";
  if (confirmLink) {
    try { confirmPath = `/l/c/${revealToken(confirmLink.tokenCiphertext)}`; } catch { confirmPath = ""; }
  }

  return (
    <PageFrame title="Lunch order" subtitle={`${lunch.account.name} · ${formatWhen(lunch.slotStartsAt, lunch.timezone)}`} action={<Link href={`/accounts/${lunch.accountId}`} className="inline-flex h-11 items-center rounded-xl px-4 text-sm font-medium ring-1 ring-slate-200">Office</Link>}>
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 lg:col-span-2">
        {notice ? <p className="mb-2 rounded-xl bg-[#F5F7FA] px-3 py-2 text-sm">{notice}</p> : null}
        <p className="font-medium text-[#10263E]">{formatWhen(lunch.slotStartsAt, lunch.timezone)}</p>
        <p className="text-sm capitalize text-[#66758B]">{lunch.status.replaceAll("_", " ").toLowerCase()} · {lunch.confirmedAt ? `Confirmed ${formatWhen(lunch.confirmedAt, lunch.timezone)}` : "Not confirmed by the office"}</p>
        {lunch.status === "AWAITING_APPROVAL" ? (
          <form action={approveLunchAction} className="mt-3">
            <input type="hidden" name="bookingId" value={lunch.id} />
            <button className="h-11 rounded-xl bg-[#19B78A] px-4 text-sm font-semibold text-[#06281f]" type="submit">Approve this lunch</button>
            <p className="mt-2 text-xs text-[#66758B]">The office requested a time you offered. Approving places it on your RepPilot calendar. It is only a tentative hold until then.</p>
          </form>
        ) : null}
        <p className="mt-1 text-sm">{lunch.purpose}</p>
        <p className="mt-2 text-sm">Attendance: {lunch.confirmedAttendees != null ? `${lunch.confirmedAttendees} confirmed` : `${lunch.expectedAttendees} expected`} · Spend on file: {formatCents(amountCents)}</p>
      </section>
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h2 className="font-semibold text-[#10263E]">Reminder timeline</h2>
        <ol className="mt-3 space-y-3 border-l-2 border-[#19B78A] pl-4 text-sm">
          {lunch.reminders.map((reminder) => (
            <li key={reminder.id}>
              <p className="font-medium capitalize">{reminder.kind.replaceAll("_", " ").toLowerCase()}</p>
              <p className="text-[#66758B]">{reminder.status.toLowerCase()} · {formatWhen(reminder.scheduledFor, lunch.timezone)}</p>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-xs text-[#66758B]">A missing 48-hour confirmation does not cancel the lunch.</p>
        {confirmPath ? <Link className="text-sm underline" href={confirmPath}>Office confirmation link</Link> : null}
      </section>
      {lunch.changeRequests.length > 0 ? (
        <section className="rounded-2xl bg-[#FFF7E8] p-4 text-sm">
          <h2 className="font-semibold">Office requests</h2>
          {lunch.changeRequests.map((request) => <p key={request.id} className="mt-1">{request.message}</p>)}
        </section>
      ) : null}
      <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <h2 className="font-semibold">Meal compliance & order review</h2>
        <p className="text-sm">Office: {lunch.account.name}</p>
        <p className="text-sm">Sponsor: {user.organizationName}</p>
        <p className="mt-2 text-sm">Order total: {formatCents(amountCents)} · Eligible attendees: {attendees} · Cost per attendee: {preview.decision.perPersonCents != null ? formatCents(preview.decision.perPersonCents) : "—"}</p>
        <p className="text-sm">Internal company policy cap: {preview.policy ? formatCents(preview.policy.perPersonCapCents) : "Not configured"}</p>
        <ul className="mt-2 space-y-1 text-sm">
          {preview.decision.findings.map((finding) => <li key={finding.code + finding.message}>{finding.message}</li>)}
        </ul>
        <p className="mt-2 text-xs">{preview.decision.disclaimer}</p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <Status label="Meeting approval" value={lunch.purpose.length > 8 ? "Documented" : "Missing"} />
          <Status label="Budget review" value={gate.allowed ? "Clear" : "Blocked"} />
          <Status label="Compliance review" value={preview.decision.result} />
          <Status label="Policy exception" value={exception?.status ?? "None"} />
          <Status label="Order submission" value={gate.allowed ? "Eligible" : "SUBMISSION BLOCKED"} />
        </div>
        <p className="mt-3 text-xs">Educational purpose — {lunch.purpose.length > 8 ? "Documented" : "Missing"}</p>
        <p className="text-xs">Referral-linked meal eligibility — Not permitted</p>
        <p className="text-xs">Entertainment — Disabled in this product</p>
        <p className="mt-2 text-sm">Budget remaining against the internal cap: {remaining == null ? "Not calculated until a policy and an estimate exist" : formatCents(remaining)}</p>
        <p className="mt-2 text-xs text-[#66758B]">{LEGALITY_FOOTER}</p>
        <p className="mt-2 text-xs">{EXCEPTION_LIMIT}</p>
        {!gate.allowed ? (
          <form action={exceptionAction} className="mt-3 grid gap-2">
            <input type="hidden" name="bookingId" value={lunch.id} />
            <input type="hidden" name="amount" value={String(amountCents / 100)} />
            <input type="hidden" name="attendees" value={String(attendees)} />
            <textarea name="reason" required placeholder="Why should this internal cap exception be reviewed?" className="rounded-xl border p-3 text-sm" />
            <button className="h-11 rounded-xl bg-[#10263E] text-sm text-white" type="submit">Request policy exception</button>
          </form>
        ) : null}
        {canReviewCompliance(user.roleKey) && exception?.status === "pending" ? (
          <p className="mt-2 text-xs">Review this request on the team page.</p>
        ) : null}
      </section>
      <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <h2 className="font-semibold">Order catering</h2>
        <p className="text-sm text-[#66758B]">Confirmed attendees: {lunch.confirmedAttendees ?? "Not confirmed"} · Office confirmation: {lunch.confirmedAt ? "Confirmed" : "Waiting"}</p>
        <p className="mt-1 text-sm">Catering approval: {(lunch.order?.approvalStatus ?? "NOT_REQUESTED").replaceAll("_", " ").toLowerCase()}</p>
        <p className="mt-1 text-xs">{MENU_UNAVAILABLE}</p>
        <p className="mt-1 text-xs">RepPilot does not place or pay for the order. A provider link opens only after catering is approved, and opening it does not mark the order complete.</p>
        {lunch.order?.approvalStatus === "NOT_REQUESTED" && approvalGate.meetingApproved && user.id === lunch.representativeId ? (
          <form action={requestCateringAction} className="mt-3 grid gap-2">
            <input type="hidden" name="bookingId" value={lunch.id} />
            <input name="attendees" type="number" min={1} defaultValue={attendees} className="h-11 rounded-xl border px-3" required />
            <input name="estimate" type="number" min={0} step="0.01" placeholder="Estimated total you expect ($)" className="h-11 rounded-xl border px-3" />
            <input name="dietary" placeholder="Dietary notes the office volunteered" defaultValue={lunch.mealPreferences ?? ""} className="h-11 rounded-xl border px-3" />
            <input name="deliveryInstructions" placeholder="Delivery instructions" defaultValue={lunch.deliveryInstructions ?? ""} className="h-11 rounded-xl border px-3" />
            <button className="h-11 rounded-xl bg-[#10263E] text-sm text-white" type="submit">Submit catering for approval</button>
          </form>
        ) : null}
        {lunch.order?.approvalStatus === "PENDING" ? (
          <p className="mt-2 text-sm">
            {approvalGate.meetingApproved
              ? "Waiting for a manager or compliance reviewer. The representative on this lunch cannot approve the catering."
              : "The office asked for catering. Approve the lunch time first. Catering still needs a separate reviewer, and no order is placed."}
          </p>
        ) : null}
        {lunch.order?.approvalStatus === "DECLINED" && user.id === lunch.representativeId ? <p className="mt-2 text-sm">Catering was declined. Submit it again only if the plan changed. No order was placed.</p> : null}
        {lunch.order?.approvalStatus === "DECLINED" && user.id === lunch.representativeId ? (
          <form action={requestCateringAction} className="mt-3 grid gap-2">
            <input type="hidden" name="bookingId" value={lunch.id} />
            <input name="attendees" type="number" min={1} defaultValue={attendees} className="h-11 rounded-xl border px-3" required />
            <input name="estimate" type="number" min={0} step="0.01" placeholder="Estimated total ($)" className="h-11 rounded-xl border px-3" />
            <input name="dietary" placeholder="Dietary notes" defaultValue={lunch.mealPreferences ?? ""} className="h-11 rounded-xl border px-3" />
            <input name="deliveryInstructions" placeholder="Delivery instructions" defaultValue={lunch.deliveryInstructions ?? ""} className="h-11 rounded-xl border px-3" />
            <button className="h-11 rounded-xl bg-[#10263E] text-sm text-white" type="submit">Submit catering again</button>
          </form>
        ) : null}
        {gate.allowed ? (
          <div className="mt-3 grid gap-3">
            {CATERING_PROVIDERS.map((provider) => provider.live ? (
              <div key={provider.id} className="rounded-xl bg-[#F5F7FA] p-3">
                <a className="grid h-12 place-items-center rounded-xl bg-[#10263E] text-sm font-medium text-white" href={provider.url} target="_blank" rel="noreferrer">
                  {provider.label}
                </a>
                <p className="mt-2 text-xs text-[#66758B]">Opens the official {provider.label.replace("Order with ", "")} website. RepPilot does not place or pay for the order.</p>
                <form action={handoffAction} className="mt-2">
                  <input type="hidden" name="bookingId" value={lunch.id} />
                  <input type="hidden" name="vendor" value={provider.id} />
                  <button className="text-sm underline" type="submit">Mark as ordering externally</button>
                </form>
              </div>
            ) : (
              <p key={provider.id} className="rounded-xl bg-slate-100 px-3 py-2 text-sm">Uber Eats is reserved for a later approved integration and is not connected.</p>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-xl bg-slate-100 px-3 py-2 text-sm">Provider links stay closed until the lunch and the catering request are both approved. {gate.reason}</p>
        )}
        <p className="mt-2 text-xs">Current order status: {lunch.order?.status.replaceAll("_", " ") ?? "Not started"}. Delivery status: {(lunch.order?.deliveryStatus ?? "NOT_TRACKED").replaceAll("_", " ").toLowerCase()}. RepPilot does not track a driver.</p>
      </section>
      <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <h2 className="font-semibold">Record the external order</h2>
        <form action={recordOrderAction} className="mt-3 grid gap-2">
          <input type="hidden" name="bookingId" value={lunch.id} />
          <select name="vendor" defaultValue={lunch.order?.vendor ?? "ezcater"} className="h-11 rounded-xl border px-3">
            <option value="ezcater">ezCater</option>
            <option value="doordash">DoorDash</option>
            <option value="other">Other</option>
          </select>
          <input name="amount" type="number" min="0" step="0.01" placeholder="Final amount ($)" defaultValue={lunch.order?.finalAmountCents ? lunch.order.finalAmountCents / 100 : ""} className="h-11 rounded-xl border px-3" required />
          <input name="attendees" type="number" min="1" defaultValue={attendees} className="h-11 rounded-xl border px-3" />
          <input name="reference" placeholder="Order reference from the provider" defaultValue={lunch.order?.orderReference ?? ""} className="h-11 rounded-xl border px-3" />
          <div className="grid grid-cols-2 gap-2">
            <input name="subtotal" type="number" min="0" step="0.01" placeholder="Subtotal ($)" className="h-11 rounded-xl border px-3" />
            <input name="tax" type="number" min="0" step="0.01" placeholder="Tax ($)" className="h-11 rounded-xl border px-3" />
            <input name="fees" type="number" min="0" step="0.01" placeholder="Fees ($)" className="h-11 rounded-xl border px-3" />
            <input name="delivery" type="number" min="0" step="0.01" placeholder="Delivery ($)" className="h-11 rounded-xl border px-3" />
            <input name="tip" type="number" min="0" step="0.01" placeholder="Tip ($)" className="h-11 rounded-xl border px-3" />
          </div>
          <p className="text-xs text-[#66758B]">Leave the line items blank, or enter all five so they add up to the final amount. RepPilot does not invent tax or a tip.</p>
          <input name="groupOrderUrl" placeholder="Optional group-order URL" defaultValue={lunch.order?.groupOrderUrl ?? ""} className="h-11 rounded-xl border px-3" />
          <select name="deliveryStatus" defaultValue={lunch.order?.deliveryStatus ?? "NOT_TRACKED"} className="h-11 rounded-xl border px-3">
            <option value="NOT_TRACKED">Delivery not tracked</option>
            <option value="RECORDED_BY_REP">Delivery noted by the representative</option>
          </select>
          <textarea name="receiptNote" placeholder="Receipt note" className="rounded-xl border p-3" />
          <input name="receiptFile" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="text-sm" />
          <select name="status" defaultValue={lunch.order?.status === "COMPLETED" ? "COMPLETED" : "ORDER_RECORDED"} className="h-11 rounded-xl border px-3">
            <option value="ORDER_RECORDED">Order recorded</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELED">Canceled</option>
          </select>
          <button disabled={!gate.allowed} className="h-12 rounded-xl bg-[#19B78A] font-semibold text-[#06281f] disabled:cursor-not-allowed disabled:bg-slate-200" type="submit">
            {gate.allowed ? "Record order in RepPilot" : "Record order — blocked"}
          </button>
          {!gate.allowed ? <p className="text-xs text-[#D94B4B]">{gate.reason}</p> : null}
        </form>
        {lunch.order ? (
          <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <div><dt className="text-[#66758B]">Vendor</dt><dd>{lunch.order.vendor ?? "Not recorded"}</dd></div>
            <div><dt className="text-[#66758B]">Status</dt><dd>{lunch.order.status.replaceAll("_", " ")}</dd></div>
            <div><dt className="text-[#66758B]">Estimated</dt><dd>{lunch.order.estimatedAmountCents != null ? formatCents(lunch.order.estimatedAmountCents) : "—"}</dd></div>
            <div><dt className="text-[#66758B]">Final</dt><dd>{lunch.order.finalAmountCents != null ? formatCents(lunch.order.finalAmountCents) : "Not recorded"}</dd></div>
            <div><dt className="text-[#66758B]">Reference</dt><dd>{lunch.order.orderReference ?? "—"}</dd></div>
            <div><dt className="text-[#66758B]">Delivery</dt><dd>{lunch.deliveryInstructions ?? "—"}</dd></div>
            <div><dt className="text-[#66758B]">Subtotal</dt><dd>{lunch.order.subtotalCents != null ? formatCents(lunch.order.subtotalCents) : "—"}</dd></div>
            <div><dt className="text-[#66758B]">Tax</dt><dd>{lunch.order.taxCents != null ? formatCents(lunch.order.taxCents) : "—"}</dd></div>
            <div><dt className="text-[#66758B]">Fees</dt><dd>{lunch.order.feeCents != null ? formatCents(lunch.order.feeCents) : "—"}</dd></div>
            <div><dt className="text-[#66758B]">Delivery charge</dt><dd>{lunch.order.deliveryCents != null ? formatCents(lunch.order.deliveryCents) : "—"}</dd></div>
            <div><dt className="text-[#66758B]">Tip</dt><dd>{lunch.order.tipCents != null ? formatCents(lunch.order.tipCents) : "—"}</dd></div>
          </dl>
        ) : null}
        <h3 className="mt-4 font-medium">Receipts</h3>
        {lunch.order?.receipts.length ? (
          <ul className="mt-2 space-y-2 text-sm">
            {lunch.order.receipts.map((receipt) => (
              <li key={receipt.id} className="rounded-xl bg-[#F5F7FA] p-3">
                <p>{receipt.note || "Receipt on file"}{receipt.amountCents != null ? ` · ${formatCents(receipt.amountCents)}` : ""}</p>
                <p className="text-[#66758B]">{receipt.reference ?? "No reference"}{receipt.fileName ? ` · ${receipt.fileName}` : ""}</p>
                {receipt.fileName ? <a className="underline" href={`/api/receipts/${receipt.id}`}>Download receipt</a> : null}
              </li>
            ))}
          </ul>
        ) : <p className="mt-2 text-sm text-[#66758B]">No receipt is stored yet.</p>}
        <h3 className="mt-4 font-medium">Approval history</h3>
        {approvals.length === 0 ? <p className="mt-2 text-sm text-[#66758B]">No approval decisions yet.</p> : (
          <ol className="mt-2 space-y-2 text-sm">
            {approvals.map((approval) => (
              <li key={approval.id}>{approval.gate} · {approval.status}{approval.note ? ` · ${approval.note}` : ""}</li>
            ))}
          </ol>
        )}
      </section>
    </div>
    </PageFrame>
  );
}

function Status({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-[#F5F7FA] p-2"><p className="text-[#66758B]">{label}</p><p className="font-medium">{value}</p></div>;
}
