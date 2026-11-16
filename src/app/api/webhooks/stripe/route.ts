import { prisma } from "@/lib/db";
import { validStripeSignature } from "@/lib/stripe-webhook";
import { customerSubscriptions } from "@/lib/stripe";
import { isPaidSubscription,tierForPriceId } from "@/lib/domain/paid-access";
import { completeTrialCardSetup } from "@/lib/billing-flow";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: "Webhook unavailable" }, { status: 503 });
  if (Number(request.headers.get("content-length") || 0) > 262144) return new Response(null,{status:413});
  const raw = await request.text();
  if (Buffer.byteLength(raw) > 262144) return new Response(null,{status:413});
  if (!validStripeSignature(raw,request.headers.get("stripe-signature") || "",secret)) return Response.json({error:"Invalid signature"},{status:400});
  let event: {id:string;type:string;livemode:boolean;data:{object:{id?:string;mode?:string;customer?:string|{id:string}}}};
  try { event = JSON.parse(raw); } catch { return new Response(null,{status:400}); }
  if (!event || !/^evt_[A-Za-z0-9]+$/.test(event.id) || typeof event.type !== "string") return new Response(null,{status:400});
  // Production endpoint never processes sandbox events or trusts browser-provided payment status.
  if (!event.livemode) return Response.json({received:true,ignored:true});
  const customerValue = event.data?.object?.customer;
  const customer = typeof customerValue === "string" ? customerValue : customerValue?.id;
  if (!customer) return Response.json({received:true});
  const subscription = await prisma.subscription.findUnique({where:{stripeCustomerId:customer}});
  if (!subscription) return Response.json({received:true});
  const receiptId = `stripe_${event.id}`;
  if (await prisma.auditLog.findUnique({where:{id:receiptId},select:{id:true}})) return Response.json({received:true});
  // Re-read current Stripe state: delayed/reordered events cannot restore a canceled subscription.
  let paid = false;
  let tier:"individual"|"business"|null=null;
  try {
    if (event.type === "checkout.session.completed" && event.data.object.mode === "setup" && event.data.object.id) await completeTrialCardSetup(subscription.organizationId,event.data.object.id);
    const current = await customerSubscriptions(customer);
    const verified=current.data.find(item=>isPaidSubscription(item,customer,subscription.organizationId));
    paid=Boolean(verified);tier=verified?tierForPriceId(verified.items.data[0].price.id):null;
  } catch { return Response.json({error:"Payment verification unavailable"},{status:503}); }
  const trial = subscription.trialEndsAt != null && subscription.trialEndsAt > new Date();
  try {
    await prisma.$transaction(async tx => {
      await tx.auditLog.create({data:{id:receiptId,organizationId:subscription.organizationId,action:"billing.webhook",entityType:"StripeEvent",entityId:event.id,metadata:{type:event.type,paidVerified:paid}}});
      await tx.subscription.update({where:{id:subscription.id},data:{status:paid ? "active" : trial ? "trialing" : "payment_required",...(tier?{plan:tier}:{})}});
    });
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "P2002")) throw error;
  }
  // Every protected request still verifies live Stripe entitlement; the local status cannot grant access.
  return Response.json({received:true});
}
