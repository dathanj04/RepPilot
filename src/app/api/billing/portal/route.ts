import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { stripePost } from "@/lib/stripe";

export async function POST() {
  const user = await getCurrentUser();
  if (user.roleKey !== "ORG_ADMIN") return Response.json({ error: "Not authorized" }, { status: 403 });
  const origin = process.env.APP_URL;
  if (!origin || !origin.startsWith("https://")) return Response.json({ error: "Billing URL unavailable" }, { status: 503 });
  const record = await prisma.subscription.findUnique({ where: { organizationId: user.organizationId } });
  if (!record?.stripeCustomerId) return Response.json({ error: "No Stripe customer account" }, { status: 404 });
  try {
    const params = new URLSearchParams({ customer: record.stripeCustomerId, return_url: `${origin}/onboarding` });
    const portal = await stripePost<{ url: string }>("/billing_portal/sessions", params);
    if (!portal.url || !portal.url.startsWith("https://billing.stripe.com/")) throw new Error("Invalid portal URL");
    return Response.json({ url: portal.url });
  } catch (error) {
    console.error("Billing portal unavailable", error instanceof Error ? error.message : "unknown");
    return Response.json({ error: "Could not open billing management" }, { status: 502 });
  }
}
