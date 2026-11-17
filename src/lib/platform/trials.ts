import type {BillingWorkspace,RevenueSubscription} from "./revenue";
import {tierForPriceId} from "../domain/paid-access";
export type TrialRow={workspaceId:string;workspace:string;email:string;startedAt:string|null;endsAt:string|null;daysRemaining:number;active:boolean;conversionAt:string|null;conversionState:string;plan:string;subscriptionId:string|null};
export function buildTrialRows(subscriptions:RevenueSubscription[],workspaces:BillingWorkspace[],now:number):TrialRow[]{
 const rows:TrialRow[]=[];
 for(const org of workspaces){
  const local=org.subscription;if(!local)continue;
  const mapped=subscriptions.filter(s=>s.livemode&&s.metadata?.organizationId===org.id&&(typeof s.customer==="string"?s.customer:s.customer.id)===local.stripeCustomerId&&s.items.data.length===1&&tierForPriceId(s.items.data[0].price.id));
  if(mapped.some(s=>s.status==="active"))continue;
  const trials=mapped.filter(s=>s.status==="trialing"),live=trials[0];
  if(!local.trialStartedAt&&!local.trialEndsAt&&local.status!=="trialing"&&!live)continue;
  const start=local.trialStartedAt?new Date(local.trialStartedAt).getTime():NaN,end=local.trialEndsAt?new Date(local.trialEndsAt).getTime():NaN;
  const valid=Number.isFinite(start)&&Number.isFinite(end)&&end>start;
  const active=valid&&start<=now&&now<end&&(local.status==="trialing"||Boolean(live));
  const customer=live&&typeof live.customer==="object"&&!live.customer.deleted?live.customer:null;
  let state="Payment setup required",conversionAt:string|null=null;
  if(!valid||start>now)state="Review trial dates";
  else if(!active)state=mapped.some(s=>["past_due","unpaid","incomplete"].includes(s.status))?"Trial ended — payment needs attention":"Trial ended — payment required";
  else if(trials.length>1)state="Review multiple trial subscriptions";
  else if(live&&(live.cancel_at_period_end||live.cancel_at||live.pause_collection))state="Automatic conversion canceled or paused";
  else if(live){
   if(!live.trial_end||Math.abs(live.trial_end*1000-end)>1000)state="Review Stripe trial-end mismatch";
   else if(live.collection_method==="charge_automatically"&&live.default_payment_method){state="Scheduled automatic conversion";conversionAt=new Date(end).toISOString();}
   else state="Payment setup not verified";
  }
  rows.push({workspaceId:org.id,workspace:org.name,email:customer?.email||org.memberships?.[0]?.user.email||"",startedAt:Number.isFinite(start)?new Date(start).toISOString():null,endsAt:Number.isFinite(end)?new Date(end).toISOString():null,daysRemaining:active?Math.ceil((end-now)/86400000):0,active,conversionAt,conversionState:state,plan:live?(tierForPriceId(live.items.data[0].price.id)??"Unknown"):"Not selected",subscriptionId:live?.id??null});
 }
 return rows.sort((a,b)=>Number(b.active)-Number(a.active)||(a.endsAt??"z").localeCompare(b.endsAt??"z")||a.workspace.localeCompare(b.workspace));
}
