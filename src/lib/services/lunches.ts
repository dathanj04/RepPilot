import type { Db } from "../db";
import { evaluateSlotSelection, evaluateConfirmationLink } from "../domain/invitations";
import { rangesOverlap, computeReminderInstants, reminderIdempotencyKey } from "../domain/reminders";
import { issueSecureLink } from "./links";
import { logEvent } from "../logger";

export async function createInvitation(
  db: Db,
  input: {
    organizationId: string;
    userId: string;
    accountId: string;
    purpose: string;
    recipientName: string;
    recipientEmail: string;
    expiresAt: Date;
    expectedAttendees: number;
    slots: { startsAt: Date; endsAt: Date }[];
    estimatedBudgetCents: number | null;
    mealPreferences: string;
    deliveryInstructions: string;
  },
) {
  const account = await db.account.findFirst({
    where: { id: input.accountId, organizationId: input.organizationId },
  });
  if (!account) return { ok: false as const, error: "That office is not in your organization." };
  if (input.slots.length === 0) {
    return { ok: false as const, error: "Add at least one time the office is allowed to choose." };
  }
  const entertainment = /\b(golf|game|tickets|entertainment|happy hour)\b/i.test(input.purpose);
  if (entertainment) {
    return {
      ok: false as const,
      error: "Entertainment is disabled. Invitations have to describe an educational purpose.",
    };
  }
  if (input.purpose.trim().length < 8) {
    return { ok: false as const, error: "Describe the educational purpose before sending an invitation." };
  }

  const invitation = await db.lunchInvitation.create({
    data: {
      organizationId: input.organizationId,
      accountId: input.accountId,
      createdById: input.userId,
      purpose: input.purpose.trim(),
      status: "ACTIVE",
      recipientName: input.recipientName.trim() || null,
      recipientEmail: input.recipientEmail.trim() || null,
      expiresAt: input.expiresAt,
      slots: {
        create: input.slots.map((slot) => ({
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          status: "offered",
        })),
      },
    },
    include: { slots: true },
  });

  const link = await issueSecureLink(db, {
    organizationId: input.organizationId,
    purpose: "invitation",
    accountId: account.id,
    invitationId: invitation.id,
    expiresAt: input.expiresAt,
  });

  await db.auditLog.create({
    data: {
      organizationId: input.organizationId,
      actorId: input.userId,
      action: "invitation.created",
      entityType: "LunchInvitation",
      entityId: invitation.id,
      metadata: {
        slotCount: input.slots.length,
        estimatedBudgetCents: input.estimatedBudgetCents,
        expectedAttendees: input.expectedAttendees,
        mealPreferences: input.mealPreferences,
        deliveryInstructions: input.deliveryInstructions,
      },
    },
  });

  return {
    ok: true as const,
    invitation,
    token: link.token,
    estimatedBudgetCents: input.estimatedBudgetCents,
    expectedAttendees: input.expectedAttendees,
    mealPreferences: input.mealPreferences,
    deliveryInstructions: input.deliveryInstructions,
  };
}

