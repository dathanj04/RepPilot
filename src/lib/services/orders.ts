import type { Db } from "../db";
import { assertCostParts, CATERING_REVIEW_ROLES, cateringGates, receiptFileAllowed, type CostParts } from "../domain/catering";
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
    where: { id: input.bookingId, organizationId: input.organizationId, representativeId: input.userId },
    include: { order: true },
  });
  if (!booking?.order) return { ok: false as const, error: "Lunch order was not found." };
  if (input.vendor !== "ezcater" && input.vendor !== "doordash") {
    return { ok: false as const, error: "That catering provider is not available." };
  }
  const gates = cateringGates({ lunchStatus: booking.status, approvalStatus: booking.order.approvalStatus });
  if (gates.reason) return { ok: false as const, error: gates.reason };
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
    parts?: CostParts;
    deliveryStatus?: "NOT_TRACKED" | "RECORDED_BY_REP";
    receiptFile?: { fileName: string; contentType: string; bytes: Uint8Array } | null;
  },
) {
  const booking = await db.lunchBooking.findFirst({
    where: { id: input.bookingId, organizationId: input.organizationId, representativeId: input.userId },
    include: { order: true },
  });
  if (!booking?.order) return { ok: false as const, error: "Lunch order was not found." };
  if (input.finalAmountCents < 0) {
    return { ok: false as const, error: "Amount cannot be negative." };
  }
  if (input.status !== "CANCELED") {
    const gates = cateringGates({ lunchStatus: booking.status, approvalStatus: booking.order.approvalStatus });
    if (gates.reason) return { ok: false as const, error: gates.reason };
    if (input.orderReference.trim().length < 3) {
      return { ok: false as const, error: "Enter the order reference from the provider. RepPilot does not create one." };
    }
  }
  const parts = input.parts ?? {
    subtotalCents: null,
    taxCents: null,
    feeCents: null,
    deliveryCents: null,
    tipCents: null,
  };
  const partsCheck = assertCostParts(parts, input.finalAmountCents);
  if (!partsCheck.ok) return partsCheck;
  if (input.receiptFile) {
    const fileCheck = receiptFileAllowed({ contentType: input.receiptFile.contentType, byteSize: input.receiptFile.bytes.byteLength });
    if (!fileCheck.ok) return fileCheck;
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
      placedAt: input.status === "CANCELED" ? booking.order.placedAt : new Date(),
      subtotalCents: parts.subtotalCents,
      taxCents: parts.taxCents,
      feeCents: parts.feeCents,
      deliveryCents: parts.deliveryCents,
      tipCents: parts.tipCents,
      deliveryStatus: input.deliveryStatus ?? booking.order.deliveryStatus,
    },
  });
  if (input.receiptNote.trim() || input.receiptFile) {
    await db.orderReceipt.create({
      data: {
        orderId: booking.order.id,
        note: input.receiptNote.trim() || null,
        reference: input.orderReference || null,
        amountCents: input.finalAmountCents,
        fileName: input.receiptFile?.fileName ?? null,
        contentType: input.receiptFile?.contentType ?? null,
        byteSize: input.receiptFile?.bytes.byteLength ?? null,
        content: input.receiptFile ? Buffer.from(input.receiptFile.bytes) : null,
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

export async function requestCateringApproval(
  db: Db,
  input: {
    organizationId: string;
    userId: string;
    bookingId: string;
    attendees: number;
    estimatedAmountCents: number | null;
    dietary: string;
    deliveryInstructions: string;
  },
) {
  const booking = await db.lunchBooking.findFirst({
    where: { id: input.bookingId, organizationId: input.organizationId },
    include: { order: true, account: true },
  });
  if (!booking) return { ok: false as const, error: "That lunch is not in your organization." };
  if (booking.representativeId !== input.userId) {
    return { ok: false as const, error: "Only the assigned representative can submit catering for approval." };
  }
  const meetingApproved = cateringGates({ lunchStatus: booking.status, approvalStatus: "APPROVED" }).meetingApproved;
  if (!meetingApproved) return { ok: false as const, error: "Approve the lunch time before submitting catering." };
  if (booking.order?.approvalStatus === "APPROVED") {
    return { ok: false as const, error: "Catering is already approved." };
  }
  if (!Number.isFinite(input.attendees) || input.attendees < 1 || input.attendees > 200) {
    return { ok: false as const, error: "Enter an attendee count between 1 and 200." };
  }
  const dietary = input.dietary.trim().slice(0, 500);
  const delivery = input.deliveryInstructions.trim().slice(0, 500);
  const order = booking.order
    ? await db.cateringOrder.update({
        where: { id: booking.order.id },
        data: {
          approvalStatus: "PENDING",
          estimatedAmountCents: input.estimatedAmountCents,
          confirmedAttendees: input.attendees,
          deliveryInstructions: delivery || null,
          status: booking.order.finalAmountCents ? booking.order.status : "NOT_STARTED",
        },
      })
    : await db.cateringOrder.create({
        data: {
          organizationId: booking.organizationId,
          bookingId: booking.id,
          accountId: booking.accountId,
          status: "NOT_STARTED",
          approvalStatus: "PENDING",
          estimatedAmountCents: input.estimatedAmountCents,
          confirmedAttendees: input.attendees,
          targetDeliveryAt: booking.slotStartsAt,
          deliveryInstructions: delivery || null,
        },
      });
  await db.lunchBooking.update({
    where: { id: booking.id },
    data: {
      expectedAttendees: input.attendees,
      mealPreferences: dietary || null,
      deliveryInstructions: delivery || booking.deliveryInstructions,
      estimatedBudgetCents: input.estimatedAmountCents,
    },
  });
  const reviewers = await db.organizationMembership.findMany({
    where: { organizationId: input.organizationId, role: { key: { in: [...CATERING_REVIEW_ROLES] } } },
    select: { userId: true },
  });
  if (reviewers.length > 0) {
    await db.notification.createMany({
      data: reviewers
        .filter((reviewer) => reviewer.userId !== input.userId)
        .map((reviewer) => ({
          organizationId: input.organizationId,
          userId: reviewer.userId,
          kind: "catering_requested",
          title: "Catering needs approval",
          body: `${booking.account.name} has a catering request. The meal is not ordered.`,
          href: "/manager",
        })),
    });
  }
  await db.auditLog.create({
    data: {
      organizationId: input.organizationId,
      actorId: input.userId,
      action: "catering.requested",
      entityType: "CateringOrder",
      entityId: order.id,
      metadata: { attendees: input.attendees, estimatedAmountCents: input.estimatedAmountCents },
    },
  });
  return { ok: true as const, orderId: order.id };
}

export async function decideCateringApproval(
  db: Db,
  input: {
    organizationId: string;
    reviewerId: string;
    reviewerRole: string;
    bookingId: string;
    approve: boolean;
    note: string;
  },
) {
  if (!CATERING_REVIEW_ROLES.includes(input.reviewerRole as (typeof CATERING_REVIEW_ROLES)[number])) {
    return { ok: false as const, error: "You cannot review catering requests." };
  }
  const booking = await db.lunchBooking.findFirst({
    where: { id: input.bookingId, organizationId: input.organizationId },
    include: { order: true, account: true },
  });
  if (!booking?.order) return { ok: false as const, error: "That catering request is not in your organization." };
  if (booking.representativeId === input.reviewerId) {
    return { ok: false as const, error: "The representative who owns this lunch cannot approve its catering." };
  }
  if (booking.order.approvalStatus !== "PENDING") {
    return { ok: false as const, error: "This catering request is not waiting for review." };
  }
  const meetingApproved = cateringGates({ lunchStatus: booking.status, approvalStatus: "APPROVED" }).meetingApproved;
  if (!meetingApproved) return { ok: false as const, error: "Approve the lunch time before reviewing catering." };
  const approved = input.approve;
  await db.cateringOrder.update({
    where: { id: booking.order.id },
    data: { approvalStatus: approved ? "APPROVED" : "DECLINED" },
  });
  await db.approval.create({
    data: {
      organizationId: input.organizationId,
      subjectType: "CateringOrder",
      subjectId: booking.order.id,
      gate: "catering",
      status: approved ? "approved" : "declined",
      decidedById: input.reviewerId,
      note: input.note.trim() || null,
    },
  });
  await db.notification.create({
    data: {
      organizationId: input.organizationId,
      userId: booking.representativeId,
      kind: "catering_decided",
      title: approved ? "Catering approved" : "Catering declined",
      body: approved
        ? `${booking.account.name} catering is approved. Place the order on the provider site, then record the reference.`
        : `${booking.account.name} catering was declined. No order was placed.`,
      href: `/lunches/${booking.id}`,
    },
  });
  await db.auditLog.create({
    data: {
      organizationId: input.organizationId,
      actorId: input.reviewerId,
      action: approved ? "catering.approved" : "catering.declined",
      entityType: "CateringOrder",
      entityId: booking.order.id,
      metadata: { note: input.note.trim() },
    },
  });
  return { ok: true as const };
}
