import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { stripeConfigured, stripePost } from "@/lib/stripe";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (user.roleKey !== "ORG_ADMIN") return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  if (!stripeConfigured()) return NextResponse.json({ error: "Billing is not yet configured" }, { status: 503 });
  const origin = process.env.APP_URL;
  if (!origin || !/^https:\/\//.test(origin)) return NextResponse.json({ error: "Billing URL not configured" }, { status: 503 });
  const body = await request.json().catch(() => null) as { plan?: string } | null;
  const plan = body?.plan;
  if (plan !== "individual" && plan !== "business") return NextResponse.json({ error: "Select a plan" }, { status: 400 });
  const record = await prisma.subscription.findUnique({ where: { organizationId: user.organizationId } });
  if (!record) return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
  if (record.stripeSubscriptionId) return NextResponse.json({ error: "Manage your existing subscription instead of starting another trial" }, { status: 409 });

  const now = new Date();
  const reservedUntil = new Date(now.getTime() + 34 * 60_000);
  const reservation = await prisma.subscription.updateMany({
    where: {
      organizationId: user.organizationId,
      stripeSubscriptionId: null,
      OR: [{ checkoutSessionExpiresAt: null }, { checkoutSessionExpiresAt: { lte: now } }],
    },
    data: { checkoutSessionId: null, checkoutSessionExpiresAt: reservedUntil },
  });
  if (reservation.count !== 1) return NextResponse.json({ error: "A checkout is already open. Complete or let it expire before retrying." }, { status: 409 });

  const price = plan === "individual" ? process.env.STRIPE_PRICE_INDIVIDUAL! : process.env.STRIPE_PRICE_BUSINESS!;
  const params = new URLSearchParams({
    mode: "subscription",
    expires_at: String(Math.floor(now.getTime() / 1000) + 31 * 60),
    "line_items[0][price]": price,
    "line_items[0][quantity]": "1",
    "subscription_data[trial_period_days]": "14",
    "subscription_data[trial_settings][end_behavior][missing_payment_method]": "cancel",
    payment_method_collection: "always",
    "payment_method_types[0]": "card",
    "client_reference_id": user.organizationId,
    "metadata[organizationId]": user.organizationId,
    "metadata[plan]": plan,
    "subscription_data[metadata][organizationId]": user.organizationId,
    "subscription_data[metadata][plan]": plan,
    "success_url": `${origin}/onboarding?checkout=success`,
    "cancel_url": `${origin}/onboarding?checkout=cancel`,
  });
  if (record.stripeCustomerId) params.set("customer", record.stripeCustomerId);
  else params.set("customer_email", user.email);
  try {
    // A database reservation prevents simultaneous checkouts across app instances.
    const session = await stripePost<{ id: string; url: string | null }>("/checkout/sessions", params,
      `trial-checkout-${user.organizationId}-${plan}-${now.getTime()}`);
    if (!session.id || !session.url || !session.url.startsWith("https://checkout.stripe.com/")) throw new Error("Stripe checkout URL unavailable");
    await prisma.subscription.updateMany({
      where: { organizationId: user.organizationId, stripeSubscriptionId: null, checkoutSessionExpiresAt: reservedUntil },
      data: { checkoutSessionId: session.id },
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    // Keep the reservation until it expires: the request may have succeeded at
    // Stripe even if our network call failed before receiving its response.
    // Releasing early would allow two payable subscriptions.
    console.error("Stripe checkout failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Stripe checkout could not be started" }, { status: 502 });
  }
}
