import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPrisma } from "../src/lib/db";
import { hashToken } from "../src/lib/domain/tokens";
import { saveCheckIn } from "../src/lib/services/checkins";
import { acceptInvitationSlot, approveLunchBooking, confirmLunch, createInvitation } from "../src/lib/services/lunches";
import { approveMeetingRequest, createSchedulingInvitation, requestReplacementInvitation, submitMeetingRequest } from "../src/lib/services/meetings";
import { decideCateringApproval, recordCateringHandoff, recordCateringOrder, requestPolicyException } from "../src/lib/services/orders";
import { processDueReminders } from "../src/lib/services/reminders";
import { renderReminderEmail } from "../src/lib/email/templates";
import { issueSecureLink } from "../src/lib/services/links";
import { consumeSharedRateLimit } from "../src/lib/domain/rate-limit-store";
import { findDuplicateAccount } from "../src/lib/services/accounts";
import { prepareVisitBrief, recordReferralSyncAttempt, saveMonthlyTheme } from "../src/lib/services/visit-intelligence";

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
    if (!first.ok) return;
    const held = await prisma.lunchBooking.findUniqueOrThrow({ where: { id: first.bookingId } });
    expect(held.status).toBe("AWAITING_APPROVAL");
    expect(await prisma.calendarEventMapping.count({ where: { lunchBookingId: held.id, syncState: "internal" } })).toBe(0);
    const approved = await approveLunchBooking(prisma, { organizationId: orgA.id, userId: user.id, bookingId: held.id, now });
    expect(approved.ok).toBe(true);
    const again = await approveLunchBooking(prisma, { organizationId: orgA.id, userId: user.id, bookingId: held.id, now });
    expect(again.ok).toBe(false);
    expect(await prisma.calendarEventMapping.count({ where: { lunchBookingId: held.id, syncState: "internal" } })).toBe(1);
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

  it("sends one reminder when two workers race and retries a stale claim", async () => {
    const { orgA, user, accountA } = await fixture();
    const booking = await prisma.lunchBooking.create({
      data: {
        organizationId: orgA.id,
        accountId: accountA.id,
        representativeId: user.id,
        slotStartsAt: new Date("2026-10-16T17:00:00.000Z"),
        slotEndsAt: new Date("2026-10-16T18:00:00.000Z"),
        status: "SCHEDULED",
        purpose: "Educational overview.",
        expectedAttendees: 3,
        timezone: "America/Chicago",
      },
    });
    const reminder = await prisma.lunchReminder.create({
      data: {
        organizationId: orgA.id,
        bookingId: booking.id,
        kind: "SEVEN_DAY",
        scheduledFor: new Date("2026-10-12T17:00:00.000Z"),
        status: "SCHEDULED",
        idempotencyKey: `reminder:${booking.id}:SEVEN_DAY:race`,
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
    await Promise.all([run(), run()]);
    expect(sent).toEqual([reminder.idempotencyKey]);

    await prisma.$executeRaw`UPDATE "LunchReminder" SET status = 'SENDING', "updatedAt" = ${new Date("2026-10-01T00:00:00.000Z")} WHERE id = ${reminder.id}`;
    await run();
    expect(sent).toEqual([reminder.idempotencyKey, reminder.idempotencyKey]);
    const stored = await prisma.lunchReminder.findUniqueOrThrow({ where: { id: reminder.id } });
    expect(stored.status).toBe("SENT");
  });

  it("stores the public-token rate limit in postgres", async () => {
    const key = `test-public:${Date.now()}`;
    const first = new Date("2026-10-26T17:00:00.000Z");
    expect((await consumeSharedRateLimit(prisma, key, 2, 60_000, first)).ok).toBe(true);
    expect((await consumeSharedRateLimit(prisma, key, 2, 60_000, new Date(first.getTime() + 10))).ok).toBe(true);
    expect((await consumeSharedRateLimit(prisma, key, 2, 60_000, new Date(first.getTime() + 20))).ok).toBe(false);
    expect((await consumeSharedRateLimit(prisma, key, 2, 60_000, new Date(first.getTime() + 60_001))).ok).toBe(true);
  });

  it("keeps a duplicate office inside its own organization and writes an audit row", async () => {
    const { orgA, orgB, user, accountA } = await fixture();
    const same = await findDuplicateAccount(prisma, {
      organizationId: orgA.id,
      name: accountA.name.toUpperCase(),
      street: `${accountA.street}.`,
      zip: accountA.zip,
    });
    expect(same?.id).toBe(accountA.id);
    const otherOrg = await findDuplicateAccount(prisma, {
      organizationId: orgB.id,
      name: accountA.name,
      street: accountA.street,
      zip: accountA.zip,
    });
    expect(otherOrg).toBeNull();
    await prisma.auditLog.create({
      data: {
        organizationId: orgA.id,
        actorId: user.id,
        action: "account.created",
        entityType: "Account",
        entityId: accountA.id,
        metadata: { name: accountA.name },
      },
    });
    const visible = await prisma.auditLog.findMany({ where: { organizationId: orgB.id, entityId: accountA.id } });
    expect(visible).toEqual([]);
  });

  it("keeps a meeting pending until approval and rejects an expired token", async () => {
    const { orgA, orgB, user, accountA } = await fixture();
    const created = await createSchedulingInvitation(prisma, {
      organizationId: orgA.id,
      userId: user.id,
      accountId: accountA.id,
      lifetimeHours: 24,
      allowedHours: [24, 48, 168],
      publicContact: true,
      now,
      slots: [
        { startsAt: new Date("2026-10-21T15:00:00.000Z"), endsAt: new Date("2026-10-21T15:30:00.000Z") },
        { startsAt: new Date("2026-10-22T15:00:00.000Z"), endsAt: new Date("2026-10-22T15:30:00.000Z") },
      ],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const submitted = await submitMeetingRequest(prisma, {
      tokenHash: hashToken(created.token),
      slotId: created.invitation.slots[0]!.id,
      officeName: accountA.name,
      requesterName: "Office manager",
      requesterEmail: "office@example.com",
      purpose: "Introductory meeting with the care team.",
      now,
    });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;
    expect(await prisma.meeting.count({ where: { requestId: submitted.requestId } })).toBe(0);
    const reused = await submitMeetingRequest(prisma, {
      tokenHash: hashToken(created.token),
      slotId: created.invitation.slots[1]!.id,
      officeName: accountA.name,
      requesterName: "Office manager",
      requesterEmail: "office@example.com",
      purpose: "A second request through the used token.",
      now,
    });
    expect(reused.ok).toBe(false);
    const blocked = await approveMeetingRequest(prisma, { organizationId: orgB.id, userId: user.id, requestId: submitted.requestId, now });
    expect(blocked.ok).toBe(false);
    const approved = await approveMeetingRequest(prisma, { organizationId: orgA.id, userId: user.id, requestId: submitted.requestId, now });
    expect(approved.ok).toBe(true);
    if (!approved.ok) return;
    expect(approved.created).toBe(true);
    const repeat = await approveMeetingRequest(prisma, { organizationId: orgA.id, userId: user.id, requestId: submitted.requestId, now });
    expect(repeat.ok).toBe(true);
    if (!repeat.ok) return;
    expect(repeat.created).toBe(false);
    expect(await prisma.meeting.count({ where: { requestId: submitted.requestId } })).toBe(1);
    expect(await prisma.meeting.findFirst({ where: { requestId: submitted.requestId } })).toMatchObject({ syncState: "not_connected", externalEventId: null });
    const overlap = await createSchedulingInvitation(prisma, {
      organizationId: orgA.id,
      userId: user.id,
      accountId: accountA.id,
      lifetimeHours: 24,
      allowedHours: [24],
      publicContact: true,
      now,
      slots: [{ startsAt: new Date("2026-10-21T15:00:00.000Z"), endsAt: new Date("2026-10-21T15:30:00.000Z") }],
    });
    expect(overlap.ok).toBe(true);
    if (!overlap.ok) return;
    const overlapRequest = await submitMeetingRequest(prisma, {
      tokenHash: hashToken(overlap.token),
      slotId: overlap.invitation.slots[0]!.id,
      officeName: "Other office",
      requesterName: "Coordinator",
      requesterEmail: "",
      purpose: "A conflicting introductory meeting.",
      now,
    });
    expect(overlapRequest.ok).toBe(true);
    if (!overlapRequest.ok) return;
    const conflict = await approveMeetingRequest(prisma, { organizationId: orgA.id, userId: user.id, requestId: overlapRequest.requestId, now });
    expect(conflict.ok).toBe(false);
    expect(await prisma.meeting.count({ where: { requestId: overlapRequest.requestId } })).toBe(0);

    const expired = await createSchedulingInvitation(prisma, {
      organizationId: orgA.id,
      userId: user.id,
      accountId: accountA.id,
      lifetimeHours: 24,
      allowedHours: [24],
      publicContact: true,
      now: new Date("2026-09-01T15:00:00.000Z"),
      slots: [{ startsAt: new Date("2026-10-28T15:00:00.000Z"), endsAt: new Date("2026-10-28T15:30:00.000Z") }],
    });
    expect(expired.ok).toBe(true);
    if (!expired.ok) return;
    await prisma.schedulingInvitation.update({ where: { id: expired.invitation.id }, data: { expiresAt: new Date("2026-09-02T15:00:00.000Z") } });
    const late = await submitMeetingRequest(prisma, {
      tokenHash: hashToken(expired.token),
      slotId: expired.invitation.slots[0]!.id,
      officeName: accountA.name,
      requesterName: "Returning office",
      requesterEmail: "",
      purpose: "Trying the old link thirty days later.",
      now,
    });
    expect(late.ok).toBe(false);
    const asked = await requestReplacementInvitation(prisma, {
      tokenHash: hashToken(expired.token),
      officeName: accountA.name,
      note: "Please send a new invitation.",
      now,
    });
    expect(asked.ok).toBe(true);
    expect(await prisma.meeting.count({ where: { organizationId: orgA.id, request: { invitationId: expired.invitation.id } } })).toBe(0);
    const pendingStillThere = await prisma.meetingRequest.findUnique({ where: { id: submitted.requestId } });
    expect(pendingStillThere?.status).toBe("CONFIRMED");
  });

  it("requires a separate catering approval and keeps the receipt", async () => {
    const { orgA, orgB, user, accountA } = await fixture();
    const reviewerRole = await prisma.role.upsert({
      where: { key: "COMPLIANCE_ADMIN" },
      update: {},
      create: { key: "COMPLIANCE_ADMIN", name: "Compliance", description: "Reviews catering", scope: "organization" },
    });
    const reviewer = await prisma.user.create({
      data: { email: `compliance-${Date.now()}@example-health.test`, name: "Test Compliance", passwordHash: "not-used" },
    });
    await prisma.organizationMembership.create({
      data: { organizationId: orgA.id, userId: reviewer.id, roleId: reviewerRole.id },
    });
    await prisma.mealPolicy.create({
      data: {
        organizationId: orgA.id,
        name: "Test policy",
        version: "1",
        active: true,
        perPersonCapCents: 3000,
        exceptionsPermitted: true,
        educationalPurposeRequired: true,
      },
    });
    const created = await createInvitation(prisma, {
      organizationId: orgA.id,
      userId: user.id,
      accountId: accountA.id,
      purpose: "Educational program overview for office staff.",
      recipientName: "Office Manager",
      recipientEmail: "",
      expiresAt: new Date("2026-10-20T15:00:00.000Z"),
      expectedAttendees: 6,
      estimatedBudgetCents: 12000,
      mealPreferences: "",
      deliveryInstructions: "",
      slots: [{ startsAt: new Date("2026-10-21T17:00:00.000Z"), endsAt: new Date("2026-10-21T18:00:00.000Z") }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const requested = await acceptInvitationSlot(prisma, {
      tokenHash: hashToken(created.token),
      slotId: created.invitation.slots[0]!.id,
      now,
      responderName: "Office Manager",
      catering: { requested: true, attendees: 6, dietary: "Two vegetarian meals", deliveryInstructions: "Side entrance" },
    });
    expect(requested.ok).toBe(true);
    if (!requested.ok) return;
    const pendingOrder = await prisma.cateringOrder.findUniqueOrThrow({ where: { bookingId: requested.bookingId } });
    expect(pendingOrder.approvalStatus).toBe("PENDING");
    expect(pendingOrder.status).toBe("NOT_STARTED");

    const earlyHandoff = await recordCateringHandoff(prisma, {
      organizationId: orgA.id,
      userId: user.id,
      bookingId: requested.bookingId,
      vendor: "ezcater",
    });
    expect(earlyHandoff.ok).toBe(false);
    await approveLunchBooking(prisma, { organizationId: orgA.id, userId: user.id, bookingId: requested.bookingId, now });
    const afterMeeting = await prisma.cateringOrder.findUniqueOrThrow({ where: { bookingId: requested.bookingId } });
    expect(afterMeeting.approvalStatus).toBe("PENDING");
    const stillBlocked = await recordCateringOrder(prisma, {
      organizationId: orgA.id,
      userId: user.id,
      bookingId: requested.bookingId,
      vendor: "ezcater",
      finalAmountCents: 12000,
      orderReference: "EZ-100",
      attendees: 6,
      receiptNote: "Paid on ezCater",
      status: "COMPLETED",
    });
    expect(stillBlocked.ok).toBe(false);
    const selfApproval = await decideCateringApproval(prisma, {
      organizationId: orgA.id,
      reviewerId: user.id,
      reviewerRole: "COMPLIANCE_ADMIN",
      bookingId: requested.bookingId,
      approve: true,
      note: "I am the rep",
    });
    expect(selfApproval.ok).toBe(false);
    const otherOrg = await decideCateringApproval(prisma, {
      organizationId: orgB.id,
      reviewerId: reviewer.id,
      reviewerRole: "COMPLIANCE_ADMIN",
      bookingId: requested.bookingId,
      approve: true,
      note: "Wrong organization",
    });
    expect(otherOrg.ok).toBe(false);
    const approved = await decideCateringApproval(prisma, {
      organizationId: orgA.id,
      reviewerId: reviewer.id,
      reviewerRole: "COMPLIANCE_ADMIN",
      bookingId: requested.bookingId,
      approve: true,
      note: "Educational lunch within the internal cap.",
    });
    expect(approved.ok).toBe(true);
    const mismatched = await recordCateringOrder(prisma, {
      organizationId: orgA.id,
      userId: user.id,
      bookingId: requested.bookingId,
      vendor: "ezcater",
      finalAmountCents: 11800,
      orderReference: "EZ-100",
      attendees: 6,
      receiptNote: "",
      status: "ORDER_RECORDED",
      parts: { subtotalCents: 10000, taxCents: 1, feeCents: 0, deliveryCents: 0, tipCents: 0 },
    });
    expect(mismatched.ok).toBe(false);
    const recorded = await recordCateringOrder(prisma, {
      organizationId: orgA.id,
      userId: user.id,
      bookingId: requested.bookingId,
      vendor: "ezcater",
      finalAmountCents: 11800,
      orderReference: "EZ-100",
      attendees: 6,
      receiptNote: "Paid on ezCater",
      status: "ORDER_RECORDED",
      parts: { subtotalCents: 10000, taxCents: 800, feeCents: 0, deliveryCents: 500, tipCents: 500 },
      receiptFile: { fileName: "receipt.pdf", contentType: "application/pdf", bytes: new Uint8Array([37, 80, 68, 70]) },
    });
    expect(recorded.ok).toBe(true);
    const order = await prisma.cateringOrder.findUniqueOrThrow({ where: { bookingId: requested.bookingId }, include: { receipts: true } });
    expect(order.status).toBe("ORDER_RECORDED");
    expect(order.subtotalCents).toBe(10000);
    expect(order.receipts).toHaveLength(1);
    expect(order.receipts[0]?.byteSize).toBe(4);
    const history = await prisma.approval.findMany({ where: { organizationId: orgA.id, subjectId: { in: [requested.bookingId, order.id] } } });
    expect(history.map((item) => item.gate).sort()).toEqual(["catering", "meeting"]);
    const handoff = await recordCateringHandoff(prisma, {
      organizationId: orgA.id,
      userId: user.id,
      bookingId: requested.bookingId,
      vendor: "doordash",
    });
    expect(handoff.ok).toBe(true);
    const afterHandoff = await prisma.cateringOrder.findUniqueOrThrow({ where: { bookingId: requested.bookingId } });
    expect(afterHandoff.status).toBe("ORDER_RECORDED");
  });

  it("keeps CRM referrals unverified, isolates tenants, and lets only managers publish themes", async () => {
    const { orgA, orgB, user, accountA } = await fixture();
    const now = new Date("2026-11-10T15:00:00.000Z");
    const denied = await saveMonthlyTheme(prisma, {
      organizationId: orgA.id,
      actorId: user.id,
      roleKey: "REP",
      title: "Autism Evaluation Awareness",
      description: "Diagnostic access",
      startDate: "2026-11-01",
      endDate: "2026-11-30",
      specialties: ["Pediatrics"],
      territoryIds: [],
      userIds: [],
      priority: "HIGH",
      talkingPoints: ["Explain available diagnostic evaluation services."],
      resources: [],
      targetMetric: null,
      status: "PUBLISHED",
    });
    expect(denied.ok).toBe(false);
    const published = await saveMonthlyTheme(prisma, {
      organizationId: orgA.id,
      actorId: user.id,
      roleKey: "MANAGER",
      title: "Autism Evaluation Awareness",
      description: "Diagnostic access",
      startDate: "2026-11-01",
      endDate: "2026-11-30",
      specialties: ["Pediatrics"],
      territoryIds: [],
      userIds: [],
      priority: "HIGH",
      talkingPoints: ["Explain available diagnostic evaluation services."],
      resources: [],
      targetMetric: null,
      status: "PUBLISHED",
    });
    expect(published.ok).toBe(true);
    const foreign = await prepareVisitBrief(prisma, {
      organizationId: orgB.id,
      userId: user.id,
      accountId: accountA.id,
      timeZone: "America/Chicago",
      now,
    });
    expect(foreign.ok).toBe(false);
    const before = await prepareVisitBrief(prisma, {
      organizationId: orgA.id,
      userId: user.id,
      accountId: accountA.id,
      timeZone: "America/Chicago",
      now,
    });
    expect(before.ok).toBe(true);
    if (!before.ok) return;
    expect(before.brief.referralCount).toBeNull();
    expect(before.brief.referralInsight).toContain("could not be verified");
    expect(before.brief.theme).toBeNull();
    const sync = await recordReferralSyncAttempt(prisma, {
      organizationId: orgA.id,
      actorId: user.id,
      accountId: accountA.id,
      provider: "salesforce",
    });
    expect(sync.ok).toBe(true);
    if (sync.ok) expect(sync.status).toBe("unavailable");
    expect(await prisma.crmReferralSnapshot.count({ where: { accountId: accountA.id } })).toBe(0);
    await prisma.crmReferralSnapshot.create({
      data: {
        organizationId: orgA.id,
        accountId: accountA.id,
        periodStart: new Date("2026-10-11T12:00:00.000Z"),
        periodEnd: now,
        countSinceVisit: 3,
        count30: 3,
        count90: 3,
        previousCount30: 1,
        syncStatus: "verified",
        syncedAt: now,
      },
    });
    const after = await prepareVisitBrief(prisma, {
      organizationId: orgA.id,
      userId: user.id,
      accountId: accountA.id,
      timeZone: "America/Chicago",
      now,
      force: true,
    });
    expect(after.ok).toBe(true);
    if (after.ok) expect(after.brief.referralCount).toBe(3);
  });
});
