import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPrisma } from "../src/lib/db";
import { hashToken } from "../src/lib/domain/tokens";
import { saveCheckIn } from "../src/lib/services/checkins";
import { acceptInvitationSlot, confirmLunch, createInvitation } from "../src/lib/services/lunches";
import { recordCateringOrder, requestPolicyException } from "../src/lib/services/orders";
import { processDueReminders } from "../src/lib/services/reminders";
import { renderReminderEmail } from "../src/lib/email/templates";
import { issueSecureLink } from "../src/lib/services/links";

const prisma = createPrisma(process.env.DATABASE_URL_TEST || process.env.DATABASE_URL || "");
const now = new Date("2026-10-13T15:00:00.000Z");

async function fixture() {
  const role = await prisma.role.upsert({
    where: { key: "REP" },
    update: {},
    create: {
      key: "REP",
      name: "Representative",
      description: "Field representative",
      scope: "organization",
    },
  });
  const orgA = await prisma.organization.create({
    data: { name: "Test Org A", slug: `test-a-${Date.now()}`, timezone: "America/Chicago" },
  });
  const orgB = await prisma.organization.create({
    data: { name: "Test Org B", slug: `test-b-${Date.now()}`, timezone: "America/Chicago" },
  });
  const user = await prisma.user.create({
    data: {
      email: `rep-${Date.now()}@example-health.test`,
      name: "Test Rep",
      passwordHash: "not-used",
      timezone: "America/Chicago",
    },
  });
  await prisma.organizationMembership.create({
    data: { organizationId: orgA.id, userId: user.id, roleId: role.id },
  });
  const accountA = await prisma.account.create({
    data: {
      organizationId: orgA.id,
      name: "Test Clinic A",
      specialty: "Family Medicine",
      street: "1 Test St",
      city: "Frisco",
      state: "TX",
      zip: "75034",
      latitude: 33.15,
      longitude: -96.82,
      email: "clinic-a@example.com",
    },
  });
  const accountB = await prisma.account.create({
    data: {
      organizationId: orgB.id,
      name: "Test Clinic B",
      specialty: "Pediatrics",
      street: "2 Test St",
      city: "Plano",
      state: "TX",
      zip: "75024",
      email: "clinic-b@example.com",
    },
  });
  return { orgA, orgB, user, accountA, accountB };
}

