import { workspaceAccess } from "../workspace-access";
import type { Db } from "../db";
import { decryptString, encryptString } from "../domain/crypto";
import { generateToken, hashToken } from "../domain/tokens";
import { logEvent } from "../logger";

export async function issueSecureLink(
  db: Db,
  input: {
    organizationId: string;
    purpose: "invitation" | "lunch_confirmation" | "office" | "scheduling" | "scheduling_reply";
    accountId?: string | null;
    invitationId?: string | null;
    bookingId?: string | null;
    schedulingInvitationId?: string | null;
    meetingRequestId?: string | null;
    expiresAt: Date;
  },
) {
  const token = generateToken();
  const record = await db.secureLinkToken.create({
    data: {
      organizationId: input.organizationId,
      purpose: input.purpose,
      tokenHash: hashToken(token),
      tokenCiphertext: encryptString(token),
      accountId: input.accountId ?? null,
      invitationId: input.invitationId ?? null,
      bookingId: input.bookingId ?? null,
      schedulingInvitationId: input.schedulingInvitationId ?? null,
      meetingRequestId: input.meetingRequestId ?? null,
      expiresAt: input.expiresAt,
    },
  });
  logEvent("info", "secure_link.issued", {
    purpose: input.purpose,
    organizationId: input.organizationId,
    linkId: record.id,
  });
  return { id: record.id, token };
}

export function revealToken(ciphertext: string) {
  return decryptString(ciphertext);
}

export async function findActiveLink(db: Db, token: string, purpose: string) {
  const tokenHash = hashToken(token);
  const link = await db.secureLinkToken.findFirst({
    where: { tokenHash, purpose, revokedAt: null },
  });
  return link && await workspaceAccess(db, link.organizationId) ? link : null;
}