export async function acceptInvitationSlot(
  db: Db,
  input: {
    tokenHash: string;
    slotId: string;
    now: Date;
    responderName?: string;
    catering?: { requested: boolean; attendees?: number | null; dietary?: string; deliveryInstructions?: string };
  },
) {
  const link = await db.secureLinkToken.findFirst({
    where: { tokenHash: input.tokenHash, purpose: "invitation", revokedAt: null },
  });
  if (!link?.invitationId) {
    return { ok: false as const, error: "This invitation link is not valid." };
  }

  try {
    const booking = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "LunchInvitation" WHERE id = ${link.invitationId} FOR UPDATE`;
      const invitation = await tx.lunchInvitation.findUnique({
        where: { id: link.invitationId! },
        include: { slots: true, createdBy: true, account: true },
      });
      if (!invitation) throw new Error("This invitation link is not valid.");
      const slot = invitation.slots.find((item) => item.id === input.slotId);
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${invitation.createdById} FOR UPDATE`;
      const existing = await tx.lunchBooking.findMany({
        where: {
          representativeId: invitation.createdById,
          status: { not: "CANCELED" },
        },
      });
      const hasConflict = slot
        ? existing.some((booking) =>
            rangesOverlap(booking.slotStartsAt, booking.slotEndsAt, slot.startsAt, slot.endsAt),
          )
        : false;
      const decision = evaluateSlotSelection({
        invitationStatus: invitation.status,
        expiresAt: invitation.expiresAt,
        now: input.now,
        revoked: false,
        slotBelongsToInvitation: Boolean(slot && slot.status === "offered"),
        representativeAuthorized: invitation.status === "ACTIVE",
        hasConflict,
      });
      if (!decision.ok || !slot) {
        if (invitation.expiresAt <= input.now && invitation.status === "ACTIVE") {
          await tx.lunchInvitation.update({
            where: { id: invitation.id },
            data: { status: "EXPIRED" },
          });
        }
        throw new Error(decision.ok ? "That time was not offered." : decision.reason);
      }

      const audit = await tx.auditLog.findFirst({
        where: { entityId: invitation.id, action: "invitation.created" },
      });
      const meta = (audit?.metadata ?? {}) as {
        expectedAttendees?: number;
        estimatedBudgetCents?: number | null;
        mealPreferences?: string;
        deliveryInstructions?: string;
      };

      const catering = input.catering?.requested ? input.catering : null;
      const attendees = catering?.attendees && catering.attendees >= 1 && catering.attendees <= 200
        ? catering.attendees
        : meta.expectedAttendees ?? 8;
      const dietary = (catering?.dietary || meta.mealPreferences || "").trim().slice(0, 500);
      const delivery = (catering?.deliveryInstructions || meta.deliveryInstructions || "").trim().slice(0, 500);
      const created = await tx.lunchBooking.create({
        data: {
          organizationId: invitation.organizationId,
          accountId: invitation.accountId,
          representativeId: invitation.createdById,
          invitationId: invitation.id,
          slotStartsAt: slot.startsAt,
          slotEndsAt: slot.endsAt,
          status: "AWAITING_APPROVAL",
          purpose: invitation.purpose,
          expectedAttendees: attendees,
          timezone: "America/Chicago",
          mealPreferences: dietary || null,
          deliveryInstructions: delivery || null,
          estimatedBudgetCents: meta.estimatedBudgetCents ?? null,
          confirmedByName: input.responderName?.trim() || null,
          order: {
            create: {
              organizationId: invitation.organizationId,
              accountId: invitation.accountId,
              status: "NOT_STARTED",
              approvalStatus: catering ? "PENDING" : "NOT_REQUESTED",
              estimatedAmountCents: meta.estimatedBudgetCents ?? null,
              confirmedAttendees: attendees,
              targetDeliveryAt: slot.startsAt,
              deliveryInstructions: delivery || null,
            },
          },
        },
      });

      await tx.invitationTimeSlot.update({
        where: { id: slot.id },
        data: { status: "selected" },
      });
      await tx.invitationTimeSlot.updateMany({
        where: { invitationId: invitation.id, id: { not: slot.id } },
        data: { status: "unavailable" },
      });
      await tx.lunchInvitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED", selectedSlotId: slot.id },
      });
      await tx.secureLinkToken.update({
        where: { id: link.id },
        data: { revokedAt: input.now },
      });

      await tx.calendarEventMapping.create({
        data: {
          organizationId: invitation.organizationId,
          userId: invitation.createdById,
          provider: "internal",
          lunchBookingId: created.id,
          title: `Tentative hold · not confirmed · ${invitation.account.name}`,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          syncState: "tentative",
        },
      });

      await tx.notification.create({
        data: {
          organizationId: invitation.organizationId,
          userId: invitation.createdById,
          kind: "lunch_requested",
          title: "Lunch time requested",
          body: catering
            ? `${invitation.account.name} requested a time and sponsored catering. The calendar and the order each need approval.`
            : `${invitation.account.name} requested a time you offered. It is not confirmed until you approve it.`,
          href: `/lunches/${created.id}`,
        },
      });

      return created;
    });

    logEvent("info", "invitation.accepted", { bookingId: booking.id });
    return { ok: true as const, bookingId: booking.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const safe = message && !/prisma|invocation/i.test(message)
      ? message
      : "That time could not be requested. Ask your representative for a new invitation.";
    return { ok: false as const, error: safe };
  }
}

