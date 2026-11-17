import Link from "next/link";
import { connection } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logoutAction } from "@/lib/actions";
import { formatCents } from "@/lib/domain/spending";
import { integrationStatus } from "@/lib/integrations/status";
import { DELETION_OPERATOR_EMAIL } from "@/lib/legal";
import { trialDaysRemaining } from "@/lib/domain/subscription-trial";

export const instant = false;
export const metadata = { title: "Platform" };

export default async function PlatformPage() {
  await connection();
  const user = await requirePlatformAdmin();
  const organizations = await prisma.organization.findMany({
    include: { subscription: true, memberships: true },
    orderBy: { name: "asc" },
  });

  const trials = organizations.filter(org => org.subscription?.stripeSubscriptionId && org.subscription.status === "trialing").length;
  const paying = organizations.filter(org => org.subscription?.stripeSubscriptionId && org.subscription.status === "active").length;
  const monthlyRecurringCents = organizations.reduce((sum, org) => sum + (org.subscription?.stripeSubscriptionId && org.subscription.status === "active" ? org.subscription.priceMonthlyCents ?? 0 : 0), 0);

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[#10263E]">RepPilot platform</p>
          <h1 className="text-2xl font-semibold">{user.name}</h1>
          <Link href="/platform/deletion-requests" className="inline-flex min-h-11 items-center rounded-xl border bg-white px-4 text-sm font-medium">Account deletion requests</Link>
        </div>
        <form action={logoutAction}>
          <button className="text-sm underline" type="submit">Sign out</button>
        </form>
      </div>
      <p className="mt-3 text-sm text-[#66758B]">
        This surface lists organizations and plan labels. It does not open representative notes, clinic links, or office records. Account-deletion cleanup is assigned to {DELETION_OPERATOR_EMAIL}.
      </p>
      <section className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <h2 className="font-semibold">Subscribers</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <p><strong className="block text-xl">{trials}</strong>Trials</p>
          <p><strong className="block text-xl">{paying}</strong>Active Stripe subscriptions</p>
          <p><strong className="block text-xl">{formatCents(monthlyRecurringCents)}</strong>Estimated monthly recurring value</p>
        </div>
        <Link href="/api/platform/subscribers/export" className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-[#10263E] px-4 text-sm font-medium text-white">Download subscriber CSV</Link>
        <p className="mt-2 text-xs text-[#66758B]">Counts use last synchronized Stripe subscription status. An active Stripe subscription does not prove a successful payment. Values are estimates, not collected revenue. CSV includes trials, start/end dates and recurring amounts.</p>
      </section>
      <IntegrationStatus />
      <ul className="mt-4 space-y-2">
        {organizations.map((organization) => (
          <li key={organization.id} className="rounded-2xl bg-white p-4 text-sm ring-1 ring-slate-200">
            <p className="font-medium">{organization.name}</p>
            <p className="text-[#66758B]">
              {organization.memberships.length} people ·               {organization.subscription?.plan ?? "no plan"} · {organization.subscription?.status ?? "none"}
              {organization.subscription?.stripeSubscriptionId && organization.subscription.priceMonthlyCents != null ? ` · ${formatCents(organization.subscription.priceMonthlyCents)} / month` : ""}
            </p>
            <p className="text-xs">{organization.isDemo ? "Demonstration data" : "Customer organization"} · {organization.subscription?.stripeSubscriptionId ? "Stripe subscription linked" : "No verified Stripe subscription"}</p>
            {organization.subscription?.trialStart ? <p className="text-xs">Trial began: {organization.subscription.trialStart.toISOString().slice(0, 10)} (UTC)</p> : null}
            {organization.subscription?.trialEnd ? <p className="text-xs">Trial converts or ends: {organization.subscription.trialEnd.toISOString().slice(0, 10)} (UTC){organization.subscription.status === "trialing" ? ` · ${trialDaysRemaining(organization.subscription.trialEnd)} day(s) remaining` : ""}</p> : null}
          </li>
        ))}
      </ul>
    </main>
  );
}

function IntegrationStatus() {
  const status = integrationStatus();
  const rows = [
    ["Google Calendar", status.googleCalendar],
    ["Microsoft 365", status.microsoftCalendar],
    ["Email delivery", status.email],
    ["Map search and drive time", status.mapsServer],
    ["Google map tiles", status.mapsBrowser],
    ["Briefing polish", status.gemini],
    ["CRM referral sync", status.crm],
    ["Card billing", status.billing],
  ] as const;
  return <section className="mt-6 rounded-2xl bg-white p-4 text-sm ring-1 ring-slate-200">
    <h2 className="font-medium">Launch connections</h2>
    <p className="mt-1 text-[#66758B]">Configured means the secret is present. It does not mean a live provider call succeeded. Billing requires verified test checkouts and webhooks before launch.</p>
    <ul className="mt-3 space-y-1">
      {rows.map(([label, on]) => <li key={label}>{label}: {on ? "configured" : "not connected"}</li>)}
    </ul>
  </section>;
}
