// Only a current Stripe response can grant paid access. Local status strings and
// Checkout return URLs are never proof of payment.
export const BILLING_PLANS = {
  monthly: { price: "price_1UZwGIAJxC2GoXaR1BvbNtJc", label: "Business monthly", amount: "$58.65 / month" },
  annual: { price: "price_1UZwGSAJxC2GoXaRfAzM06QY", label: "Business annual", amount: "$591.60 / year" },
} as const;
export type StripeSubscription = {
  id: string; customer: string; status: string; livemode: boolean;
  metadata?: Record<string, string>; pause_collection?: unknown;
  latest_invoice?: { status?: string; paid?: boolean } | string | null;
  items: { data: Array<{ current_period_end?: number; price: { id: string }; quantity?: number }> };
};
export function isPaidSubscription(s: StripeSubscription, customer: string, organizationId: string, now = Date.now()) {
  const invoice = s.latest_invoice;
  return s.livemode === true && s.customer === customer && s.metadata?.organizationId === organizationId &&
    s.status === "active" && !s.pause_collection && typeof invoice === "object" && invoice !== null &&
    invoice.status === "paid" && s.items.data.length === 1 && s.items.data.every(item =>
      Object.values(BILLING_PLANS).some(plan => plan.price === item.price.id) &&
      (item.current_period_end ?? 0) * 1000 > now && (item.quantity ?? 0) >= 1);
}
