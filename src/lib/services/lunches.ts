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
  input: { tokenHash: string; slotId: string; now: Date; responderName?: string },
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

      const created = await tx.lunchBooking.create({
        data: {
          organizationId: invitation.organizationId,
          accountId: invitation.accountId,
          representativeId: invitation.createdById,
          invitationId: invitation.id,
          slotStartsAt: slot.startsAt,
          slotEndsAt: slot.endsAt,
          status: "SCHEDULED",
          purpose: invitation.purpose,
          expectedAttendees: meta.expectedAttendees ?? 8,
          timezone: "America/Chicago",
          mealPreferences: meta.mealPreferences || null,
          deliveryInstructions: meta.deliveryInstructions || null,
          estimatedBudgetCents: meta.estimatedBudgetCents ?? null,
          order: {
            create: {
              organizationId: invitation.organizationId,
              accountId: invitation.accountId,
              status: "NOT_STARTED",
              estimatedAmountCents: meta.estimatedBudgetCents ?? null,
              confirmedAttendees: meta.expectedAttendees ?? 8,
              targetDeliveryAt: slot.startsAt,
              deliveryInstructions: meta.deliveryInstructions || null,
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

      const reminders = computeReminderInstants(slot.startsAt, "America/Chicago");
      await tx.lunchReminder.createMany({
        data: (Object.keys(reminders) as (keyof typeof reminders)[]).map((kind) => ({
          organizationId: invitation.organizationId,
          bookingId: created.id,
          kind,
          scheduledFor: reminders[kind],
          status: "SCHEDULED",
          idempotencyKey: reminderIdempotencyKey(created.id, kind, slot.startsAt.toISOString()),
        })),
      });

      if (meta.estimatedBudgetCents && meta.estimatedBudgetCents > 0) {
        await tx.officeSpendingEntry.create({
          data: {
            organizationId: invitation.organizationId,
            accountId: invitation.accountId,
            bookingId: created.id,
            kind: "commitment",
            amountCents: meta.estimatedBudgetCents,
            attendeeCount: meta.expectedAttendees ?? 8,
            vendor: null,
            occurredOn: slot.startsAt,
            policyStatus: "pending",
          },
        });
      }

      await tx.calendarEventMapping.create({
        data: {
          organizationId: invitation.organizationId,
          userId: invitation.createdById,
          provider: "internal",
          lunchBookingId: created.id,
          title: `Educational lunch · ${invitation.account.name}`,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          syncState: "internal",
        },
      });

      await tx.notification.create({
        data: {
          organizationId: invitation.organizationId,
          userId: invitation.createdById,
          kind: "lunch_scheduled",
          title: "Lunch time selected",
          body: `${invitation.account.name} selected a time you offered.`,
          href: `/lunches/${created.id}`,
        },
      });

      return created;
    });

    logEvent("info", "invitation.accepted", { bookingId: booking.id });
    return { ok: true as const, bookingId: booking.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "That time could not be confirmed.";
    return { ok: false as const, error: message };
  }
}

export async function confirmLunch(
  db: Db,
  input: {
    tokenHash: string;
    now: Date;
    responderName?: string;
    attendeeCount?: number | null;
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

export async function issueConfirmationLink(db: Db, bookingId: string, now: Date) {
  const booking = await db.lunchBooking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.status === "CANCELED") return null;
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
