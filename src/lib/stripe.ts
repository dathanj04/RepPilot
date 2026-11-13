import "server-only";
import { BILLING_PLANS, isPaidSubscription, type StripeSubscription } from "./domain/paid-access";

export { BILLING_PLANS };
export function stripeConfigured() { return Boolean(process.env.STRIPE_SECRET_KEY?.trim()); }
export async function stripeRequest<T>(path: string, body?: URLSearchParams, idempotencyKey?: string): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("Payments are being connected. Please contact support.");
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: body ? "POST" : "GET", cache: "no-store", signal: AbortSignal.timeout(10000),
    headers: { Authorization: `Bearer ${key}`, "Stripe-Version": "2025-06-30.basil",
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}) }, body,
  });
  if (!response.ok) throw new Error("Stripe could not complete this request. Please try again or contact support.");
  return response.json() as Promise<T>;
}
export async function customerSubscriptions(customer: string) {
  return stripeRequest<{ data: StripeSubscription[] }>(`subscriptions?customer=${encodeURIComponent(customer)}&status=all&limit=100&expand[]=data.latest_invoice`);
}
export async function hasPaidAccess(customer: string | null | undefined, organizationId: string) {
  if (!customer || !stripeConfigured()) return false;
  try {
    const subscriptions = await customerSubscriptions(customer);
    return subscriptions.data.some(s => isPaidSubscription(s, customer, organizationId));
  } catch { return false; } // Failed verification never grants workspace access.
}
