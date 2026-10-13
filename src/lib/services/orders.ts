import type { Db } from "../db";
import {
  canRecordOrder,
  evaluateMealPolicy,
  exceptionIsProhibited,
  perPersonCents,
  type PolicyDecision,
} from "../domain/policy";

const ENTERTAINMENT = /\b(golf|game|tickets|entertainment|happy hour)\b/i;
const REFERRAL = /\breferral (volume|quota|bonus|reward)\b/i;

export async function loadActivePolicy(db: Db, organizationId: string) {
  return db.mealPolicy.findFirst({
    where: { organizationId, active: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function previewBookingPolicy(
  db: Db,
  input: { organizationId: string; bookingId: string; orderTotalCents: number; attendees: number },
) {
  const booking = await db.lunchBooking.findFirst({
    where: { id: input.bookingId, organizationId: input.organizationId },
  });
  const policy = await loadActivePolicy(db, input.organizationId);
  const purpose = booking?.purpose ?? "";
  return {
    policy,
    decision: evaluateMealPolicy({
      policy: policy
        ? {
            configured: true,
            perPersonCapCents: policy.perPersonCapCents,
            exceptionsPermitted: policy.exceptionsPermitted,
            educationalPurposeRequired: policy.educationalPurposeRequired,
            version: policy.version,
          }
        : null,
      educationalPurposeDocumented: purpose.trim().length >= 8 && !ENTERTAINMENT.test(purpose),
      isEntertainment: ENTERTAINMENT.test(purpose),
      referralLinked: REFERRAL.test(purpose),
      orderTotalCents: input.orderTotalCents,
      eligibleAttendees: input.attendees,
    }),
  };
}

export async function evaluateBooking(
  db: Db,
  input: { organizationId: string; bookingId: string; orderTotalCents: number; attendees: number },
): Promise<PolicyDecision> {
  const booking = await db.lunchBooking.findFirst({
    where: { id: input.bookingId, organizationId: input.organizationId },
  });
  const policy = await loadActivePolicy(db, input.organizationId);
  const purpose = booking?.purpose ?? "";
  const decision = evaluateMealPolicy({
    policy: policy
      ? {
          configured: true,
          perPersonCapCents: policy.perPersonCapCents,
          exceptionsPermitted: policy.exceptionsPermitted,
          educationalPurposeRequired: policy.educationalPurposeRequired,
          version: policy.version,
        }
      : null,
    educationalPurposeDocumented: purpose.trim().length >= 8 && !ENTERTAINMENT.test(purpose),
    isEntertainment: ENTERTAINMENT.test(purpose),
    referralLinked: REFERRAL.test(purpose),
    orderTotalCents: input.orderTotalCents,
    eligibleAttendees: input.attendees,
  });
  await db.policyEvaluation.create({
    data: {
      organizationId: input.organizationId,
      bookingId: input.bookingId,
      policyId: policy?.id,
      result: decision.result,
      findings: decision.findings,
    },
  });
  return decision;
}

export async function recordCateringHandoff(
  db: Db,
  input: { organizationId: string; userId: string; bookingId: string; vendor: string },
) {
  const booking = await db.lunchBooking.findFirst({
    where: { id: input.bookingId, organizationId: input.organizationId },
    include: { order: true },
  });
  if (!booking?.order) return { ok: false as const, error: "Lunch order was not found." };
  if (input.vendor !== "ezcater" && input.vendor !== "doordash") {
    return { ok: false as const, error: "That catering provider is not available." };
  }
  await db.cateringOrder.update({
    where: { id: booking.order.id },
    data: {
      status: booking.order.finalAmountCents ? booking.order.status : "ORDERING_EXTERNALLY",
      handoffVendor: input.vendor,
      externalHandoffAt: new Date(),
    },
  });
  await db.auditLog.create({
    data: {
      organizationId: input.organizationId,
      actorId: input.userId,
      action: "catering.handoff",
      entityType: "CateringOrder",
      entityId: booking.order.id,
      metadata: { vendor: input.vendor },
    },
  });
  return { ok: true as const };
}

export async function recordCateringOrder(
  db: Db,
  input: {
    organizationId: string;
    userId: string;
    bookingId: string;
    vendor: string;
    finalAmountCents: number;
    orderReference: string;
    attendees: number;
    receiptNote: string;
    status: "ORDER_RECORDED" | "COMPLETED" | "CANCELED";
  },
) {
  const booking = await db.lunchBooking.findFirst({
    where: { id: input.bookingId, organizationId: input.organizationId },
    include: { order: true },
  });
  if (!booking?.order) return { ok: false as const, error: "Lunch order was not found." };
  if (input.finalAmountCents < 0) {
    return { ok: false as const, error: "Amount cannot be negative." };
  }

  const decision = await evaluateBooking(db, {
    organizationId: input.organizationId,
    bookingId: booking.id,
    orderTotalCents: input.finalAmountCents,
    attendees: input.attendees,
  });
  const exception = await db.policyExceptionRequest.findFirst({
    where: { organizationId: input.organizationId, bookingId: booking.id },
    orderBy: { createdAt: "desc" },
  });
  const gate = canRecordOrder({
    decision,
    exceptionStatus: (exception?.status as "approved" | "pending" | "denied" | "prohibited" | undefined) ?? "none",
  });
  if (input.status !== "CANCELED" && !gate.allowed) {
    return { ok: false as const, error: gate.reason, decision };
  }

  const perPerson = perPersonCents(input.finalAmountCents, input.attendees);
  await db.cateringOrder.update({
    where: { id: booking.order.id },
    data: {
      vendor: input.vendor,
      status: input.status,
      finalAmountCents: input.finalAmountCents,
      confirmedAttendees: input.attendees,
      orderReference: input.orderReference || null,
      placedAt: new Date(),
    },
  });
  if (input.receiptNote.trim()) {
    await db.orderReceipt.create({
      data: {
        orderId: booking.order.id,
        note: input.receiptNote.trim(),
        reference: input.orderReference || null,
        amountCents: input.finalAmountCents,
      },
    });
  }
  if (input.status !== "CANCELED") {
    const existing = await db.officeSpendingEntry.findFirst({
      where: { bookingId: booking.id, organizationId: input.organizationId },
    });
    const data = {
      kind: "recorded",
      amountCents: input.finalAmountCents,
      attendeeCount: input.attendees,
      perPersonCents: perPerson,
      vendor: input.vendor,
      occurredOn: booking.slotStartsAt,
      policyStatus: decision.result,
      orderId: booking.order.id,
    };
    if (existing) {
      await db.officeSpendingEntry.update({ where: { id: existing.id }, data });
    } else {
      await db.officeSpendingEntry.create({
        data: {
          ...data,
          organizationId: input.organizationId,
          accountId: booking.accountId,
          bookingId: booking.id,
        },
      });
    }
  }
  await db.auditLog.create({
    data: {
      organizationId: input.organizationId,
      actorId: input.userId,
      action: "catering.recorded",
      entityType: "CateringOrder",
      entityId: booking.order.id,
      metadata: { status: input.status, finalAmountCents: input.finalAmountCents },
    },
  });
  return { ok: true as const, decision };
}

export async function requestPolicyException(
  db: Db,
  input: { organizationId: string; userId: string; bookingId: string; reason: string; orderTotalCents: number; attendees: number },
) {
  const decision = await evaluateBooking(db, input);
  const prohibited = exceptionIsProhibited(decision);
  const request = await db.policyExceptionRequest.create({
    data: {
      organizationId: input.organizationId,
      bookingId: input.bookingId,
      requestedById: input.userId,
      reason: input.reason.trim(),
      status: prohibited ? "prohibited" : "pending",
      prohibited,
      reviewNote: prohibited
        ? "Approval cannot override a prohibition. Entertainment and referral-linked meals stay blocked."
        : null,
    },
  });
  return { ok: true as const, request, decision };
}

export async function reviewPolicyException(
  db: Db,
  input: {
    organizationId: string;
    reviewerId: string;
    requestId: string;
    approve: boolean;
    note: string;
  },
) {
  const request = await db.policyExceptionRequest.findFirst({
    where: { id: input.requestId, organizationId: input.organizationId },
  });
  if (!request) return { ok: false as const, error: "Exception request was not found." };
  if (request.prohibited) {
    await db.policyExceptionRequest.update({
      where: { id: request.id },
      data: {
        status: "prohibited",
        reviewedById: input.reviewerId,
        reviewNote: "Approval cannot override a prohibition.",
      },
    });
    return { ok: false as const, error: "Approval cannot override a prohibition." };
  }
  await db.policyExceptionRequest.update({
    where: { id: request.id },
    data: {
      status: input.approve ? "approved" : "denied",
      reviewedById: input.reviewerId,
      reviewNote: input.note,
    },
  });
  await db.approval.create({
    data: {
      organizationId: input.organizationId,
      subjectType: "PolicyExceptionRequest",
      subjectId: request.id,
      gate: "exception",
      status: input.approve ? "approved" : "denied",
      decidedById: input.reviewerId,
      note: input.note,
    },
  });
  return { ok: true as const };
}
