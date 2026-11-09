import { randomBytes } from "node:crypto";
import { compare, hash } from "bcryptjs";
import type { Db } from "../db";
import { consumeSharedRateLimit } from "../domain/rate-limit-store";

const DELETED_NAME = "Deleted user";

export function isDeletedAccount(user: { email: string; name: string }) {
  return user.name === DELETED_NAME && user.email.endsWith("@deleted.invalid");
}

export async function requestAccountDeletion(db: Db, input: { userId: string; password: string; confirmed: boolean }) {
  if (!input.confirmed) return { ok: false as const, error: "Confirm that you want to delete your account and associated personal data." };
  if (!input.password || input.password.length > 1024) return { ok: false as const, error: "Enter your current password." };
  const existing = await db.accountDeletionRequest.findUnique({ where: { userId: input.userId } });
  if (existing?.status === "COMPLETED") return { ok: true as const, requestId: existing.id };
  const limit = await consumeSharedRateLimit(db, `account-deletion:${input.userId}`, 5, 15 * 60_000);
  if (!limit.ok) return { ok: false as const, error: "Too many attempts. Wait 15 minutes and try again." };
  const user = await db.user.findUnique({ where: { id: input.userId }, select: { id: true, passwordHash: true } });
  if (!user || !(await compare(input.password, user.passwordHash))) return { ok: false as const, error: "The current password could not be verified." };
  return fulfillAccountDeletion(db, { userId: user.id });
}

/**
 * Removes sign-in, profile, calendar credentials, notifications, and AI records.
 * Organization visit, meeting, and spending rows stay, attributed to "Deleted user".
 * Caller must already have verified the password or be a platform administrator.
 */
export async function fulfillAccountDeletion(db: Db, input: { userId: string; actorId?: string }) {
  const user = await db.user.findUnique({
    where: { id: input.userId },
    include: { memberships: { select: { organizationId: true } } },
  });
  if (!user) return { ok: false as const, error: "No matching account." };
  if (isDeletedAccount(user)) {
    const request = await db.accountDeletionRequest.findUnique({ where: { userId: user.id } });
    return request ? { ok: true as const, requestId: request.id } : { ok: false as const, error: "Account is already deleted." };
  }
  const passwordHash = await hash(randomBytes(32).toString("base64url"), 10);
  const completedAt = new Date();
  const requestId = await db.$transaction(async (tx) => {
    await tx.calendarConnection.deleteMany({ where: { userId: user.id } });
    await tx.calendarEventMapping.deleteMany({ where: { userId: user.id } });
    await tx.notification.deleteMany({ where: { userId: user.id } });
    await tx.aIInteraction.deleteMany({ where: { userId: user.id } });
    await tx.aIUsageRecord.updateMany({ where: { userId: user.id }, data: { userId: null } });
    await tx.notificationDelivery.updateMany({
      where: { toAddress: user.email },
      data: { toAddress: null, subject: "Redacted", htmlBody: "", textBody: "" },
    });
    await tx.organizationMembership.deleteMany({ where: { userId: user.id } });
    await tx.territoryAssignment.deleteMany({ where: { userId: user.id } });
    await tx.accountAssignment.deleteMany({ where: { userId: user.id } });
    await tx.user.update({
      where: { id: user.id },
      data: {
        email: `deleted-${user.id}@deleted.invalid`,
        name: DELETED_NAME,
        phone: null,
        title: null,
        passwordHash,
        notificationPrefs: {},
      },
    });
    const request = await tx.accountDeletionRequest.upsert({
      where: { userId: user.id },
      update: { status: "COMPLETED", completedAt },
      create: { userId: user.id, status: "COMPLETED", completedAt },
    });
    const organizations = [...new Set(user.memberships.map((membership) => membership.organizationId))];
    for (const organizationId of organizations) {
      await tx.auditLog.create({
        data: {
          organizationId,
          actorId: input.actorId && input.actorId !== user.id ? input.actorId : null,
          action: "account.deletion.completed",
          entityType: "User",
          entityId: user.id,
          metadata: { requestId: request.id },
        },
      });
    }
    return request.id;
  });
  return { ok: true as const, requestId };
}
