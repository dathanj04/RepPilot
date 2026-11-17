import type { SubscriptionReportRow } from "./subscription-report";

export const SUBSCRIPTION_CSV_HEADERS: ReadonlyArray<keyof SubscriptionReportRow> = [
  "organizationId",
  "organizationName",
  "stripeCustomerId",
  "stripeSubscriptionId",
  "plan",
  "status",
  "monthlyAmountUsd",
  "trialStartedAt",
  "trialEndsAt",
  "nextBillingDate",
  "cancelAtPeriodEnd",
];

/**
 * Escape spreadsheet formula injection as well as ordinary RFC-4180 CSV quoting.
 * Only call this for report rows built from authorized, tenant-scoped records.
 */
function csvCell(value: unknown): string {
  let content = String(value ?? "");
  // Spreadsheet applications may interpret these prefixes as executable formulas.
  if (/^[\s\u0000-\u001f]*[=+\-@]/u.test(content)) content = "'" + content;
  return '"' + content.replace(/"/g, '""') + '"';
}

export function subscriptionReportCsv(rows: SubscriptionReportRow[]): string {
  const lines = [
    SUBSCRIPTION_CSV_HEADERS.map(csvCell).join(","),
    ...rows.map(row => SUBSCRIPTION_CSV_HEADERS.map(header => csvCell(row[header])).join(",")),
  ];
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}
