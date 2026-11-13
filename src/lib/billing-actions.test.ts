import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const mocks = vi.hoisted(() => ({ user: vi.fn(), subscription: vi.fn(), request: vi.fn(), subscriptions: vi.fn(), profileUpdate: vi.fn() }));
vi.mock("./domain/rate-limit-store", () => ({ consumeSharedRateLimit: vi.fn().mockResolvedValue({ ok: true }) }));
vi.mock("./auth", () => ({ getCurrentUser: mocks.user }));
vi.mock("./db", () => ({ prisma: { user: { update: mocks.profileUpdate }, subscription: { findUniqueOrThrow: mocks.subscription, update: vi.fn() } } }));
vi.mock("./stripe", async importOriginal => ({ ...await importOriginal<typeof import("./stripe")>(), stripeRequest: mocks.request, customerSubscriptions: mocks.subscriptions }));
import { startCheckoutAction, openBillingPortalAction, selectTrialPlanAction } from "./billing-actions";
const form = (plan = "monthly") => { const data = new FormData(); data.set("plan", plan); data.set("customer", "cus_attacker"); return data; };
beforeEach(() => { vi.clearAllMocks(); mocks.user.mockResolvedValue({ id: "u1", roleKey: "REP", organizationId: "o1" }); mocks.subscription.mockResolvedValue({ stripeCustomerId: "cus_bound", billingPayerUserId: "u1", trialEndsAt: new Date("2020-01-01") }); mocks.subscriptions.mockResolvedValue({ data: [] }); mocks.request.mockResolvedValue({ status: "open", url: "https://checkout.stripe.com/example" }); });
describe("server-controlled Stripe checkout", () => {
 it("uses the bound customer, approved price and tax without another trial", async () => { await expect(startCheckoutAction(form())).rejects.toThrow("REDIRECT:https://checkout.stripe.com"); const params = mocks.request.mock.calls[0][1] as URLSearchParams; expect(params.get("customer")).toBe("cus_bound"); expect(params.get("line_items[0][price]")).toBe("price_1UZwGIAJxC2GoXaR1BvbNtJc"); expect(params.get("automatic_tax[enabled]")).toBe("true"); expect(params.get("subscription_data[trial_period_days]")).toBe(null); expect(params.get("subscription_data[metadata][organizationId]")).toBe("o1"); });
 it("reuses an unfinished Checkout instead of creating another", async () => { mocks.subscription.mockResolvedValue({ stripeCustomerId: "cus_bound", billingPayerUserId: "u1", trialEndsAt: new Date("2020-01-01"), stripeCheckoutId: "cs_old" }); await expect(startCheckoutAction(form())).rejects.toThrow("REDIRECT:https://checkout.stripe.com"); expect(mocks.request).toHaveBeenCalledTimes(1); expect(mocks.request.mock.calls[0][0]).toBe("checkout/sessions/cs_old"); });
 it("rejects client-supplied arbitrary prices", async () => { await expect(startCheckoutAction(form("price_other"))).rejects.toThrow("Choose"); expect(mocks.request).not.toHaveBeenCalled(); });
 it("does not charge before the original trial ends", async () => { mocks.subscription.mockResolvedValue({ trialEndsAt: new Date(Date.now()+86400000) }); await expect(startCheckoutAction(form())).rejects.toThrow("trial"); expect(mocks.request).not.toHaveBeenCalled(); });
 it("prevents a second subscription", async () => { mocks.subscriptions.mockResolvedValue({ data: [{ status: "active" }] }); await expect(startCheckoutAction(form())).rejects.toThrow("duplicate"); expect(mocks.request).not.toHaveBeenCalled(); });
 it("allows an individual payer to use the portal", async () => { await expect(openBillingPortalAction()).rejects.toThrow("REDIRECT:https://checkout.stripe.com"); expect(mocks.request.mock.calls[0][1].get("customer")).toBe("cus_bound"); });
 it("denies a member control over another payer's subscription", async () => { mocks.subscription.mockResolvedValue({ stripeCustomerId: "cus_bound", billingPayerUserId: "u2" }); await expect(openBillingPortalAction()).rejects.toThrow("payer"); expect(mocks.request).not.toHaveBeenCalled(); });
});


describe("plan choices during the trial", () => {
 it("saves an individual's choice without contacting Stripe or accepting a submitted user id", async () => {
  mocks.user.mockResolvedValue({ id: "u1", roleKey: "REP", organizationId: "o1", trialDaysLeft: 7 });
  const data = form("annual"); data.set("userId", "other-user");
  await expect(selectTrialPlanAction(data)).rejects.toThrow("REDIRECT:/billing?planSaved=1");
  expect(mocks.profileUpdate).toHaveBeenCalledWith({ where: { id: "u1" }, data: { billingPlanPreference: "annual" } });
  expect(mocks.request).not.toHaveBeenCalled(); expect(mocks.subscriptions).not.toHaveBeenCalled();
 });
 it("rejects arbitrary plan values", async () => {
  mocks.user.mockResolvedValue({ id: "u1", trialDaysLeft: 7 });
  await expect(selectTrialPlanAction(form("__proto__"))).rejects.toThrow("Choose"); expect(mocks.profileUpdate).not.toHaveBeenCalled();
 });
 it("requires checkout after the trial instead of extending free access", async () => {
  mocks.user.mockResolvedValue({ id: "u1", trialDaysLeft: 0 });
  await expect(selectTrialPlanAction(form())).rejects.toThrow("trial%20has%20ended"); expect(mocks.profileUpdate).not.toHaveBeenCalled();
 });
});
