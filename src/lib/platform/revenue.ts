import {tierForPriceId,isPaidSubscription,type StripeSubscription} from "../domain/paid-access";
export type RevenueSubscription=Omit<StripeSubscription,"customer"|"latest_invoice"|"items">&{
 customer:string|{id:string;email?:string|null;name?:string|null;deleted?:boolean};
 latest_invoice:string|null|{id:string;status?:string;amount_paid?:number;currency?:string;status_transitions?:{paid_at?:number|null}};
 items:{data:Array<{quantity?:number;current_period_end?:number;price:{id:string;unit_amount?:number|null;unit_amount_decimal?:string|null;currency?:string;recurring?:{interval:string;interval_count:number}|null}}>};
};
export type BillingWorkspace={id:string;name:string;subscription:{stripeCustomerId:string|null}|null};
export type RevenueRow={workspaceId:string;workspace:string;customerId:string;customer:string;email:string;subscriptionId:string;tier:string;status:string;paying:boolean;currency:string;amount:number|null;interval:string;intervalCount:number;quantity:number;monthlyEquivalent:number|null;latestPaid:number|null;invoiceCurrency:string;paidAt:string|null;periodEnd:string|null;cancelAtPeriodEnd:boolean};
export type RevenueReport={generatedAt:string;rows:RevenueRow[];payingCustomers:number;payingSubscriptions:number;trials:number;otherSubscriptions:number;monthlyTotals:Record<string,number>;unknownAmounts:number};
export function minorUnitDivisor(currency:string){return 10**(new Intl.NumberFormat("en-US",{style:"currency",currency}).resolvedOptions().maximumFractionDigits??2);}
export function money(amount:number|null,currency:string){return amount===null?"Unavailable":new Intl.NumberFormat("en-US",{style:"currency",currency}).format(amount/minorUnitDivisor(currency));}
const date=(seconds:number|undefined|null)=>seconds?new Date(seconds*1000).toISOString():null;
export function buildRevenueReport(subscriptions:RevenueSubscription[],workspaces:BillingWorkspace[],now=Date.now()):RevenueReport{
 const orgs=new Map(workspaces.map(o=>[o.id,o])),seen=new Set<string>(),rows:RevenueRow[]=[];
 for(const s of subscriptions){
  if(seen.has(s.id))continue;seen.add(s.id);
  const org=orgs.get(s.metadata?.organizationId??""),customerId=typeof s.customer==="string"?s.customer:s.customer.id;
  if(!s.livemode||!org||org.subscription?.stripeCustomerId!==customerId||s.items.data.length!==1)continue;
  const item=s.items.data[0],tier=tierForPriceId(item.price.id);if(!tier)continue;
  const invoice=typeof s.latest_invoice==="object"?s.latest_invoice:null;
  const paying=isPaidSubscription({...s,customer:customerId,latest_invoice:invoice},customerId,org.id,now)&&typeof invoice?.amount_paid==="number"&&invoice.amount_paid>0;
  const currency=item.price.currency?.toUpperCase()??"USD",quantity=item.quantity??1;
  const unit=item.price.unit_amount??(item.price.unit_amount_decimal!=null?Number(item.price.unit_amount_decimal):NaN);
  const amount=Number.isFinite(unit)&&unit>=0?unit*quantity:null;
  const interval=item.price.recurring?.interval??"unknown",intervalCount=item.price.recurring?.interval_count??1;
  const monthlyEquivalent=amount===null||intervalCount<=0?null:interval==="month"?amount/intervalCount:interval==="year"?amount/(12*intervalCount):null;
  const customer=typeof s.customer==="object"&&!s.customer.deleted?s.customer:null;
  rows.push({workspaceId:org.id,workspace:org.name,customerId,customer:customer?.name||org.name,email:customer?.email||"",subscriptionId:s.id,tier,status:s.status,paying,currency,amount,interval,intervalCount,quantity,monthlyEquivalent,latestPaid:invoice?.status==="paid"?invoice.amount_paid??null:null,invoiceCurrency:invoice?.currency?.toUpperCase()??currency,paidAt:date(invoice?.status_transitions?.paid_at),periodEnd:date(item.current_period_end),cancelAtPeriodEnd:Boolean(s.cancel_at_period_end)});
 }
 rows.sort((a,b)=>a.workspace.localeCompare(b.workspace)||a.subscriptionId.localeCompare(b.subscriptionId));
 const paid=rows.filter(r=>r.paying),monthlyTotals:Record<string,number>={};
 for(const r of paid)if(r.monthlyEquivalent!==null)monthlyTotals[r.currency]=(monthlyTotals[r.currency]??0)+r.monthlyEquivalent;
 return {generatedAt:new Date(now).toISOString(),rows,payingCustomers:new Set(paid.map(r=>r.customerId)).size,payingSubscriptions:paid.length,trials:rows.filter(r=>r.status==="trialing").length,otherSubscriptions:rows.filter(r=>!r.paying&&r.status!=="trialing").length,monthlyTotals,unknownAmounts:paid.filter(r=>r.monthlyEquivalent===null).length};
}
export async function listRevenueSubscriptions(request:<T>(path:string)=>Promise<T>):Promise<RevenueSubscription[]>{
 const all:RevenueSubscription[]=[];let cursor="";
 for(let page=0;page<100;page++){
  const params=new URLSearchParams({status:"all",limit:"100"});params.append("expand[]","data.customer");params.append("expand[]","data.latest_invoice");if(cursor)params.set("starting_after",cursor);
  const result=await request<{data:RevenueSubscription[];has_more:boolean}>("subscriptions?"+params);
  all.push(...result.data);if(!result.has_more)return all;
  const next=result.data.at(-1)?.id;if(!next||next===cursor)throw Error("Stripe pagination did not complete.");cursor=next;
 }
 throw Error("Report is too large to load completely. No partial totals were returned.");
}
