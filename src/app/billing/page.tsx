import {NativeSubscription} from "@/components/billing/native-subscription";
import {headers} from "next/headers";
import {isNativeShell} from "@/lib/native-shell";
import Link from "next/link";
import {connection} from "next/server";
import {redirect} from "next/navigation";
import {getCurrentUser} from "@/lib/auth";
import {prisma} from "@/lib/db";
import {BILLING_PLANS,stripeConfigured,customerSubscriptions} from "@/lib/stripe";
import {isPaidSubscription,planKeyForPriceId,tierForPriceId,type StripeSubscription} from "@/lib/domain/paid-access";
import {completeTrialCardSetup} from "@/lib/billing-flow";
import {startCheckoutAction,openBillingPortalAction,selectTrialPlanAction,saveBillingDetailsAction} from "@/lib/billing-actions";
import {AppShell} from "@/components/shell/app-shell";
import {PageFrame} from "@/components/ui/page";
import {BillingRefresh} from "@/components/billing/billing-refresh";

export const instant=false;
export const metadata={title:"Subscriptions"};
export default async function BillingPage({searchParams}:{searchParams:Promise<{saved?:string;error?:string;checkout?:string;planSaved?:string;upgrade?:string}>}){
 await connection();
 const user=await getCurrentUser({allowExpiredTrial:true});
 if(user.roleKey==="PLATFORM_ADMIN")redirect("/platform");
 const query=await searchParams;
 const native=isNativeShell((await headers()).get("user-agent"));
 let subscription=await prisma.subscription.findUnique({where:{organizationId:user.organizationId}});
 const profile=await prisma.user.findUniqueOrThrow({where:{id:user.id},select:{billingName:true,billingEmail:true,billingPlanPreference:true}});
 const configured=stripeConfigured()&&Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim());
 const canManage=!subscription?.billingPayerUserId||subscription.billingPayerUserId===user.id||user.roleKey==="ORG_ADMIN";
 let current:StripeSubscription|null=null,billingUnavailable=false;
 if(configured&&subscription?.stripeCustomerId){
  try{
   // Read Stripe's verified setup state as a recovery path for delayed webhooks.
   // The URL's checkout flag never proves payment or authorization.
   if(!native&&subscription.stripeCheckoutId)await completeTrialCardSetup(user.organizationId,subscription.stripeCheckoutId);
   const live=await customerSubscriptions(subscription.stripeCustomerId);
   current=live.data.find(s=>s.livemode&&s.customer===subscription!.stripeCustomerId&&s.metadata?.organizationId===user.organizationId&&!["canceled","incomplete_expired"].includes(s.status)&&s.items.data.some(i=>tierForPriceId(i.price.id)!==null))??null;
   subscription=await prisma.subscription.findUnique({where:{organizationId:user.organizationId}});
  }catch{billingUnavailable=true;}
 }
 const trial=subscription?.trialEndsAt!=null&&subscription.trialEndsAt>new Date();
 const paid=current&&subscription?.stripeCustomerId?isPaidSubscription(current,subscription.stripeCustomerId,user.organizationId):false;
 const selectedKey=current?planKeyForPriceId(current.items.data[0].price.id):profile.billingPlanPreference;
 const selected=selectedKey?BILLING_PLANS[selectedKey as keyof typeof BILLING_PLANS]:null;
 const scheduled=current?.status==="trialing"&&Boolean(current.default_payment_method)&&!current.cancel_at_period_end;
 const date=(d:Date)=>new Intl.DateTimeFormat("en-US",{dateStyle:"medium",timeStyle:"short",timeZone:user.timezone}).format(d);
 const days=trial?Math.ceil((subscription!.trialEndsAt!.getTime()-Date.now())/86400000):0;
 if(native)return <AppShell allowExpiredTrial><PageFrame title="Subscriptions" subtitle="Your plan. Your next move."><NativeSubscription days={days} trialEndsAt={subscription?.trialEndsAt??null} timezone={user.timezone} paid={paid} currentTier={current?current.items.data.map(i=>tierForPriceId(i.price.id)).find(Boolean)??null:null} unavailable={billingUnavailable} scheduledLabel={scheduled&&selected?`${selected.label} is scheduled to start ${date(subscription!.trialEndsAt!)} at ${selected.amount}, plus applicable tax.`:null}/></PageFrame></AppShell>;
 return <AppShell allowExpiredTrial><PageFrame title="Subscriptions" subtitle="Individual or Business. Keep your full 14-day free trial.">
  <div className="max-w-4xl space-y-5">
   <section className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
    <h2 className="text-lg font-semibold">{trial?days+" days left in your free trial":paid?"Your subscription is active":"Choose a subscription to continue"}</h2>
    <p className="text-sm leading-6">{trial?"All Business features stay available through "+date(subscription!.trialEndsAt!)+". Adding a card does not restart or shorten your trial.":"Workspace access requires a confirmed paid subscription. Your saved data stays in your account."}</p>
    {scheduled&&selected?<p role="status" className="rounded-xl bg-white p-3 text-sm font-medium">Payment method confirmed. {selected.label} starts {date(subscription!.trialEndsAt!)} at {selected.amount}, plus applicable tax. Renews until canceled.</p>:current?.cancel_at_period_end?<p role="status" className="text-sm">Your subscription is set to cancel. Manage subscription & card shows the confirmed end date.</p>:trial?<p className="text-sm">No card is required to finish the trial. If you choose a plan and authorize a card now, billing begins after the trial ends. Cancel before then to avoid the first charge.</p>:null}
    {selected&&!current?<p className="text-sm">Selected option: <strong>{selected.label}</strong>. A saved preference alone does not authorize payment.</p>:null}
    <BillingRefresh/>
   </section>
   {query.upgrade==="business"?<p role="status" className="rounded-xl bg-amber-50 p-3 text-sm">To access this feature, please upgrade to Business account.</p>:null}
   {query.error?<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{query.error}</p>:null}
   {billingUnavailable?<p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm">We could not confirm your billing status. Your original trial date and saved data are unchanged. Refresh before opening another checkout.</p>:null}
   {query.checkout==="complete"&&!scheduled&&!paid?<p role="status" className="rounded-xl bg-amber-50 p-3 text-sm">Your Stripe return is being verified. Refresh subscription status shortly. Payment is never assumed from this return link.</p>:null}
   {query.planSaved==="1"?<p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm">Plan preference saved. No payment is scheduled until you complete secure card setup.</p>:null}
   {!configured?<p role="status" className="rounded-xl bg-amber-50 p-3 text-sm">Secure billing activation is being connected. You can compare plans and save your preference below.</p>:null}
   {!canManage?<p className="text-sm text-slate-600">Your workspace payer or owner manages this shared subscription. You can still view all plan details.</p>:null}
   <section aria-label="Subscription plans" className="grid gap-4 md:grid-cols-2">
    {Object.entries(BILLING_PLANS).map(([key,plan])=><article key={key} className={"flex flex-col rounded-2xl border bg-white p-5 "+(key===selectedKey?"border-emerald-600 ring-1 ring-emerald-600":"border-slate-200")}>
     <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">{plan.label}</h2>{key===selectedKey?<span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">{current?"Current option":"Selected"}</span>:null}</div>
     <p className="mt-4 text-3xl font-semibold">{plan.amount}</p><p className="mt-2 text-xs text-slate-500">USD · Plus applicable tax · {plan.interval==="year"?"Full year billed annually. Two months free compared with monthly billing.":"Billed monthly."}</p>
     <ul className="my-5 space-y-2 text-sm text-slate-600"><li>Account maps and route planning</li><li>Visit check-ins, notes, tasks and follow-ups</li><li>Personal calendar and conversation preparation</li>{plan.tier==="business"?<><li>Lunch & Learns and meeting requests</li><li>Reports and spending management</li></>:<li className="text-slate-400">Lunch & Learns, meeting requests and reports require Business.</li>}</ul>
     {!current?<><form action={startCheckoutAction} className="mt-auto space-y-3">
      <input type="hidden" name="plan" value={key}/>
      <label className="flex items-start gap-2 text-xs leading-5"><input name="billingConsent" value="yes" type="checkbox" required disabled={!configured||!canManage||billingUnavailable} className="mt-1 size-4 shrink-0"/>
       <span>I authorize {plan.amount} plus applicable tax, {trial?"starting after my trial ends on "+date(subscription!.trialEndsAt!):"starting when I subscribe"}. My subscription renews until canceled. {trial?"I can cancel before the trial ends to avoid the first charge.":""} <Link href="/terms" className="underline">Terms</Link> · <Link href="/privacy" className="underline">Privacy</Link></span>
      </label>
      <button disabled={!configured||!canManage||billingUnavailable} className="min-h-12 w-full rounded-xl bg-[#087f5b] px-3 text-sm font-semibold text-white disabled:opacity-40">{trial?"Add card · pay after trial":"Subscribe securely"}</button>
     </form>{trial?<form action={selectTrialPlanAction} className="mt-2"><input type="hidden" name="plan" value={key}/><button className="min-h-11 w-full text-sm font-medium underline underline-offset-4">Save preference without a card</button></form>:null}</>:<div className="mt-auto"><p className="text-sm text-slate-500">Review plan changes securely in Stripe. Upgrades may include a prorated charge; downgrades apply at renewal. Trial changes keep the original trial end date.</p>{canManage?<form action={openBillingPortalAction}><button className="mt-3 min-h-11 rounded-xl border px-4 text-sm font-medium">{key===selectedKey?"Manage this plan":"Change plan in Stripe"}</button></form>:null}</div>}
    </article>)}
   </section>
   <p className="text-xs leading-5 text-slate-500">Individual includes core rep tools; Business adds lunches, meeting requests and reports. Card details are entered on Stripe’s secure website in your browser and are never stored by RepPilot. A failed payment does not activate paid access.</p>
   {subscription?.stripeCustomerId&&canManage?<form action={openBillingPortalAction}><button disabled={!stripeConfigured()} className="min-h-12 w-full rounded-xl border bg-white px-4 text-sm font-semibold disabled:opacity-40">Manage subscription & card</button></form>:null}
   <details className="rounded-2xl border bg-white p-5"><summary className="min-h-11 cursor-pointer py-2 font-semibold">Billing contact details</summary>
    {query.saved==="1"?<p role="status" className="text-sm text-emerald-800">Billing details saved.</p>:null}
    <form action={saveBillingDetailsAction} className="mt-4 space-y-4">
     <label className="block text-sm">Billing name<input name="billingName" defaultValue={profile.billingName||user.name} minLength={2} maxLength={120} required autoComplete="name" className="mt-1 min-h-12 w-full rounded-xl border px-3"/></label>
     <label className="block text-sm">Billing email<input name="billingEmail" type="email" defaultValue={profile.billingEmail||user.email} maxLength={254} required autoComplete="email" className="mt-1 min-h-12 w-full rounded-xl border px-3"/></label>
     <button className="min-h-11 rounded-xl bg-[#10263e] px-4 text-sm font-medium text-white">Save billing details</button>
    </form>
   </details>
   <div className="flex flex-wrap gap-5 pb-4 text-sm"><Link href="/support" className="min-h-11 py-3 underline">Billing support</Link><Link href="/delete-account/confirm" className="min-h-11 py-3 underline">Request account deletion</Link>{trial||paid?<Link href="/map" className="min-h-11 py-3 underline">Back to workspace</Link>:null}</div>
  </div>
 </PageFrame></AppShell>;
}
