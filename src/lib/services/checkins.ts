import type { Db } from "../db";
import { PHYSICAL_VISIT_TYPES } from "../domain/catalog";

export type CheckInInput = {
  organizationId: string;
  userId: string;
  accountId: string;
  type: string;
  outcome: string | null;
  summary: string;
  activities: string[];
  participants: { name: string; roleLabel: string; contactId?: string | null }[];
  tasks: { title: string; dueDate: Date | null }[];
  occurredAt: Date;
  latitude?: number | null;
  longitude?: number | null;
};

export async function saveCheckIn(db: Db, input: CheckInInput) {
  const account = await db.account.findFirst({
    where: { id: input.accountId, organizationId: input.organizationId },
  });
  if (!account) {
    return { ok: false as const, error: "That office is not in your organization." };
  }

  const interaction = await db.accountInteraction.create({
    data: {
      organizationId: input.organizationId,
      accountId: input.accountId,
      userId: input.userId,
      type: input.type,
      outcome: input.type === "note" ? null : input.outcome,
      summary: input.summary.trim(),
      completedActivities: input.activities,
      occurredAt: input.occurredAt,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      participants: {
        create: input.participants
          .filter((person) => person.name.trim())
          .map((person) => ({
            name: person.name.trim(),
            roleLabel: person.roleLabel,
            contactId: person.contactId ?? null,
          })),
      },
      tasks: {
        create: input.tasks.map((task) => ({
          organizationId: input.organizationId,
          accountId: input.accountId,
          ownerId: input.userId,
          title: task.title,
          dueDate: task.dueDate,
          priority: "NORMAL",
          status: "OPEN",
          source: "check_in",
        })),
      },
    },
  });

  const updates: { lastVisitAt?: Date; nextFollowUpAt?: Date | null } = {};
  const shouldStampVisit =
    PHYSICAL_VISIT_TYPES.has(input.type) &&
    (input.outcome === "completed" || input.outcome === null);
  if (shouldStampVisit && (!account.lastVisitAt || input.occurredAt > account.lastVisitAt)) {
    updates.lastVisitAt = input.occurredAt;
  }
  const dated = input.tasks
    .map((task) => task.dueDate)
    .filter((date): date is Date => date instanceof Date)
    .sort((a, b) => a.getTime() - b.getTime());
  if (dated[0] && (!account.nextFollowUpAt || dated[0] < account.nextFollowUpAt)) {
    updates.nextFollowUpAt = dated[0];
  }
  if (Object.keys(updates).length > 0) {
    await db.account.update({ where: { id: account.id }, data: updates });
  }

  await db.auditLog.create({
    data: {
      organizationId: input.organizationId,
      actorId: input.userId,
      action: "check_in.created",
      entityType: "AccountInteraction",
      entityId: interaction.id,
      metadata: { accountId: account.id, type: input.type },
    },
  });

  return { ok: true as const, interactionId: interaction.id };
}

export async function updateCheckIn(
  db: Db,
  input: {
    organizationId: string;
    userId: string;
    interactionId: string;
    summary: string;
    outcome: string | null;
    activities: string[];
  },
) {
  const existing = await db.accountInteraction.findFirst({
    where: { id: input.interactionId, organizationId: input.organizationId },
  });
  if (!existing) return { ok: false as const, error: "Check-in was not found." };
  await db.accountInteraction.update({
    where: { id: existing.id },
    data: {
      summary: input.summary.trim(),
      outcome: input.outcome,
      completedActivities: input.activities,
    },
  });
  await db.auditLog.create({
    data: {
      organizationId: input.organizationId,
      actorId: input.userId,
      action: "check_in.updated",
      entityType: "AccountInteraction",
      entityId: existing.id,
      metadata: { previousSummary: existing.summary },
    },
  });
  return { ok: true as const };
}
