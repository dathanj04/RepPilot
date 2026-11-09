import Link from "next/link";
import { connection } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DELETION_OPERATOR_EMAIL, DELETION_PROCESSING_DAYS, SUPPORT_MAILTO } from "@/lib/legal";
import { deletionDueAt, formatDeletionDueDate } from "@/lib/privacy/deadlines";
import { fulfillDeletionRequestAction } from "@/lib/privacy/actions";
import { isDeletedAccount } from "@/lib/privacy/deletion";

export const instant = false;
export const metadata = { title: "Account deletion requests" };

export default async function DeletionQueuePage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  await connection();
  await requirePlatformAdmin();
  const { notice } = await searchParams;
  const requests = await prisma.accountDeletionRequest.findMany({ orderBy: { requestedAt: "asc" }, take: 100 });
  const users = await prisma.user.findMany({
    where: { id: { in: requests.map((request) => request.userId) } },
    select: { id: true, name: true, email: true },
  });
  const now = new Date();
  const byId = new Map(users.map((user) => [user.id, user]));
  const pending = requests.filter((request) => request.status !== "COMPLETED");
  return <main className="mx-auto max-w-4xl space-y-5 px-6 py-10">
    <Link className="underline" href="/platform">Back to platform</Link>
    <h1 className="text-3xl font-semibold">Account deletion requests</h1>
    <p className="text-sm text-slate-600">Assigned operator: <a className="underline" href={SUPPORT_MAILTO}>{DELETION_OPERATOR_EMAIL}</a>. Password-confirmed requests erase sign-in and personal records immediately. This queue is for retries and requests that arrive by email. Backup copies and data held by email or calendar providers still have to be cleared within {DELETION_PROCESSING_DAYS} days.</p>
    {notice ? <p role="status" className="rounded-xl bg-slate-100 p-4">{notice}</p> : null}
    {pending.length === 0 ? <p>No pending requests.</p> : <ul className="space-y-3">{pending.map((request) => {
      const account = byId.get(request.userId);
      const overdue = deletionDueAt(request.requestedAt) < now;
      return <li className="rounded-xl border bg-white p-5" key={request.id}>
        <h2 className="font-semibold">{account?.name ?? "Account no longer present"}</h2>
        {account && !isDeletedAccount(account) ? <p>{account.email}</p> : null}
        <p className={overdue ? "font-semibold text-red-700" : "text-sm text-slate-600"}>Due {formatDeletionDueDate(request.requestedAt)} (UTC){overdue ? " — Overdue" : ""}</p>
        <p className="text-sm text-slate-600">{request.id} · {request.requestedAt.toISOString()} · {request.status}</p>
        <form action={fulfillDeletionRequestAction} className="mt-3 space-y-3">
          <input type="hidden" name="requestId" value={request.id} />
          <label className="flex items-start gap-3 text-sm"><input name="verified" type="checkbox" required className="mt-1" /><span>I verified that this person owns the account.</span></label>
          <button className="min-h-11 rounded-xl bg-red-700 px-4 font-semibold text-white" type="submit">Erase sign-in and personal records</button>
        </form>
      </li>;
    })}</ul>}
    <section className="space-y-3 rounded-xl border bg-white p-5">
      <h2 className="text-lg font-semibold">Erase an account from a support email</h2>
      <p className="text-sm text-slate-600">Use this when the person cannot sign in. Match the email they sent. Do not ask them to send a password.</p>
      <form action={fulfillDeletionRequestAction} className="space-y-3">
        <label className="block text-sm font-medium" htmlFor="deletion-email">Account email</label>
        <input id="deletion-email" name="email" type="email" required autoComplete="off" className="h-12 w-full rounded-xl border px-3" />
        <label className="flex items-start gap-3 text-sm"><input name="verified" type="checkbox" required className="mt-1" /><span>I verified that this person owns the account.</span></label>
        <button className="min-h-11 rounded-xl bg-[#10263E] px-4 font-semibold text-white" type="submit">Erase this account</button>
      </form>
    </section>
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">Completed</h2>
      <ul className="space-y-2 text-sm text-slate-600">
        {requests.filter((request) => request.status === "COMPLETED").map((request) => <li key={request.id}>{request.id} · completed {request.completedAt?.toISOString() ?? "time unavailable"}</li>)}
      </ul>
    </section>
  </main>;
}
