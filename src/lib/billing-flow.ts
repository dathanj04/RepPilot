import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "./db";
import type { Prisma } from "@/generated/prisma/client";
import { BILLING_PLANS, customerSubscriptions, stripeRequest } from "./stripe";
type Tx=Prisma.TransactionClient;
export type CheckoutSession={id:string;url:string|null;status:string;mode:string;customer:string|null;client_reference_id?:string|null;livemode?:boolean;setup_intent?:string|null;metadata?:Record<string,string>};
export async function withBillingLock<T>(organizationId:string,work:(tx:Tx)=>Promise<T>){
 return prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${"billing:"+organizationId}))::text`;
  return work(tx);
 },{maxWait:10000,timeout:45000});
}
export function billingPlan(key:string){return Object.hasOwn(BILLING_PLANS,key)?BILLING_PLANS[key as keyof typeof BILLING_PLANS]:null;}
export function checkoutParams(customer:string,organizationId:string,key:string,trialEndsAt:Date|null,now=Date.now()){
 const plan=billingPlan(key);if(!plan)throw Error("Choose a listed plan.");
 const trial=trialEndsAt!=null&&trialEndsAt.getTime()>now;
 const params=new URLSearchParams({
  mode:trial?"setup":"subscription",customer,"managed_payments[enabled]":"false",
  "billing_address_collection":"required","customer_update[address]":"auto",
  "metadata[organizationId]":organizationId,"metadata[planKey]":key,
  "metadata[billingFlow]":trial?"trial_card_v1":"paid_v1","metadata[consent]":"yes",
  client_reference_id:organizationId,
  success_url:"https://reppilot.app/billing?checkout=complete",cancel_url:"https://reppilot.app/billing?checkout=canceled",
 });
 const suffix=Array.from(createHash("sha256").update(organizationId+key+String(trialEndsAt)).digest().subarray(0,8),n=>String.fromCharCode(97+n%26)).join("");
 params.set("integration_identifier","reppilot_billing_"+suffix);
 if(trial){
  params.set("currency","usd");
  params.set("setup_intent_data[metadata][organizationId]",organizationId);
  params.set("custom_text[submit][message]","Authorize "+plan.label+" at "+plan.amount+" plus applicable tax, starting "+trialEndsAt!.toISOString()+". No subscription charge before then. Renews until canceled; cancel before the trial ends to avoid the first charge.");
 }else{
  params.set("line_items[0][price]",plan.price);params.set("line_items[0][quantity]","1");
  params.set("automatic_tax[enabled]","true");
  params.set("subscription_data[metadata][organizationId]",organizationId);
  params.set("subscription_data[metadata][planKey]",key);
 }
 return params;
}
export function stripeDestination(url:string|null,portal=false){
 if(!url)throw Error("The secure billing link is unavailable.");
 const parsed=new URL(url);
 if(parsed.protocol!=="https:"||parsed.hostname!==(portal?"billing.stripe.com":"checkout.stripe.com"))throw Error("The secure billing link is invalid.");
 return url;
}
// Reconcile only the latest server-bound, completed Stripe Setup Checkout.
// A successful return URL or client-supplied customer/payment method never grants access.
export async function completeTrialCardSetup(organizationId:string,sessionId:string){
 return withBillingLock(organizationId,async tx=>{
  const bound=await tx.subscription.findUniqueOrThrow({where:{organizationId}});
  if(bound.stripeCheckoutId!==sessionId||!bound.stripeCustomerId)return;
  const session=await stripeRequest<CheckoutSession>("checkout/sessions/"+encodeURIComponent(sessionId));
  if(session.mode!=="setup"||session.status!=="complete")return;
  if(!session.livemode||session.customer!==bound.stripeCustomerId||session.client_reference_id!==organizationId||session.metadata?.organizationId!==organizationId||session.metadata?.billingFlow!=="trial_card_v1"||session.metadata?.consent!=="yes")throw Error("Card setup could not be verified.");
  const plan=billingPlan(session.metadata.planKey);if(!plan||!session.setup_intent)throw Error("Card setup is missing its selected plan.");
  const existing=await customerSubscriptions(bound.stripeCustomerId);
  if(existing.data.some(s=>!["canceled","incomplete_expired"].includes(s.status)))return;
  const setup=await stripeRequest<{customer:string;status:string;payment_method:string|null;livemode:boolean}>("setup_intents/"+encodeURIComponent(session.setup_intent));
  if(!setup.livemode||setup.customer!==bound.stripeCustomerId||setup.status!=="succeeded"||!setup.payment_method)throw Error("Payment method setup has not completed.");
  const params=new URLSearchParams({
   customer:bound.stripeCustomerId,"items[0][price]":plan.price,"items[0][quantity]":"1",
   default_payment_method:setup.payment_method,collection_method:"charge_automatically",
   payment_behavior:"allow_incomplete",off_session:"true","automatic_tax[enabled]":"true",
   "metadata[organizationId]":organizationId,"metadata[planKey]":session.metadata.planKey,
   "metadata[setupCheckoutId]":sessionId,
   "trial_settings[end_behavior][missing_payment_method]":"cancel",
  });
  // Direct Subscription API supports the exact original boundary, including
  // the last 48 hours that subscription-mode Checkout cannot handle.
  const originalEnd=bound.trialEndsAt?.getTime()??0;
  params.set("trial_end",originalEnd>Date.now()?String(Math.ceil(originalEnd/1000)):"now");
  await stripeRequest("subscriptions",params,"reppilot-card-subscription-"+sessionId);
  await tx.subscription.update({where:{id:bound.id},data:{plan:"business"}});
 });
}
