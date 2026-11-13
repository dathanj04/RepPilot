import { describe, expect, it } from "vitest";
import { BILLING_PLANS, isPaidSubscription, type StripeSubscription } from "./paid-access";
const now = 1794535200000;
const paid = (): StripeSubscription => ({ id: "sub_a", customer: "cus_a", status: "active", livemode: true, metadata: { organizationId: "org_a" }, latest_invoice: { status: "paid" }, items: { data: [{ price: { id: BILLING_PLANS.monthly.price }, quantity: 1, current_period_end: now / 1000 + 3600 }] } });
describe("Stripe payment entitlement", () => {
  it("accepts a paid current approved subscription", () => expect(isPaidSubscription(paid(), "cus_a", "org_a", now)).toBe(true));
  it.each(["past_due", "unpaid", "incomplete", "incomplete_expired", "canceled", "paused", "trialing"])("denies %s after the app trial", status => expect(isPaidSubscription({ ...paid(), status }, "cus_a", "org_a", now)).toBe(false));
  it("denies another workspace or customer", () => { expect(isPaidSubscription(paid(), "cus_b", "org_a", now)).toBe(false); expect(isPaidSubscription(paid(), "cus_a", "org_b", now)).toBe(false); });
  it("denies test payments and paused collection", () => { expect(isPaidSubscription({ ...paid(), livemode: false }, "cus_a", "org_a", now)).toBe(false); expect(isPaidSubscription({ ...paid(), pause_collection: {} }, "cus_a", "org_a", now)).toBe(false); });
  it("does not grant access from an unpaid or unexpanded invoice", () => { for (const latest_invoice of [null, "in_x", { status: "open" }]) expect(isPaidSubscription({ ...paid(), latest_invoice }, "cus_a", "org_a", now)).toBe(false); });
  it("denies exactly at the paid period boundary", () => { const s = paid(); s.items.data[0].current_period_end = now / 1000; expect(isPaidSubscription(s, "cus_a", "org_a", now)).toBe(false); });
  it("rejects an unrelated price", () => { const s = paid(); s.items.data[0].price.id = "price_other"; expect(isPaidSubscription(s, "cus_a", "org_a", now)).toBe(false); });
});
