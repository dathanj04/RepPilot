import {describe,it,expect,vi} from "vitest";
import {buildRevenueReport,listRevenueSubscriptions,minorUnitDivisor,type RevenueSubscription} from "./revenue";
import {revenueWorkbook} from "./revenue-excel";
import ExcelJS from "exceljs";
import {BILLING_PLANS} from "../domain/paid-access";
const now=Date.parse("2026-11-17T12:00:00Z");
const org={id:"org",name:"=HYPERLINK(\"https://invalid\",\"click\")",subscription:{stripeCustomerId:"cus_a"}};
function sub(id="sub_a"):RevenueSubscription{return {id,customer:{id:"cus_a",name:"Paying fixture",email:"owner@example.invalid"},status:"active",livemode:true,metadata:{organizationId:"org"},latest_invoice:{id:"in_a",status:"paid",amount_paid:48000,currency:"usd",status_transitions:{paid_at:now/1000-100}},items:{data:[{quantity:1,current_period_end:now/1000+86400,price:{id:BILLING_PLANS.annual.price,unit_amount:48000,currency:"usd",recurring:{interval:"year",interval_count:1}}}]}};}
describe("live customer revenue report",()=>{
 it("deduplicates customers and subscriptions while normalizing annual prices",()=>{
  const a=sub(),b=sub("sub_b");b.items.data[0].price={id:BILLING_PLANS.individual_monthly.price,unit_amount:2900,currency:"usd",recurring:{interval:"month",interval_count:1}};b.items.data[0].quantity=2;
  const r=buildRevenueReport([a,b,a],[org],now);expect(r.payingCustomers).toBe(1);expect(r.payingSubscriptions).toBe(2);expect(r.monthlyTotals.USD).toBe(9800);expect(r.rows[0].latestPaid).toBe(48000);
 });
 it("does not turn trials, debt, paused collection, test mode or zero invoices into paid customers",()=>{
  const variants=[sub("trial"),sub("debt"),sub("paused"),sub("test"),sub("free"),sub("expired")];
  variants[0].status="trialing";variants[1].status="past_due";variants[2].pause_collection={behavior:"void"};variants[3].livemode=false;variants[4].latest_invoice={id:"in_free",status:"paid",amount_paid:0};variants[5].items.data[0].current_period_end=now/1000-1;
  const r=buildRevenueReport(variants,[org],now);expect(r.payingCustomers).toBe(0);expect(r.trials).toBe(1);expect(r.otherSubscriptions).toBe(4);expect(r.monthlyTotals).toEqual({});
 });
 it("excludes unrelated Stripe businesses, mismatched customer IDs and unmapped workspaces",()=>{
  const a=sub();a.metadata={organizationId:"other"};const b=sub("b");b.customer="cus_other";const c=sub("c");c.items.data[0].price.id="price_other_business";
  expect(buildRevenueReport([a,b,c],[org],now).rows).toEqual([]);
 });
 it("does not invent missing price amounts or mix currencies",()=>{
  const a=sub();delete a.items.data[0].price.unit_amount;
  const b=sub("b");b.items.data[0].price.currency="jpy";b.items.data[0].price.unit_amount=12000;
  const r=buildRevenueReport([a,b],[org],now);expect(r.unknownAmounts).toBe(1);expect(r.monthlyTotals).toEqual({JPY:1000});expect(minorUnitDivisor("JPY")).toBe(1);expect(minorUnitDivisor("BHD")).toBe(1000);
 });
 it("paginates Stripe and fails rather than returning incomplete totals",async()=>{
  const request=vi.fn().mockResolvedValueOnce({data:[sub()],has_more:true}).mockResolvedValueOnce({data:[sub("b")],has_more:false});expect((await listRevenueSubscriptions(request)).length).toBe(2);expect(request.mock.calls[1][0]).toContain("starting_after=sub_a");expect(request.mock.calls[0][0]).toContain("data.latest_invoice");
  await expect(listRevenueSubscriptions(vi.fn().mockResolvedValue({data:[],has_more:true}))).rejects.toThrow("pagination");
  const failed=vi.fn().mockResolvedValueOnce({data:[sub()],has_more:true}).mockRejectedValueOnce(Error("Provider unavailable"));await expect(listRevenueSubscriptions(failed)).rejects.toThrow("unavailable");
 });
 it("exports real XLSX numbers and literal customer text, with no trials or formulas",async()=>{
  const trial=sub("trial");trial.status="trialing";const r=buildRevenueReport([sub(),trial],[org],now);
  const bytes=await revenueWorkbook(r);expect(Buffer.from(bytes).subarray(0,2).toString()).toBe("PK");
  const book=new ExcelJS.Workbook();await book.xlsx.load(Buffer.from(bytes) as unknown as ExcelJS.Buffer);
  const sheet=book.getWorksheet("Paying customers")!;expect(sheet.rowCount).toBe(2);expect(sheet.getCell("A2").value).toBe(org.name);expect(sheet.getCell("A2").type).toBe(ExcelJS.ValueType.String);expect(sheet.getCell("G2").value).toBe(480);expect(sheet.getCell("K2").value).toBe(40);expect(sheet.getCell("L2").value).toBe(480);expect(book.getWorksheet("Summary")!.getCell("B3").value).toBe(1);
 });
});
