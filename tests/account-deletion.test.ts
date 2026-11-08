import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hash } from "bcryptjs";
import { createPrisma } from "../src/lib/db";
import { requestAccountDeletion } from "../src/lib/privacy/deletion";

const db = createPrisma(process.env.DATABASE_URL_TEST || "");
const password = "Fictional-deletion-fixture-only";
let userId: string;
let otherUserId: string;
beforeAll(async () => {
  const passwordHash = await hash(password, 10);
  const user = await db.user.create({ data: { name: "Deletion fixture", email: `deletion-${Date.now()}@example.test`, passwordHash } });
  const other = await db.user.create({ data: { name: "Other fixture", email: `deletion-other-${Date.now()}@example.test`, passwordHash } });
  userId = user.id; otherUserId = other.id;
});
afterAll(async () => {
  await db.accountDeletionRequest.deleteMany({ where: { userId: { in: [userId, otherUserId].filter(Boolean) } } });
  await db.user.deleteMany({ where: { id: { in: [userId, otherUserId].filter(Boolean) } } });
  await db.$disconnect();
});

describe("verified account-deletion initiation", () => {
  it("requires explicit confirmation and a correct current password", async () => {
    expect((await requestAccountDeletion(db, { userId, password, confirmed: false })).ok).toBe(false);
    expect((await requestAccountDeletion(db, { userId, password: "incorrect", confirmed: true })).ok).toBe(false);
    expect(await db.accountDeletionRequest.count({ where: { userId } })).toBe(0);
  });
  it("records a pending request idempotently, without deleting the account or another user", async () => {
    const first = await requestAccountDeletion(db, { userId, password, confirmed: true });
    const second = await requestAccountDeletion(db, { userId, password, confirmed: true });
    expect(first.ok).toBe(true); expect(second).toEqual(first);
    expect(await db.accountDeletionRequest.count({ where: { userId } })).toBe(1);
    expect(await db.accountDeletionRequest.findUnique({ where: { userId } })).toMatchObject({ status: "PENDING", completedAt: null });
    expect(await db.user.count({ where: { id: { in: [userId, otherUserId] } } })).toBe(2);
    expect(await db.accountDeletionRequest.count({ where: { userId: otherUserId } })).toBe(0);
  });
  it("rate-limits failed password checks before creating a request", async () => {
    for (let attempt = 0; attempt < 5; attempt++) await requestAccountDeletion(db, { userId: otherUserId, password: "incorrect", confirmed: true });
    const limited = await requestAccountDeletion(db, { userId: otherUserId, password, confirmed: true });
    expect(limited).toEqual({ ok: false, error: "Too many attempts. Wait 15 minutes and try again." });
    expect(await db.accountDeletionRequest.count({ where: { userId: otherUserId } })).toBe(0);
  });
});