export async function confirmLunch(
  db: Db,
  input: {
    tokenHash: string;
    now: Date;
    responderName?: string;
    attendeeCount?: number | null;
    deliveryInstructions?: string;
  },
) {
  const link = await db.secureLinkToken.findFirst({
    where: { tokenHash: input.tokenHash, purpose: "lunch_confirmation", revokedAt: null },
    include: { booking: true },
  });
  if (!link?.booking) {
    return { ok: false as const, error: "This confirmation link is not valid." };
  }
  const decision = evaluateConfirmationLink({
    revoked: Boolean(link.revokedAt),
    expiresAt: link.expiresAt,
    now: input.now,
    bookingStatus: link.booking.status,
  });
  if (!decision.ok) return { ok: false as const, error: decision.reason };

  const attendees = input.attendeeCount ?? link.booking.confirmedAttendees ?? link.booking.expectedAttendees;
  if (!Number.isFinite(attendees) || attendees < 1 || attendees > 200) {
    return { ok: false as const, error: "Enter an attendee count between 1 and 200." };
  }

  await db.lunchBooking.update({
    where: { id: link.booking.id },
    data: {
      status: "CONFIRMED",
      confirmedAt: input.now,
      confirmedByName: input.responderName?.trim() || link.booking.confirmedByName,
      confirmedAttendees: attendees,
      deliveryInstructions: input.deliveryInstructions?.trim()
        ? input.deliveryInstructions.trim().slice(0, 500)
        : link.booking.deliveryInstructions,
    },
  });
  await db.lunchConfirmation.upsert({
    where: { bookingId: link.booking.id },
    update: { confirmedAt: input.now, attendeeCount: attendees },
    create: { bookingId: link.booking.id, confirmedAt: input.now, attendeeCount: attendees },
  });
  await db.notification.create({
    data: {
      organizationId: link.booking.organizationId,
      userId: link.booking.representativeId,
      kind: "lunch_confirmed",
      title: "Lunch confirmed",
      body:
        attendees === link.booking.expectedAttendees
          ? "The office confirmed the educational lunch."
          : `The office confirmed the lunch and updated attendance to ${attendees}.`,
      href: `/lunches/${link.booking.id}`,
    },
  });
  await db.auditLog.create({
    data: {
      organizationId: link.booking.organizationId,
      actorId: null,
      action: "lunch.confirmed",
      entityType: "LunchBooking",
      entityId: link.booking.id,
      metadata: { attendees },
    },
  });
  return { ok: true as const, bookingId: link.booking.id, attendees };
}

export async function requestLunchChange(
  db: Db,
  input: { tokenHash: string; now: Date; message: string; requestedAttendees?: number | null },
) {
  const link = await db.secureLinkToken.findFirst({
    where: {
      tokenHash: input.tokenHash,
      purpose: { in: ["lunch_confirmation", "invitation", "office"] },
      revokedAt: null,
    },
    include: { booking: true },
  });
  if (!link?.booking) return { ok: false as const, error: "This link cannot request a change." };
  if (link.booking.status === "CANCELED") {
    return { ok: false as const, error: "This lunch was canceled." };
  }
  const message = input.message.trim();
  if (message.length < 3) return { ok: false as const, error: "Add a short note for your representative." };

  await db.lunchChangeRequest.create({
    data: {
      organizationId: link.booking.organizationId,
      bookingId: link.booking.id,
      message,
      requestedAttendees: input.requestedAttendees ?? null,
    },
  });
  if (link.booking.status !== "COMPLETED") {
    await db.lunchBooking.update({
      where: { id: link.booking.id },
      data: { status: "CHANGE_REQUESTED" },
    });
  }
  await db.notification.create({
    data: {
      organizationId: link.booking.organizationId,
      userId: link.booking.representativeId,
      kind: "lunch_change_requested",
      title: "Office requested a change",
      body: message,
      href: `/lunches/${link.booking.id}`,
    },
  });
  return { ok: true as const };
}

