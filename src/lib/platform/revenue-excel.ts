import ExcelJS from "exceljs";
import {minorUnitDivisor,type RevenueReport} from "./revenue";
export async function revenueWorkbook(report:RevenueReport){
 const book=new ExcelJS.Workbook();book.creator="RepPilot";book.created=new Date(report.generatedAt);
 const summary=book.addWorksheet("Summary");summary.columns=[{width:38},{width:105}];
 summary.addRows([["RepPilot paying customer report","Live Stripe subscription snapshot"],["Generated at (UTC)",report.generatedAt],["Paying customers",report.payingCustomers],["Paying subscriptions",report.payingSubscriptions],["Active trial workspaces",report.activeTrials],["Other subscriptions",report.otherSubscriptions],["Definition","Live active RepPilot subscriptions, paid latest invoice greater than zero, current billing period, collection not paused. Customers are deduplicated by Stripe customer ID."],["Listed monthly equivalent","List price × quantity, normalized for month/year. Before discounts and tax; not accounting revenue or cash collected."],["Latest invoice paid","Actual latest invoice amount paid, including applicable tax/adjustments; before refunds. Not lifetime customer spend."],["Scope","Mapped RepPilot workspaces and recognized plan prices only. Demo workspaces and Stripe test mode excluded."],["Missing price amounts",report.unknownAmounts]]);
 for(const [currency,amount] of Object.entries(report.monthlyTotals))summary.addRow(["Listed monthly equivalent · "+currency,amount/minorUnitDivisor(currency)]);
 const sheet=book.addWorksheet("Paying customers");
 const headers=["Workspace","Customer","Billing email","Tier","Status","Currency","Recurring list amount","Billing interval","Interval count","Quantity","Listed monthly equivalent","Latest invoice paid","Invoice currency","Last paid at (UTC)","Current period ends (UTC)","Cancels at period end","Stripe customer ID","Stripe subscription ID","Workspace ID"];
 sheet.addRow(headers);sheet.views=[{state:"frozen",ySplit:1}];sheet.autoFilter={from:"A1",to:"S1"};
 for(const r of report.rows.filter(r=>r.paying)){
  const row=sheet.addRow([r.workspace,r.customer,r.email,r.tier,r.status,r.currency,r.amount===null?null:r.amount/minorUnitDivisor(r.currency),r.interval,r.intervalCount,r.quantity,r.monthlyEquivalent===null?null:r.monthlyEquivalent/minorUnitDivisor(r.currency),r.latestPaid===null?null:r.latestPaid/minorUnitDivisor(r.invoiceCurrency),r.invoiceCurrency,r.paidAt,r.periodEnd,r.cancelAtPeriodEnd?"Yes":"No",r.customerId,r.subscriptionId,r.workspaceId]);
  // Plain strings remain strings, even when customer-controlled text starts with '='.
  for(const n of [7,11,12])row.getCell(n).numFmt="#,##0.00####";
 }
 sheet.autoFilter={from:"A1",to:"S"+Math.max(1,sheet.rowCount)};
 const trials=book.addWorksheet("Trials");trials.addRow(["Workspace","Contact email","Trial started (UTC)","Trial ends (UTC)","Days remaining","Active trial","Selected plan","Conversion status","Scheduled conversion (UTC)","Stripe subscription ID","Workspace ID"]);
 for(const t of report.trialRows)trials.addRow([t.workspace,t.email,t.startedAt,t.endsAt,t.daysRemaining,t.active?"Yes":"No",t.plan,t.conversionState,t.conversionAt,t.subscriptionId,t.workspaceId]);
 trials.views=[{state:"frozen",ySplit:1}];trials.autoFilter={from:"A1",to:"K"+Math.max(1,trials.rowCount)};trials.columns.forEach(c=>{c.width=30;});
 summary.addRows([["Scheduled automatic conversions",report.scheduledConversions],["Trials ending within 3 days",report.expiringTrials],["Expired trial workspaces",report.expiredTrials],["Trial conversion","Includes workspaces without Stripe billing. Original stored trial dates are preserved. Scheduled conversion is conditional on successful payment; expiry alone does not imply a charge."]]);
 sheet.columns.forEach((column,i)=>{column.width=[0,1,2,16,17,18].includes(i)?30:23;});
 for(const ws of [summary,sheet,trials]){ws.getRow(1).font={bold:true,color:{argb:"FFFFFFFF"}};ws.getRow(1).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF10263E"}};ws.getRow(1).height=30;}
 return new Uint8Array(await book.xlsx.writeBuffer());
}
