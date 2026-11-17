import { describe, expect, it } from "vitest";
import { summarizeSubscriptions, toSubscriptionReportRow, type SubscriptionSnapshot } from "./subscription-report";
import { subscriptionReportCsv } from "./subscription-csv";

const sample: SubscriptionSnapshot = {
  organizationId: "org_1",
  organizationName: '=HYPERLINK("bad")',
  stripeCustomerId: "cus_1",
  stripeSubscriptionId: "sub_1",
  plan: "Business",
  status: "trialing",
  priceMonthlyCents: 7900,
  trialStartUnix: 1794700800,
  trialEndUnix: 1795910400,
  currentPeriodEndUnix: null,
  cancelAtPeriodEnd: false,
};

describe("subscription reporting foundation", () => {
  it("shows the trial end as the anticipated first billing date, not an immediate charge", () => {
    const row = toSubscriptionReportRow(sample);
    expect(row.trialStartedAt).toBe("2026-11-15");
    expect(row.trialEndsAt).toBe("2026-11-29");
    expect(row.nextBillingDate).toBe(row.trialEndsAt);
    expect(row.monthlyAmountUsd).toBe("79.00");
  });

  it("does not advertise a future payment when cancellation is scheduled", () => {
    expect(toSubscriptionReportRow({ ...sample, cancelAtPeriodEnd: true }).nextBillingDate).toBe("");
  });

  it("counts only active subscriptions as paying and excludes trials from nominal monthly value", () => {
    expect(summarizeSubscriptions([sample, { ...sample, status: "active" }])).toEqual({
      trialing: 1, paying: 1, pastDue: 0, canceled: 0, activeMonthlyValueCents: 7900,
    });
  });

  it("safely exports user-controlled spreadsheet cells", () => {
    const csv = subscriptionReportCsv([toSubscriptionReportRow(sample)]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"\'=HYPERLINK(""bad"")"');
    expect(csv).toContain('"79.00"');
  });
});
