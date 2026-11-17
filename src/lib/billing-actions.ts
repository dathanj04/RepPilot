"use server";
import { headers } from "next/headers";
import { isNativeShell } from "./native-shell";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "./auth";
import { prisma } from "./db";
import { BILLING_PLANS, stripeRequest, customerSubscriptions } from "./stripe";
import {CATALOG_VERSION,type StripeSubscription} from "./domain/paid-access";
import { consumeSharedRateLimit } from "./domain/rate-limit-store";
import { savePersonalBillingProfile } from "./domain/billing-profile";
import { billingPlan, checkoutParams, withBillingLock, stripeDestination, type CheckoutSession } from "./billing-flow";

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
 const user=await getCurrentUser({allowExpiredTrial:true});
 let destination="";
 try{
  const planKey=String(form.get("plan")||"");
  if(!billingPlan(planKey))throw Error("Choose a listed plan.");
  if(form.get("billingConsent")!=="yes")throw Error("Confirm the price and recurring billing terms before adding a card.");
  if(!process.env.STRIPE_WEBHOOK_SECRET?.trim())throw Error("Secure subscription activation is being connected. Please contact support.");
  if(!(await consumeSharedRateLimit(prisma,"checkout:"+user.organizationId,10,60000)).ok)throw Error("Please wait a minute before trying checkout again.");
  destination=await withBillingLock(user.organizationId,async tx=>{
   const subscription=await tx.subscription.findUniqueOrThrow({where:{organizationId:user.organizationId}});
   if(subscription.billingPayerUserId&&subscription.billingPayerUserId!==user.id&&user.roleKey!=="ORG_ADMIN")throw Error("The workspace payer or owner can manage this subscription.");
   if(!subscription.billingPayerUserId)await tx.subscription.update({where:{id:subscription.id},data:{billingPayerUserId:user.id}});
   let customer=subscription.stripeCustomerId;
   if(!customer){
    const profile=await tx.user.findUniqueOrThrow({where:{id:user.id}});
    const created=await stripeRequest<{id:string}>("customers",new URLSearchParams({email:profile.billingEmail||user.email,name:profile.billingName||user.name,"metadata[organizationId]":user.organizationId}),"reppilot-customer-"+user.organizationId);
    customer=created.id;
    await tx.subscription.update({where:{id:subscription.id},data:{stripeCustomerId:customer,billingPayerUserId:user.id}});
   }
   const current=await customerSubscriptions(customer);
   if(current.data.some(s=>!["canceled","incomplete_expired"].includes(s.status)))throw Error("A subscription is already scheduled or active. Use Manage subscription & card to avoid a duplicate.");
   const params=checkoutParams(customer,user.organizationId,planKey,subscription.trialEndsAt);
   if(subscription.stripeCheckoutId){
    const previous=await stripeRequest<CheckoutSession>("checkout/sessions/"+encodeURIComponent(subscription.stripeCheckoutId));
    if(previous.status==="open"&&previous.metadata?.planKey===planKey&&previous.metadata?.catalogVersion===CATALOG_VERSION&&previous.mode===params.get("mode"))return stripeDestination(previous.url);
    if(previous.status==="complete"&&previous.mode==="setup"&&!await tx.auditLog.findUnique({where:{id:"billing_setup_"+previous.id},select:{id:true}}))throw Error("Your card setup is being confirmed. Refresh Subscriptions in a moment.");
    if(previous.status==="complete"&&previous.mode==="subscription"){
     if(!previous.subscription)throw Error("Your previous payment is being confirmed. Refresh Subscriptions before trying again.");
     const paid=await stripeRequest<StripeSubscription>("subscriptions/"+encodeURIComponent(previous.subscription));
     if(paid.customer!==customer||paid.metadata?.organizationId!==user.organizationId||!["canceled","incomplete_expired"].includes(paid.status))throw Error("A subscription already exists. Refresh Subscriptions or use Manage subscription & card.");
    }
    if(previous.status==="open")await stripeRequest("checkout/sessions/"+encodeURIComponent(previous.id)+"/expire",new URLSearchParams());
   }
   const session=await stripeRequest<CheckoutSession>("checkout/sessions",params,"reppilot-checkout-"+CATALOG_VERSION+"-"+user.organizationId+"-"+planKey+"-"+params.get("mode")+"-"+(subscription.stripeCheckoutId||"initial"));
   if(session.status!=="open")throw Error("Refresh Subscriptions and try again.");
   await tx.subscription.update({where:{id:subscription.id},data:{stripeCheckoutId:session.id}});
   await tx.user.update({where:{id:user.id},data:{billingPlanPreference:planKey}});
   return stripeDestination(session.url);
  });
 }catch(e){redirect("/billing?error="+encodeURIComponent(e instanceof Error?e.message:"Checkout is unavailable."));}
 // Capacitor opens Stripe's external origin in the system browser.
 redirect(destination);
}

export async function openBillingPortalAction() {
  const user = await getCurrentUser({ allowExpiredTrial: true });
  let destination = "";
  try {
    const subscription = await prisma.subscription.findUniqueOrThrow({ where: { organizationId: user.organizationId } });
    if (!subscription.stripeCustomerId || (subscription.billingPayerUserId !== user.id && user.roleKey !== "ORG_ADMIN")) throw new Error("Only this workspace's payer or owner can manage its payment methods.");
    const portal = await stripeRequest<{ url: string }>("billing_portal/sessions", new URLSearchParams({ configuration: "bpc_1UbIF1AJxC2GoXaR0Qzeerkn", customer: subscription.stripeCustomerId, return_url: "https://reppilot.app/billing" }));
    destination = stripeDestination(portal.url,true);
  } catch (error) { redirect(`/billing?error=${encodeURIComponent(error instanceof Error ? error.message : "The billing portal is unavailable.")}`); }
  redirect(destination);
}
