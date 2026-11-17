import { prisma } from "@/lib/db";
import { stripeGet, verifyStripeSignature } from "@/lib/stripe";

type StripeSubscription = {
  id: string; customer: string | { id: string };
  status: string; trial_start: number | null; trial_end: number | null;
  current_period_end?: number | null;
  metadata?: Record<string, string>;
  items?: { data?: Array<{ price?: { id?: string; unit_amount?: number | null; currency?: string }; current_period_end?: number }> };
};
type StripeEvent = {
  id: string; type: string; created: number;
  data: { object: Record<string, unknown> };
};
const date = (seconds?: number | null) => seconds && Number.isFinite(seconds) ? new Date(seconds * 1000) : null;

async function syncSubscription(sub: StripeSubscription, eventCreated: number) {
  const organizationId = sub.metadata?.organizationId;
  if (!organizationId) return;
  const existing = await prisma.subscription.findUnique({ where: { organizationId } });
  if (!existing) return;
  if (existing.stripeSubscriptionId && existing.stripeSubscriptionId !== sub.id) {
    console.error("Stripe subscription identity mismatch");
    return;
  }
  if (existing.lastStripeEventAt && existing.lastStripeEventAt.getTime() > eventCreated * 1000) return;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const item = sub.items?.data?.[0];
  const plan = sub.metadata?.plan;
  await prisma.subscription.update({
    where: { organizationId },
    data: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: sub.id,
      stripePriceId: item?.price?.id ?? null,
      plan: plan === "business" || plan === "individual" ? plan : existing.plan,
      status: sub.status,
      priceMonthlyCents: item?.price?.unit_amount ?? existing.priceMonthlyCents,
      trialStart: date(sub.trial_start),
      trialEnd: date(sub.trial_end),
      currentPeriodEnd: date(sub.current_period_end ?? item?.current_period_end),
      lastStripeEventAt: new Date(eventCreated * 1000),
    },
  });
}
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) return new Response("Webhook not configured", { status: 503 });
  const raw = await request.text();
  if (!verifyStripeSignature(raw, signature, secret)) return new Response("Invalid Stripe signature", { status: 400 });
  let event: StripeEvent;
  try { event = JSON.parse(raw) as StripeEvent; }
  catch { return new Response("Malformed event", { status: 400 }); }
  try {
    if (event.type === "checkout.session.completed") {
      const checkout = event.data.object as { mode?: string; subscription?: string; client_reference_id?: string };
      if (checkout.mode !== "subscription" || !checkout.subscription) return Response.json({ received: true });
      const sub = await stripeGet<StripeSubscription>(`/subscriptions/${encodeURIComponent(checkout.subscription)}`);
      if (sub.metadata?.organizationId !== checkout.client_reference_id) throw new Error("Checkout organization mismatch");
      await syncSubscription(sub, event.created);
    } else if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      await syncSubscription(event.data.object as StripeSubscription, event.created);
    }
    return Response.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook sync failed", error instanceof Error ? error.message : "unknown");
    return new Response("Retry later", { status: 500 });
  }
}
