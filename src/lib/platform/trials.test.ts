import {it,expect} from "vitest";
import {buildRevenueReport,type BillingWorkspace,type RevenueSubscription} from "./revenue";
import {BILLING_PLANS} from "../domain/paid-access";
import {revenueWorkbook} from "./revenue-excel";
import ExcelJS from "exceljs";
const now=Date.parse("2026-11-17T18:00:00Z"),start=new Date(now-12*86400000),end=new Date(now+2*86400000);
function org(id="trial",customer:string|null=null):BillingWorkspace{return {id,name:"Trial workspace",memberships:[{user:{email:"owner@example.invalid"}}],subscription:{stripeCustomerId:customer,status:"trialing",trialStartedAt:start,trialEndsAt:end,plan:"business"}};}
function stripe():RevenueSubscription{return {id:"sub_trial",customer:"cus_trial",status:"trialing",livemode:true,metadata:{organizationId:"trial"},trial_end:+end/1000,default_payment_method:"pm_verified",collection_method:"charge_automatically",latest_invoice:{id:"in_trial",status:"paid",amount_paid:0},items:{data:[{quantity:1,current_period_end:+end/1000,price:{id:BILLING_PLANS.monthly.price,unit_amount:4800,currency:"usd",recurring:{interval:"month",interval_count:1}}}]}};}
it("counts no-card trials with their original start/end and never promises payment",()=>{
 const report=buildRevenueReport([],[org()],now);expect(report.activeTrials).toBe(1);expect(report.payingCustomers).toBe(0);expect(report.scheduledConversions).toBe(0);expect(report.trialRows[0]).toMatchObject({startedAt:start.toISOString(),endsAt:end.toISOString(),daysRemaining:2,conversionAt:null,conversionState:"Payment setup required"});
});
it("shows the exact scheduled date only with a live verified automatic subscription",()=>{
 const r=buildRevenueReport([stripe()],[org("trial","cus_trial")],now);expect(r.activeTrials).toBe(1);expect(r.scheduledConversions).toBe(1);expect(r.trialRows[0].conversionAt).toBe(end.toISOString());expect(r.expiringTrials).toBe(1);
});
it.each(["canceled","paused","no-card","invoice","wrong-date","test-mode","mismatch"])("does not claim automatic conversion: %s",mode=>{
 const s=stripe();if(mode==="canceled")s.cancel_at_period_end=true;if(mode==="paused")s.pause_collection={behavior:"void"};if(mode==="no-card")s.default_payment_method=null;if(mode==="invoice")s.collection_method="send_invoice";if(mode==="wrong-date")s.trial_end!+=86400;if(mode==="test-mode")s.livemode=false;if(mode==="mismatch")s.customer="cus_other";
 const r=buildRevenueReport([s],[org("trial","cus_trial")],now);expect(r.activeTrials).toBe(1);expect(r.scheduledConversions).toBe(0);expect(r.trialRows[0].conversionAt).toBeNull();
});
it("ends a trial at the exact deadline without extending its dates",()=>{
 const r=buildRevenueReport([stripe()],[org("trial","cus_trial")],+end);expect(r.activeTrials).toBe(0);expect(r.expiredTrials).toBe(1);expect(r.trialRows[0].endsAt).toBe(end.toISOString());expect(r.scheduledConversions).toBe(0);
});
it("does not count already-converted customers again even with stale local trial status",()=>{
 const s=stripe();s.status="active";s.latest_invoice={id:"in_paid",status:"paid",amount_paid:4800};s.items.data[0].current_period_end=now/1000+86400*30;
 const r=buildRevenueReport([s],[org("trial","cus_trial")],now);expect(r.payingCustomers).toBe(1);expect(r.activeTrials).toBe(0);expect(r.trialRows).toEqual([]);
});
it("flags missing dates rather than inventing a new 14-day period",()=>{
 const o=org();o.subscription!.trialStartedAt=null;expect(buildRevenueReport([],[o],now).trialRows[0].conversionState).toBe("Review trial dates");expect(buildRevenueReport([],[o],now).activeTrials).toBe(0);
});
it("exports trial dates and conversion readiness in a separate Excel sheet",async()=>{
 const r=buildRevenueReport([stripe()],[org("trial","cus_trial"),org("no-card")],now),book=new ExcelJS.Workbook();await book.xlsx.load(Buffer.from(await revenueWorkbook(r)) as unknown as ExcelJS.Buffer);
 const sheet=book.getWorksheet("Trials")!;expect(sheet.rowCount).toBe(3);expect(sheet.getCell("C2").value).toBe(start.toISOString());expect(sheet.getCell("D2").value).toBe(end.toISOString());expect(book.getWorksheet("Summary")!.getCell("B5").value).toBe(2);expect(sheet.autoFilter).toBe("A1:K3");
});
