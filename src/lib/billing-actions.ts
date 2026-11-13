"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "./auth";
import { prisma } from "./db";
import { BILLING_PLANS, stripeRequest, customerSubscriptions } from "./stripe";
import { consumeSharedRateLimit } from "./domain/rate-limit-store";
import { savePersonalBillingProfile } from "./domain/billing-profile";

export async function saveBillingDetailsAction(form: FormData) {
  const user = await getCurrentUser({ allowExpiredTrial: true });
  const result = await savePersonalBillingProfile(prisma, user.id, { billingName: String(form.get("billingName") || ""), billingEmail: String(form.get("billingEmail") || "") });
  if ("error" in result) redirect(`/billing?error=${encodeURIComponent(result.error!)}`);
  revalidatePath("/billing");
  redirect("/billing?saved=1");
}

// Saving a preference does not create a Stripe customer or subscription.
export async function selectTrialPlanAction(form: FormData) {
  const user = await getCurrentUser({ allowExpiredTrial: true });
  const plan = String(form.get("plan") || "");
  if (!Object.hasOwn(BILLING_PLANS, plan)) redirect("/billing?error=Choose%20a%20listed%20plan.");
  if (user.trialDaysLeft === null || user.trialDaysLeft <= 0) redirect("/billing?error=Your%20trial%20has%20ended.%20Choose%20a%20subscription%20below.");
  await prisma.user.update({ where: { id: user.id }, data: { billingPlanPreference: plan } });
  revalidatePath("/billing");
  redirect("/billing?planSaved=1");
}

export async function startCheckoutAction(form: FormData) {
  const user = await getCurrentUser({ allowExpiredTrial: true });
  const planKey = String(form.get("plan"));
  const plan = BILLING_PLANS[planKey as keyof typeof BILLING_PLANS];
  let destination = "";
  try {
    if (!plan) throw new Error("Choose a listed plan.");
    if (!(await consumeSharedRateLimit(prisma, `checkout:${user.organizationId}`, 10, 60000)).ok) throw new Error("Please wait a minute before trying checkout again.");
    // No early charges: checkout opens only once the original free period ends.
    const subscription = await prisma.subscription.findUniqueOrThrow({ where: { organizationId: user.organizationId } });
    if (subscription.trialEndsAt && subscription.trialEndsAt > new Date()) throw new Error("Your trial is still free. Return here when it ends to subscribe.");
    if (subscription.billingPayerUserId && subscription.billingPayerUserId !== user.id && user.roleKey !== "ORG_ADMIN") throw new Error("The workspace payer can manage this shared subscription. Individual workspace owners can manage their own billing.");
    let customer = subscription.stripeCustomerId;
    if (!customer) {
      const profile = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      const created = await stripeRequest<{ id: string }>("customers", new URLSearchParams({
        email: profile.billingEmail || user.email, name: profile.billingName || user.name,
        "metadata[organizationId]": user.organizationId,
      }), `reppilot-customer-${user.organizationId}`);
      customer = created.id;
      await prisma.subscription.updateMany({ where: { organizationId: user.organizationId, stripeCustomerId: null }, data: { stripeCustomerId: customer, billingPayerUserId: user.id } });
      // Re-read the winner of concurrent customer creation before checkout.
      const bound = await prisma.subscription.findUniqueOrThrow({ where: { organizationId: user.organizationId } });
      customer = bound.stripeCustomerId!;
      if (bound.billingPayerUserId !== user.id && user.roleKey !== "ORG_ADMIN") throw new Error("Another member started billing. Please contact the workspace payer.");
    }
    const existing = await customerSubscriptions(customer);
    if (existing.data.some(s => ["active", "past_due", "unpaid", "incomplete", "paused", "trialing"].includes(s.status))) {
      throw new Error("A subscription already exists. Use Manage payment & invoices to avoid a duplicate subscription.");
    }
    if (subscription.stripeCheckoutId) {
      const previous = await stripeRequest<{ url: string; status: string }>(`checkout/sessions/${encodeURIComponent(subscription.stripeCheckoutId)}`);
      if (previous.status === "open" && previous.url) destination = previous.url;
    }
    if (!destination) {
    const session = await stripeRequest<{ id: string; url: string; status: string }>("checkout/sessions", new URLSearchParams({
      mode: "subscription", customer, "line_items[0][price]": plan.price, "line_items[0][quantity]": "1",
      "automatic_tax[enabled]": "true", "billing_address_collection": "required", "customer_update[address]": "auto",
      "subscription_data[metadata][organizationId]": user.organizationId,
      "metadata[organizationId]": user.organizationId, client_reference_id: user.organizationId,
      success_url: "https://reppilot.app/billing?checkout=complete", cancel_url: "https://reppilot.app/billing?checkout=canceled",
    }), `reppilot-checkout-${user.organizationId}-${subscription.stripeCheckoutId || "initial"}`);
    if (!session.url || session.status !== "open") throw new Error("Return to billing and try again shortly.");
    await prisma.subscription.update({ where: { organizationId: user.organizationId }, data: { stripeCheckoutId: session.id } });
    destination = session.url;
    }
  } catch (error) { redirect(`/billing?error=${encodeURIComponent(error instanceof Error ? error.message : "Checkout is unavailable.")}`); }
  redirect(destination);
}

export async function openBillingPortalAction() {
  const user = await getCurrentUser({ allowExpiredTrial: true });
  let destination = "";
  try {
    const subscription = await prisma.subscription.findUniqueOrThrow({ where: { organizationId: user.organizationId } });
    if (!subscription.stripeCustomerId || (subscription.billingPayerUserId !== user.id && user.roleKey !== "ORG_ADMIN")) throw new Error("Only this workspace's payer or owner can manage its payment methods.");
    const portal = await stripeRequest<{ url: string }>("billing_portal/sessions", new URLSearchParams({ configuration: "bpc_1UbIF1AJxC2GoXaR0Qzeerkn", customer: subscription.stripeCustomerId, return_url: "https://reppilot.app/billing" }));
    destination = portal.url;
  } catch (error) { redirect(`/billing?error=${encodeURIComponent(error instanceof Error ? error.message : "The billing portal is unavailable.")}`); }
  redirect(destination);
}
