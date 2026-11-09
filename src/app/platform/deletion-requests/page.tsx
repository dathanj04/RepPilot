import Link from "next/link";
import { connection } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

import { deletionDueAt, formatDeletionDueDate } from "@/lib/privacy/deadlines";
import { DELETION_PROCESSING_DAYS } from "@/lib/legal";

export const instant = false;
export const metadata = { title: "Account deletion requests" };

export default async function DeletionQueuePage() {
  await connection();
  await requirePlatformAdmin();
  const requests = await prisma.accountDeletionRequest.findMany({ where: { status: "PENDING" }, orderBy: { requestedAt: "asc" }, take: 100 });
  const users = await prisma.user.findMany({ where: { id: { in: requests.map((request) => request.userId) } }, select: { id: true, name: true, email: true } });
  const now = new Date();
  const byId = new Map(users.map((user) => [user.id, user]));
  return <main className="mx-auto max-w-4xl space-y-5 px-6 py-10">
    <Link className="underline" href="/platform">Back to platform</Link>
    <h1 className="text-3xl font-semibold">Account deletion requests</h1>
    <p className="text-sm text-slate-600">Oldest 100 pending requests. Verified requests must be processed within {DELETION_PROCESSING_DAYS} days. This is a processing queue, not evidence of completed deletion. Follow the operator runbook before closing a request.</p>
    {requests.length === 0 ? <p>No pending requests.</p> : <ul className="space-y-3">{requests.map((request) => <li className="rounded-xl border bg-white p-5" key={request.id}>
      <h2 className="font-semibold">{byId.get(request.userId)?.name ?? "Account no longer present"}</h2>
      <p>{byId.get(request.userId)?.email ?? "Review the request record and deletion evidence"}</p>
      <p className={deletionDueAt(request.requestedAt) < now ? "font-semibold text-red-700" : "text-sm text-slate-600"}>Due {formatDeletionDueDate(request.requestedAt)} (UTC){deletionDueAt(request.requestedAt) < now ? " — Overdue" : ""}</p>
      <p className="text-sm text-slate-600">{request.id} · {request.requestedAt.toISOString()} · {request.status}</p>
    </li>)}</ul>}
  </main>;
}
