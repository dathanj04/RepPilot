import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { stripeGet, verifyStripeSignature } from "@/lib/stripe";

type StripeSubscription = {
  id: string;
  customer: string | { id: string };
  status: string;
  trial_start: number | null;
  trial_end: number | null;
  current_period_end?: number | null;
  metadata?: Record<string, string>;
  items?: { data?: Array<{
    price?: { id?: string; unit_amount?: number | null; currency?: string };
    current_period_end?: number | null;
  }> };
};
type StripeEvent = {
  id: string;
  type: string;
  created: number;
  data: { object: Record<string, unknown> };
};
const date = (seconds?: number | null) =>
  seconds != null && Number.isFinite(seconds) ? new Date(seconds * 1000) : null;

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) return new Response("Webhook not configured", { status: 503 });
  const raw = await request.text();
  if (!verifyStripeSignature(raw, signature, secret)) return new Response("Invalid Stripe signature", { status: 400 });

  let event: StripeEvent;
  try { event = JSON.parse(raw) as StripeEvent; }
  catch { return new Response("Malformed event", { status: 400 }); }
  if (!event.id || !Number.isSafeInteger(event.created) || !event.type || !event.data?.object) {
    return new Response("Malformed event", { status: 400 });
  }

  let sub: StripeSubscription | null = null;
  try {
    if (event.type === "checkout.session.completed") {
      const checkout = event.data.object as {
        id?: string; mode?: string; subscription?: string; client_reference_id?: string;
      };
      if (checkout.mode === "subscription" && checkout.subscription) {
        // Read Stripe's actual subscription; never trust a browser success URL.
        sub = await stripeGet<StripeSubscription>(`/subscriptions/${encodeURIComponent(checkout.subscription)}`);
        if (!checkout.client_reference_id || sub.metadata?.organizationId !== checkout.client_reference_id) {
          throw new Error("Checkout organization mismatch");
        }
      }
    } else if (event.type === "customer.subscription.created" ||
               event.type === "customer.subscription.updated" ||
               event.type === "customer.subscription.deleted") {
      // Fetch current Stripe state to avoid applying a stale event payload.
      const payload = event.data.object as { id?: string };
      if (!payload.id?.startsWith("sub_")) throw new Error("Invalid subscription ID");
      sub = await stripeGet<StripeSubscription>(`/subscriptions/${encodeURIComponent(payload.id)}`);
    }

    // The event receipt and subscription update commit or roll back together.
    await prisma.$transaction(async tx => {
      await tx.stripeWebhookEvent.create({ data: { id: event.id, eventType: event.type } });
      if (!sub) return;
      const organizationId = sub.metadata?.organizationId;
      if (!organizationId) throw new Error("Subscription missing organization ID");
      const existing = await tx.subscription.findUnique({ where: { organizationId } });
      if (!existing) throw new Error("Unknown organization subscription");
      if (existing.stripeSubscriptionId && existing.stripeSubscriptionId !== sub.id) {
        throw new Error("Stripe subscription identity mismatch");
      }
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      const item = sub.items?.data?.[0];
      const plan = sub.metadata?.plan;
      // Never overwrite a record with an earlier Stripe event.
      // The atomic conditional also protects against parallel event workers.
      await tx.subscription.updateMany({
        where: {
          organizationId,
          OR: [
            { lastStripeEventAt: null },
            { lastStripeEventAt: { lte: new Date(event.created * 1000) } },
          ],
          AND: [{
            OR: [{ stripeSubscriptionId: null }, { stripeSubscriptionId: sub.id }],
          }],
        },
        data: {
          stripeCustomerId: customerId,
          stripeSubscriptionId: sub.id,
          stripePriceId: item?.price?.id ?? existing.stripePriceId,
          plan: plan === "business" || plan === "individual" ? plan : existing.plan,
          status: sub.status,
          priceMonthlyCents: item?.price?.unit_amount ?? existing.priceMonthlyCents,
          trialStart: date(sub.trial_start),
          trialEnd: date(sub.trial_end),
          currentPeriodEnd: date(sub.current_period_end ?? item?.current_period_end),
          lastStripeEventAt: new Date(event.created * 1000),
          checkoutSessionId: null,
          checkoutSessionExpiresAt: null,
        },
      });
    });
    return Response.json({ received: true });
  } catch (error) {
    // Stripe retries duplicate webhooks. Unique event ID means it was already committed.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" &&
        Array.isArray(error.meta?.target) && error.meta.target.includes("id")) {
      return Response.json({ received: true, duplicate: true });
    }
    console.error("Stripe webhook processing failed", error instanceof Error ? error.message : "unknown");
    return new Response("Retry later", { status: 500 });
  }
}
