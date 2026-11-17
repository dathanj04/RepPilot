import Link from "next/link";
import { connection } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { stripeConfigured } from "@/lib/stripe";
import { TrialCheckout } from "@/components/billing/trial-checkout";
import { ManageBillingButton } from "@/components/billing/manage-billing-button";

export const instant = false;
export const metadata = { title: "Setup" };

export default async function OnboardingPage() {
  await connection();
  const user = await requireAppUser();
  const [accounts, territories, calendars, visits, subscription] = await Promise.all([
    prisma.account.count({ where: { organizationId: user.organizationId } }),
    prisma.territory.count({ where: { organizationId: user.organizationId } }),
    prisma.calendarConnection.count({ where: { userId: user.id, status: "connected" } }),
    prisma.accountInteraction.count({ where: { organizationId: user.organizationId, userId: user.id } }),
    prisma.subscription.findUnique({ where: { organizationId: user.organizationId } }),
  ]);
  const steps = [
    { done: true, label: "Account created", href: "/today" },
    { done: true, label: "Organization ready", href: "/admin" },
    { done: territories > 0, label: "Define a territory", href: "/admin" },
    { done: accounts > 0, label: "Add office accounts", href: "/accounts/new" },
    { done: calendars > 0, label: "Connect a calendar (optional)", href: "/calendar" },
    { done: true, label: "Open the map", href: "/map" },
    { done: visits > 0, label: "Complete a first check-in", href: "/accounts" },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-5">
      <h1 className="text-2xl font-semibold">Get started</h1>
      <p className="mt-2 text-sm text-[#66758B]">Maps, AI, email, and calendars work in a limited mode until their credentials are added. You can still add offices and check in.</p>
      {user.roleKey === "ORG_ADMIN" ? (subscription?.stripeSubscriptionId ? (
        <section className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <h2 className="font-semibold">Your subscription</h2>
          <p className="mt-1 text-sm">Status: {subscription.status}. Plan: {subscription.plan}.</p>
          {subscription.trialEnd ? <p className="text-sm">Trial ends: {subscription.trialEnd.toLocaleDateString("en-US", { timeZone: "UTC", dateStyle: "long" })} (UTC)</p> : null}
          {subscription.stripeCustomerId ? <ManageBillingButton /> : null}
        </section>
      ) : <div className="mt-4"><TrialCheckout enabled={stripeConfigured()} /></div>) : null}
      <ol className="mt-4 space-y-2">
        {steps.map((step, index) => (
          <li key={step.label}>
            <Link href={step.href} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200">
              <span>{index + 1}. {step.label}</span>
              <span className={`text-xs font-medium ${step.done ? "text-[#19B78A]" : "text-[#66758B]"}`}>{step.done ? "Done" : "Open"}</span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
