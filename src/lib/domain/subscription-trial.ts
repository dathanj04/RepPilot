/**
 * Pure billing/reporting helpers. Stripe remains the source of truth for
 * payment collection and subscription state. Do not activate an account or
 * issue a charge based only on dates calculated here.
 */
export const TRIAL_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;
export type BillingState = "trialing" | "active" | "past_due" | "canceled" | "incomplete" | "unpaid" | "unknown";
export type SubscriberRecord = {
  organizationId: string;
  organizationName: string;
  email: string | null;
  plan: string;
  stripeStatus: string | null;
  trialStart: Date | string | null;
  trialEnd: Date | string | null;
  currentPeriodEnd: Date | string | null;
  monthlyAmountCents: number | null;
  currency: string | null;
};
export function trialEndFromStart(start: Date): Date {
  if (!(start instanceof Date) || Number.isNaN(start.getTime())) throw new Error("Invalid trial start");
  return new Date(start.getTime() + TRIAL_DAYS * DAY_MS);
}
export function normalizeBillingState(status: string | null): BillingState {
  switch (status) {
    case "trialing": case "active": case "past_due": case "canceled":
    case "incomplete": case "unpaid": return status;
    default: return "unknown";
  }
}
export function trialDaysRemaining(trialEnd: Date | string | null, now = new Date()): number | null {
  if (!trialEnd) return null;
  const end = new Date(trialEnd).getTime();
  if (!Number.isFinite(end) || !Number.isFinite(now.getTime())) return null;
  return Math.max(0, Math.ceil((end - now.getTime()) / DAY_MS));
}
function csv(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  // Quote every cell and prevent spreadsheet formula injection.
  const safe = /^[\s]*[=+@\-]/.test(text) ? "'" + text : text;
  return '"' + safe.replace(/"/g, '""') + '"';
}
function iso(value: Date | string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}
export function subscriberCsv(rows: SubscriberRecord[]): string {
  const header = ["Organization ID","Organization","Contact Email","Plan","Stripe Status","Trial Start (UTC)","Trial End (UTC)","Current Period End (UTC)","Monthly Amount","Currency"];
  const body = rows.map(row => [
    row.organizationId, row.organizationName, row.email, row.plan,
    normalizeBillingState(row.stripeStatus), iso(row.trialStart), iso(row.trialEnd),
    iso(row.currentPeriodEnd),
    row.monthlyAmountCents === null ? "" : (row.monthlyAmountCents / 100).toFixed(2),
    (row.currency ?? "").toUpperCase(),
  ]);
  return [header, ...body].map(items => items.map(csv).join(",")).join("\r\n") + "\r\n";
}