export async function approveLunchBooking(
  db: Db,
  input: { organizationId: string; userId: string; bookingId: string; now: Date },
) {
  const booking = await db.lunchBooking.findFirst({
    where: { id: input.bookingId, organizationId: input.organizationId },
    include: { account: true },
  });
  if (!booking) return { ok: false as const, error: "That lunch is not in your organization." };
  if (booking.representativeId !== input.userId) return { ok: false as const, error: "Only the assigned representative can approve this lunch." };
  if (booking.status !== "AWAITING_APPROVAL") return { ok: false as const, error: "This lunch is not waiting for approval." };
  const [lunches, meetings] = await Promise.all([
    db.lunchBooking.findMany({
      where: {
        representativeId: booking.representativeId,
        id: { not: booking.id },
        status: { notIn: ["CANCELED", "AWAITING_APPROVAL", "COMPLETED"] },
      },
    }),
    db.meeting.findMany({ where: { organizationId: input.organizationId, userId: booking.representativeId, status: "CONFIRMED" } }),
  ]);
  const overlap = [...lunches.map((item) => rangesOverlap(item.slotStartsAt, item.slotEndsAt, booking.slotStartsAt, booking.slotEndsAt)), ...meetings.map((item) => rangesOverlap(item.startsAt, item.endsAt, booking.slotStartsAt, booking.slotEndsAt))].some(Boolean);
  if (overlap) return { ok: false as const, error: "That time now conflicts with another commitment. The lunch stays unapproved." };

  const audit = await db.auditLog.findFirst({ where: { entityId: booking.invitationId ?? "", action: "invitation.created" } });
  const meta = (audit?.metadata ?? {}) as { expectedAttendees?: number; estimatedBudgetCents?: number | null };
  await db.$transaction(async (tx) => {
    const current = await tx.lunchBooking.findFirst({ where: { id: booking.id, status: "AWAITING_APPROVAL" } });
    if (!current) return;
    await tx.lunchBooking.update({ where: { id: booking.id }, data: { status: "SCHEDULED" } });
    await tx.calendarEventMapping.updateMany({
      where: { lunchBookingId: booking.id, syncState: "tentative" },
      data: { title: `Educational lunch · ${booking.account.name}`, syncState: "internal" },
    });
    const reminders = computeReminderInstants(booking.slotStartsAt, booking.timezone);
    const existingReminders = await tx.lunchReminder.count({ where: { bookingId: booking.id } });
    if (existingReminders === 0) {
      await tx.lunchReminder.createMany({
        data: (Object.keys(reminders) as (keyof typeof reminders)[]).map((kind) => ({
          organizationId: booking.organizationId,
          bookingId: booking.id,
          kind,
          scheduledFor: reminders[kind],
          status: "SCHEDULED",
          idempotencyKey: reminderIdempotencyKey(booking.id, kind, booking.slotStartsAt.toISOString()),
        })),
      });
    }
    if (meta.estimatedBudgetCents && meta.estimatedBudgetCents > 0) {
      const spending = await tx.officeSpendingEntry.count({ where: { bookingId: booking.id, kind: "commitment" } });
      if (spending === 0) {
        await tx.officeSpendingEntry.create({
          data: {
            organizationId: booking.organizationId,
            accountId: booking.accountId,
            bookingId: booking.id,
            kind: "commitment",
            amountCents: meta.estimatedBudgetCents,
            attendeeCount: meta.expectedAttendees ?? booking.expectedAttendees,
            occurredOn: booking.slotStartsAt,
            policyStatus: "pending",
          },
        });
      }
    }
    await tx.notification.create({
      data: {
        organizationId: booking.organizationId,
        userId: booking.representativeId,
        kind: "lunch_scheduled",
        title: "Lunch approved",
        body: `${booking.account.name} is on your RepPilot calendar. No external calendar was written by this approval.`,
        href: `/lunches/${booking.id}`,
      },
    });
    await tx.approval.create({
      data: {
        organizationId: booking.organizationId,
        subjectType: "LunchBooking",
        subjectId: booking.id,
        gate: "meeting",
        status: "approved",
        decidedById: input.userId,
        note: "Representative approved the lunch time.",
      },
    });
    await tx.auditLog.create({
      data: {
        organizationId: booking.organizationId,
        actorId: input.userId,
        action: "lunch.approved",
        entityType: "LunchBooking",
        entityId: booking.id,
      },
    });
  });
  return { ok: true as const, bookingId: booking.id };
}

export async function issueConfirmationLink(db: Db, bookingId: string, now: Date) {
  const booking = await db.lunchBooking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.status === "CANCELED" || booking.status === "AWAITING_APPROVAL") return null;
  await db.secureLinkToken.updateMany({
    where: { bookingId, purpose: "lunch_confirmation", revokedAt: null },
    data: { revokedAt: now },
  });
  const expiresAt = new Date(booking.slotStartsAt.getTime() + 60 * 60 * 1000);
  const link = await issueSecureLink(db, {
    organizationId: booking.organizationId,
    purpose: "lunch_confirmation",
    accountId: booking.accountId,
    bookingId: booking.id,
    expiresAt,
  });
  await db.lunchConfirmation.upsert({
    where: { bookingId: booking.id },
    update: { revokedAt: null },
    create: { bookingId: booking.id },
  });
  return link.token;
}
