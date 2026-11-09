import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { compare, hash } from "bcryptjs";
import { createPrisma } from "../src/lib/db";
import { fulfillAccountDeletion, requestAccountDeletion } from "../src/lib/privacy/deletion";

const db = createPrisma(process.env.DATABASE_URL_TEST || "");
const password = "Fictional-deletion-fixture-only";
const stamp = Date.now();
let userId = "";
let otherUserId = "";
let organizationId = "";
let accountId = "";
let interactionId = "";

beforeAll(async () => {
  const passwordHash = await hash(password, 10);
  const role = await db.role.upsert({
    where: { key: "REP" },
    update: {},
    create: { key: "REP", name: "Representative", description: "Field representative", scope: "organization" },
  });
  const organization = await db.organization.create({
    data: { name: `Deletion org ${stamp}`, slug: `deletion-org-${stamp}` },
  });
  organizationId = organization.id;
  const user = await db.user.create({ data: { name: "Deletion fixture", email: `deletion-${stamp}@example.test`, passwordHash } });
  const other = await db.user.create({ data: { name: "Other fixture", email: `deletion-other-${stamp}@example.test`, passwordHash } });
  userId = user.id;
  otherUserId = other.id;
  await db.organizationMembership.create({ data: { organizationId, userId, roleId: role.id } });
  await db.calendarConnection.create({
    data: { organizationId, userId, provider: "google", status: "connected", externalAccountEmail: user.email, credentialCiphertext: "fixture-ciphertext" },
  });
  await db.notification.create({ data: { organizationId, userId, title: "Private", body: "Personal alert", kind: "test" } });
  await db.notification.create({ data: { organizationId, userId: otherUserId, title: "Keep", body: "Other alert", kind: "test" } });
  await db.aIInteraction.create({
    data: { organizationId, userId, purpose: "brief", provider: "fixture", inputExcerpt: "personal drafting text" },
  });
  await db.notificationDelivery.create({
    data: { organizationId, channel: "email", toAddress: user.email, subject: "Hello", htmlBody: "<p>secret</p>", textBody: "secret", status: "sent", idempotencyKey: `deletion-${stamp}` },
  });
  const account = await db.account.create({
    data: { organizationId, name: "Kept clinic", specialty: "Pediatrics", street: "1 Main", city: "Dallas", state: "TX", zip: "75201" },
  });
  accountId = account.id;
  const interaction = await db.accountInteraction.create({
    data: { organizationId, accountId, userId, type: "VISIT", summary: "Organization visit note", occurredAt: new Date() },
  });
  interactionId = interaction.id;
});

afterAll(async () => {
  await db.auditLog.deleteMany({ where: { organizationId } });
  await db.accountInteraction.deleteMany({ where: { id: interactionId } });
  await db.account.deleteMany({ where: { id: accountId } });
  await db.notificationDelivery.deleteMany({ where: { organizationId } });
  await db.notification.deleteMany({ where: { organizationId } });
  await db.aIInteraction.deleteMany({ where: { organizationId } });
  await db.calendarConnection.deleteMany({ where: { organizationId } });
  await db.organizationMembership.deleteMany({ where: { organizationId } });
  await db.accountDeletionRequest.deleteMany({ where: { userId: { in: [userId, otherUserId].filter(Boolean) } } });
  await db.user.deleteMany({ where: { id: { in: [userId, otherUserId].filter(Boolean) } } });
  await db.organization.deleteMany({ where: { id: organizationId } });
  await db.$disconnect();
});

describe("verified account deletion", () => {
  it("requires explicit confirmation and a correct current password", async () => {
    expect((await requestAccountDeletion(db, { userId, password, confirmed: false })).ok).toBe(false);
    expect((await requestAccountDeletion(db, { userId, password: "incorrect", confirmed: true })).ok).toBe(false);
    expect(await db.accountDeletionRequest.count({ where: { userId } })).toBe(0);
  });

  it("erases sign-in and personal records, keeps organization notes, and does not touch the other account", async () => {
    const first = await requestAccountDeletion(db, { userId, password, confirmed: true });
    const second = await requestAccountDeletion(db, { userId, password: "no-longer-valid", confirmed: true });
    expect(first.ok).toBe(true);
    expect(second).toEqual(first);
    const erased = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(erased.name).toBe("Deleted user");
    expect(erased.email).toBe(`deleted-${userId}@deleted.invalid`);
    expect(erased.phone).toBeNull();
    expect(await compare(password, erased.passwordHash)).toBe(false);
    expect(await db.organizationMembership.count({ where: { userId } })).toBe(0);
    expect(await db.calendarConnection.count({ where: { userId } })).toBe(0);
    expect(await db.notification.count({ where: { userId } })).toBe(0);
    expect(await db.aIInteraction.count({ where: { userId } })).toBe(0);
    expect(await db.notificationDelivery.findFirst({ where: { organizationId } })).toMatchObject({ toAddress: null, htmlBody: "", textBody: "", subject: "Redacted" });
    expect(await db.accountInteraction.findUnique({ where: { id: interactionId } })).toMatchObject({ summary: "Organization visit note" });
    expect(await db.account.findUnique({ where: { id: accountId } })).toMatchObject({ name: "Kept clinic" });
    const request = await db.accountDeletionRequest.findUniqueOrThrow({ where: { userId } });
    expect(request.status).toBe("COMPLETED");
    expect(request.completedAt).toBeTruthy();
    expect(await db.user.findUnique({ where: { id: otherUserId } })).toMatchObject({ name: "Other fixture" });
    expect(await db.notification.count({ where: { userId: otherUserId } })).toBe(1);
    expect(await db.accountDeletionRequest.count({ where: { userId: otherUserId } })).toBe(0);
  });

  it("lets an operator erase a different account without that account's password", async () => {
    const result = await fulfillAccountDeletion(db, { userId: otherUserId, actorId: userId });
    expect(result.ok).toBe(true);
    const erased = await db.user.findUniqueOrThrow({ where: { id: otherUserId } });
    expect(erased.name).toBe("Deleted user");
    expect(await compare(password, erased.passwordHash)).toBe(false);
    expect(await db.accountInteraction.count({ where: { id: interactionId } })).toBe(1);
  });

  it("rate-limits failed password checks before creating a request", async () => {
    const blocked = await db.user.create({
      data: { name: "Rate fixture", email: `deletion-rate-${stamp}@example.test`, passwordHash: await hash(password, 10) },
    });
    try {
      for (let attempt = 0; attempt < 5; attempt += 1) await requestAccountDeletion(db, { userId: blocked.id, password: "incorrect", confirmed: true });
      const limited = await requestAccountDeletion(db, { userId: blocked.id, password, confirmed: true });
      expect(limited).toEqual({ ok: false, error: "Too many attempts. Wait 15 minutes and try again." });
      expect(await db.accountDeletionRequest.count({ where: { userId: blocked.id } })).toBe(0);
      expect(await db.user.findUnique({ where: { id: blocked.id } })).toMatchObject({ name: "Rate fixture" });
    } finally {
      await db.user.delete({ where: { id: blocked.id } });
    }
  });
});
