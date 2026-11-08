import { compare } from "bcryptjs";
import type { Db } from "../db";
import { consumeSharedRateLimit } from "../domain/rate-limit-store";

export async function requestAccountDeletion(db: Db, input: { userId: string; password: string; confirmed: boolean }) {
  if (!input.confirmed) return { ok: false as const, error: "Confirm that you want to delete your account and associated personal data." };
  if (!input.password || input.password.length > 1024) return { ok: false as const, error: "Enter your current password." };
  const limit = await consumeSharedRateLimit(db, `account-deletion:${input.userId}`, 5, 15 * 60_000);
  if (!limit.ok) return { ok: false as const, error: "Too many attempts. Wait 15 minutes and try again." };
  const user = await db.user.findUnique({ where: { id: input.userId }, select: { id: true, passwordHash: true } });
  if (!user || !(await compare(input.password, user.passwordHash))) return { ok: false as const, error: "The current password could not be verified." };
  const request = await db.accountDeletionRequest.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  });
  return { ok: true as const, requestId: request.id };
}
