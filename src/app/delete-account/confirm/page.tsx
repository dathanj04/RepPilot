import { connection } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requestAccountDeletionAction } from "@/lib/privacy/actions";
import { PublicPage } from "@/components/legal/public-page";

import { DELETION_PROCESSING_DAYS } from "@/lib/legal";
import { formatDeletionDueDate } from "@/lib/privacy/deadlines";

export const instant = false;
export const metadata = { title: "Confirm account deletion request" };

export default async function ConfirmDeletionPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  await connection();
  const user = await getCurrentUser({ allowExpiredTrial: true });
  const { notice } = await searchParams;
  const request = await prisma.accountDeletionRequest.findUnique({ where: { userId: user.id } });
  return <PublicPage title="Request account deletion">
    <p>You are requesting deletion for <strong>{user.email}</strong>. This applies to your account and associated personal data, not other organization members’ accounts.</p>
    {notice ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{notice}</p> : null}
    {request ? <div role="status" className="space-y-2 rounded-xl bg-emerald-50 p-5 text-emerald-950">
      <h2 className="text-lg font-semibold">{request.status === "COMPLETED" ? "Request marked completed" : "Deletion request received"}</h2>
      <p>Reference: {request.id}</p><p>Submitted {request.requestedAt.toISOString().slice(0, 10)} (UTC).</p>
      {request.status !== "COMPLETED" ? <p>Your request is recorded and still pending. Expected completion by {formatDeletionDueDate(request.requestedAt)} (UTC), within {DELETION_PROCESSING_DAYS} days. Sign-in has not been removed yet.</p> : <p>Sign-in and personal records for this account have been removed. Organization records may remain under the name Deleted user.</p>}
    </div> : <form action={requestAccountDeletionAction} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      <label className="block font-medium" htmlFor="deletion-password">Current password</label>
      <input id="deletion-password" name="password" type="password" autoComplete="current-password" maxLength={1024} required className="h-12 w-full rounded-xl border border-slate-300 px-3" />
      <label className="flex items-start gap-3"><input name="confirmed" type="checkbox" required className="mt-2 size-4 shrink-0" /><span>I want to delete my RepPilot sign-in and associated personal data. Organization visit and spending records can remain under the name Deleted user. Backup and provider cleanup can take up to {DELETION_PROCESSING_DAYS} days.</span></label>
      <button type="submit" className="min-h-12 rounded-xl bg-red-700 px-5 font-semibold text-white hover:bg-red-800">Delete my account</button>
    </form>}
    <p>Processing includes account and content review, provider-held data, and any justified retention. Verified requests are processed within {DELETION_PROCESSING_DAYS} days. You do not need to email support to submit this form.</p>
  </PublicPage>;
}
