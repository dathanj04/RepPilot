/**
 * Stripe is the source of truth for billing. These helpers format a verified
 * server-side subscription snapshot; they do not create or charge subscriptions.
 */
export type SubscriptionSnapshot = {
  organizationId: string;
  organizationName: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  plan: string;
  status: string;
  priceMonthlyCents: number | null;
  trialStartUnix: number | null;
  trialEndUnix: number | null;
  currentPeriodEndUnix: number | null;
  cancelAtPeriodEnd: boolean;
};

export type SubscriptionReportRow = {
  organizationId: string;
  organizationName: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  plan: string;
  status: string;
  monthlyAmountUsd: string;
  trialStartedAt: string;
  trialEndsAt: string;
  nextBillingDate: string;
  cancelAtPeriodEnd: string;
};

function isoDate(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return "";
  const date = new Date(seconds * 1000);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

export function toSubscriptionReportRow(subscription: SubscriptionSnapshot): SubscriptionReportRow {
  const isTrial = subscription.status === "trialing";
  const nextBillingUnix = isTrial
    ? subscription.trialEndUnix
    : subscription.status === "active"
      ? subscription.currentPeriodEndUnix
      : null;

  return {
    organizationId: subscription.organizationId,
    organizationName: subscription.organizationName,
    stripeCustomerId: subscription.stripeCustomerId ?? "",
    stripeSubscriptionId: subscription.stripeSubscriptionId ?? "",
    plan: subscription.plan,
    status: subscription.status,
    monthlyAmountUsd: subscription.priceMonthlyCents === null
      ? ""
      : (subscription.priceMonthlyCents / 100).toFixed(2),
    trialStartedAt: isoDate(subscription.trialStartUnix),
    trialEndsAt: isoDate(subscription.trialEndUnix),
    // This is a scheduled billing date, not a guarantee payment will succeed.
    nextBillingDate: subscription.cancelAtPeriodEnd ? "" : isoDate(nextBillingUnix),
    cancelAtPeriodEnd: String(subscription.cancelAtPeriodEnd),
  };
}

export function summarizeSubscriptions(rows: SubscriptionSnapshot[]) {
  return {
    trialing: rows.filter(row => row.status === "trialing").length,
    paying: rows.filter(row => row.status === "active").length,
    pastDue: rows.filter(row => row.status === "past_due").length,
    canceled: rows.filter(row => row.status === "canceled").length,
    // This is nominal active monthly subscription value, not collected revenue.
    activeMonthlyValueCents: rows
      .filter(row => row.status === "active")
      .reduce((sum, row) => sum + (row.priceMonthlyCents ?? 0), 0),
  };
}