describe("workflow persistence", () => {
  beforeAll(async () => {
    await prisma.organization.deleteMany({ where: { slug: { startsWith: "test-" } } });
  });
  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { slug: { startsWith: "test-" } } });
    await prisma.$disconnect();
  });

  it("keeps offices inside their organization and persists a check-in", async () => {
    const { orgA, orgB, user, accountA, accountB } = await fixture();
    const hidden = await prisma.account.findFirst({
      where: { id: accountB.id, organizationId: orgA.id },
    });
    expect(hidden).toBeNull();
    const saved = await saveCheckIn(prisma, {
      organizationId: orgA.id,
      userId: user.id,
      accountId: accountA.id,
      type: "office_visit",
      outcome: "completed",
      summary: "Left an overview with the front desk.",
      activities: ["left_educational_materials"],
      participants: [{ name: "Front Desk", roleLabel: "front_desk" }],
      tasks: [{ title: "Follow up with office", dueDate: new Date("2026-10-20T17:00:00.000Z") }],
      occurredAt: now,
    });
    expect(saved.ok).toBe(true);
    const account = await prisma.account.findUniqueOrThrow({ where: { id: accountA.id } });
    const timeline = await prisma.accountInteraction.findMany({ where: { accountId: accountA.id } });
    const tasks = await prisma.followUpTask.findMany({ where: { accountId: accountA.id } });
    expect(account.lastVisitAt?.toISOString()).toBe(now.toISOString());
    expect(timeline).toHaveLength(1);
    expect(tasks).toHaveLength(1);
    const wrongOrg = await saveCheckIn(prisma, {
      organizationId: orgB.id,
      userId: user.id,
      accountId: accountA.id,
      type: "note",
      outcome: null,
      summary: "Should not save",
      activities: [],
      participants: [],
      tasks: [],
      occurredAt: now,
    });
    expect(wrongOrg.ok).toBe(false);
    expect(await prisma.accountInteraction.count({ where: { accountId: accountA.id } })).toBe(1);
  });

  it("prevents a second booking, an expired link, and confirmation after cancellation", async () => {
    const { orgA, user, accountA } = await fixture();
    const created = await createInvitation(prisma, {
      organizationId: orgA.id,
      userId: user.id,
      accountId: accountA.id,
      purpose: "Educational program overview for the care team.",
      recipientName: "Office",
      recipientEmail: "clinic-a@example.com",
      expiresAt: new Date("2026-10-20T17:00:00.000Z"),
      expectedAttendees: 6,
      estimatedBudgetCents: 12000,
      mealPreferences: "",
      deliveryInstructions: "",
      slots: [
        { startsAt: new Date("2026-10-21T17:00:00.000Z"), endsAt: new Date("2026-10-21T18:00:00.000Z") },
        { startsAt: new Date("2026-10-23T17:00:00.000Z"), endsAt: new Date("2026-10-23T18:00:00.000Z") },
      ],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const slot = created.invitation.slots[0]!;
    const tokenHash = hashToken(created.token);
    const first = await acceptInvitationSlot(prisma, { tokenHash, slotId: slot.id, now });
    expect(first.ok).toBe(true);
    const second = await acceptInvitationSlot(prisma, { tokenHash, slotId: slot.id, now });
    expect(second.ok).toBe(false);
    expect(await prisma.lunchBooking.count({ where: { invitationId: created.invitation.id } })).toBe(1);

    const expired = await createInvitation(prisma, {
      organizationId: orgA.id,
      userId: user.id,
      accountId: accountA.id,
      purpose: "Educational overview for a later week.",
      recipientName: "Office",
      recipientEmail: "clinic-a@example.com",
      expiresAt: new Date("2026-10-01T17:00:00.000Z"),
      expectedAttendees: 4,
      estimatedBudgetCents: null,
      mealPreferences: "",
      deliveryInstructions: "",
      slots: [{ startsAt: new Date("2026-10-28T17:00:00.000Z"), endsAt: new Date("2026-10-28T18:00:00.000Z") }],
    });
    expect(expired.ok).toBe(true);
    if (!expired.ok) return;
    const expiredResult = await acceptInvitationSlot(prisma, {
      tokenHash: hashToken(expired.token),
      slotId: expired.invitation.slots[0]!.id,
      now,
    });
    expect(expiredResult.ok).toBe(false);

    if (!first.ok) return;
    await prisma.lunchBooking.update({ where: { id: first.bookingId }, data: { status: "CANCELED" } });
    const confirmLink = await issueSecureLink(prisma, {
      organizationId: orgA.id,
      purpose: "lunch_confirmation",
      accountId: accountA.id,
      bookingId: first.bookingId,
      expiresAt: new Date("2026-10-21T18:00:00.000Z"),
    });
    const confirm = await confirmLunch(prisma, { tokenHash: hashToken(confirmLink.token), now });
    expect(confirm.ok).toBe(false);
  });

  it("sends a due reminder once and blocks a prohibited meal", async () => {
    const { orgA, user, accountA } = await fixture();
    const booking = await prisma.lunchBooking.create({
      data: {
        organizationId: orgA.id,
        accountId: accountA.id,
        representativeId: user.id,
        slotStartsAt: new Date("2026-10-14T17:00:00.000Z"),
        slotEndsAt: new Date("2026-10-14T18:00:00.000Z"),
        status: "SCHEDULED",
        purpose: "Educational overview.",
        expectedAttendees: 4,
        timezone: "America/Chicago",
        order: { create: { organizationId: orgA.id, accountId: accountA.id, status: "NOT_STARTED" } },
      },
    });
    await prisma.lunchReminder.create({
      data: {
        organizationId: orgA.id,
        bookingId: booking.id,
        kind: "SEVEN_DAY",
        scheduledFor: new Date("2026-10-07T17:00:00.000Z"),
        status: "SCHEDULED",
        idempotencyKey: `reminder:${booking.id}:SEVEN_DAY:test`,
      },
    });
    const sent: string[] = [];
    const run = () =>
      processDueReminders(prisma, now, {
        appUrl: "http://127.0.0.1:43123",
        render: renderReminderEmail,
        send: async (email) => {
          sent.push(email.idempotencyKey);
        },
      });
    await run();
    await run();
    expect(sent).toEqual([`reminder:${booking.id}:SEVEN_DAY:test`]);
    const reminder = await prisma.lunchReminder.findFirstOrThrow({ where: { bookingId: booking.id } });
    expect(reminder.status).toBe("SENT");

    await prisma.mealPolicy.create({
      data: {
        organizationId: orgA.id,
        name: "Test policy",
        version: "1",
        active: true,
        perPersonCapCents: 2500,
        exceptionsPermitted: true,
        educationalPurposeRequired: true,
      },
    });
    await prisma.lunchBooking.update({
      where: { id: booking.id },
      data: { purpose: "Golf entertainment outing" },
    });
    const recorded = await recordCateringOrder(prisma, {
      organizationId: orgA.id,
      userId: user.id,
      bookingId: booking.id,
      vendor: "ezcater",
      finalAmountCents: 10000,
      orderReference: "X",
      attendees: 4,
      receiptNote: "",
      status: "ORDER_RECORDED",
    });
    expect(recorded.ok).toBe(false);
    const exception = await requestPolicyException(prisma, {
      organizationId: orgA.id,
      userId: user.id,
      bookingId: booking.id,
      reason: "Please allow it",
      orderTotalCents: 10000,
      attendees: 4,
    });
    expect(exception.request.status).toBe("prohibited");
    const order = await prisma.cateringOrder.findUniqueOrThrow({ where: { bookingId: booking.id } });
    expect(order.status).toBe("NOT_STARTED");
  });
});
