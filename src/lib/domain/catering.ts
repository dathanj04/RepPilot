export const MENU_UNAVAILABLE =
  "Restaurant menus are not connected. RepPilot does not load a menu, a price, or live delivery availability. Enter the amounts from the receipt after you place the order yourself.";

export const MAX_RECEIPT_BYTES = 1_500_000;

const RECEIPT_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

const MEETING_APPROVED = new Set(["SCHEDULED", "CONFIRMED", "CHANGE_REQUESTED", "COMPLETED"]);

export const CATERING_REVIEW_ROLES = ["MANAGER", "COMPLIANCE_ADMIN", "ORG_ADMIN"] as const;

export type CostParts = {
  subtotalCents: number | null;
  taxCents: number | null;
  feeCents: number | null;
  deliveryCents: number | null;
  tipCents: number | null;
};

export function budgetRemainingCents(
  capPerPersonCents: number | null,
  attendees: number,
  estimatedCents: number | null,
): number | null {
  if (capPerPersonCents == null || attendees < 1 || estimatedCents == null) return null;
  return capPerPersonCents * attendees - estimatedCents;
}

export function assertCostParts(
  parts: CostParts,
  finalAmountCents: number,
): { ok: true } | { ok: false; error: string } {
  const values = [parts.subtotalCents, parts.taxCents, parts.feeCents, parts.deliveryCents, parts.tipCents];
  if (values.every((value) => value == null)) return { ok: true };
  const complete = values.every((value): value is number => value != null && value >= 0 && Number.isInteger(value));
  if (!complete) {
    return { ok: false, error: "Enter subtotal, tax, fees, delivery, and tip together, or leave all of them blank." };
  }
  const sum = values.reduce((total, value) => total + value, 0);
  if (sum !== finalAmountCents) {
    return { ok: false, error: "The line items have to add up to the final amount. RepPilot does not calculate tax or tip." };
  }
  return { ok: true };
}

export function cateringGates(input: { lunchStatus: string; approvalStatus: string }): {
  meetingApproved: boolean;
  cateringApproved: boolean;
  reason: string | null;
} {
  const meetingApproved = MEETING_APPROVED.has(input.lunchStatus);
  const cateringApproved = input.approvalStatus === "APPROVED";
  if (!meetingApproved) {
    return { meetingApproved, cateringApproved, reason: "The representative has not approved this lunch yet." };
  }
  if (!cateringApproved) {
    return { meetingApproved, cateringApproved, reason: "Catering needs its own approval before an order can be recorded." };
  }
  return { meetingApproved, cateringApproved, reason: null };
}

export function receiptFileAllowed(input: { contentType: string; byteSize: number }): { ok: true } | { ok: false; error: string } {
  if (!RECEIPT_TYPES.has(input.contentType)) {
    return { ok: false, error: "Receipt files must be a PDF or a JPEG, PNG, or WebP image." };
  }
  if (input.byteSize < 1 || input.byteSize > MAX_RECEIPT_BYTES) {
    return { ok: false, error: "Receipt files must be under 1.5 MB." };
  }
  return { ok: true };
}
