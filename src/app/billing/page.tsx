import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canManageOrg } from "@/lib/permissions";
import { SUPPORT_MAILTO } from "@/lib/legal";
import { AppShell } from "@/components/shell/app-shell";
import { PageFrame } from "@/components/ui/page";

export const instant = false;
export const metadata = { title: "Billing" };

export default async function BillingPage() {
  await connection();
  const user = await getCurrentUser({ allowExpiredTrial: true });
  if (user.roleKey === "PLATFORM_ADMIN") redirect("/platform");
  if (!canManageOrg(user.roleKey)) redirect("/trial-ended");
  const subscription = await prisma.subscription.findUnique({ where: { organizationId: user.organizationId } });
  const expired = user.trialDaysLeft === 0;
  const trial = user.trialDaysLeft !== null;
  const formatDate = (date: Date) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: user.timezone }).format(date);
  return <AppShell allowExpiredTrial><PageFrame title="Billing" subtitle={`Plan and trial details for ${user.organizationName}.`}>
    <div className="grid max-w-4xl gap-5 lg:grid-cols-[1.3fr_1fr]">
      <section aria-labelledby="plan-heading" className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="plan-heading" className="text-base font-semibold">Your subscription</h2><span className={`rounded-md px-2.5 py-1 text-xs font-medium ${expired ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-900"}`}>{expired ? "Trial ended" : trial ? "Free trial" : "Active"}</span></div>
        <p className="mt-5 text-2xl font-semibold">{trial ? "14-day free trial" : subscription?.plan || "Subscription"}</p>
        <p className="mt-2 text-sm text-slate-600">{expired ? "Your free workspace access has ended. Contact billing support to arrange continued access." : trial ? `${user.trialDaysLeft} ${user.trialDaysLeft === 1 ? "day" : "days"} remaining. No credit card required and no automatic charge.` : "Your organization has active workspace access."}</p>
        <dl className="mt-6 divide-y divide-slate-100 text-sm">
          <div className="flex justify-between gap-4 py-3"><dt className="text-slate-500">Plan</dt><dd className="font-medium capitalize">{subscription?.plan || "Not assigned"}</dd></div>
          {trial ? <div className="flex justify-between gap-4 py-3"><dt className="text-slate-500">Trial price</dt><dd className="font-medium">$0</dd></div> : null}
          {subscription?.trialStartedAt ? <div className="flex flex-wrap justify-between gap-2 py-3"><dt className="text-slate-500">Trial started</dt><dd>{formatDate(subscription.trialStartedAt)}</dd></div> : null}
          {subscription?.trialEndsAt ? <div className="flex flex-wrap justify-between gap-2 py-3"><dt className="text-slate-500">Trial ends</dt><dd>{formatDate(subscription.trialEndsAt)}</dd></div> : null}
          <div className="flex justify-between gap-4 py-3"><dt className="text-slate-500">Time zone</dt><dd>{user.timezone}</dd></div>
        </dl>
        <p className="mt-4 text-xs leading-5 text-slate-500">Trial expiry pauses workspace access. It does not delete your account or organization records.</p>
      </section>
      <div className="space-y-5">
        <section aria-labelledby="payments-heading" className="rounded-xl border border-slate-200 bg-white p-6"><h2 id="payments-heading" className="font-semibold">Payments & invoices</h2><p className="mt-3 text-sm leading-6 text-slate-600">Online checkout and the Stripe payment portal are not enabled in this app yet. Payment methods and invoice history will appear here once billing is connected.</p><p className="mt-3 text-sm leading-6 text-slate-600">No payment is scheduled automatically at the end of your trial.</p><a className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-[#087f5b] px-4 text-sm font-medium text-white" href={`${SUPPORT_MAILTO}?subject=RepPilot%20billing`}>Contact billing support</a></section>
        <section className="rounded-xl border border-slate-200 bg-white p-6"><h2 className="font-semibold">Account options</h2><div className="mt-3 flex flex-col items-start gap-3 text-sm"><a className="underline underline-offset-4" href="/api/reports/spending">Export spending report</a><Link className="underline underline-offset-4" href="/delete-account/confirm">Request account deletion</Link></div></section>
      </div>
    </div>
  </PageFrame></AppShell>;
}
