import type { Db } from "../db";
import { appUrl } from "../permissions";
import {
  bufferedWindow,
  canTransition,
  conflictingLabel,
  invitationAccess,
  resolveInvitationLifetime,
  type MeetingStatus,
} from "../domain/meetings";
import { issueSecureLink } from "./links";
import { externalBusy, createExternalEvent } from "../calendar/availability";

const DEFAULT_BUFFER_MINUTES = 10;

async function recordStatus(
  db: Db,
  input: { requestId: string; fromStatus: string | null; toStatus: string; actorId: string | null; actorLabel: string },
) {
  await db.meetingStatusEvent.create({
    data: {
      requestId: input.requestId,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      actorId: input.actorId,
      actorLabel: input.actorLabel,
    },
  });
}

export async function createSchedulingInvitation(
  db: Db,
  input: {
    organizationId: string;
    userId: string;
    accountId: string | null;
    lifetimeHours: number;
    allowedHours: number[];
    slots: { startsAt: Date; endsAt: Date }[];
    publicContact: boolean;
    now: Date;
  },
) {
  const lifetime = resolveInvitationLifetime(input.lifetimeHours, input.allowedHours);
  if (!lifetime) return { ok: false as const, error: "That invitation lifetime is not allowed for this organization." };
  const slots = input.slots.filter((slot) => slot.endsAt > slot.startsAt && slot.startsAt > input.now);
  if (slots.length === 0) return { ok: false as const, error: "Add at least one future time the office may request." };
  if (input.accountId) {
    const account = await db.account.findFirst({ where: { id: input.accountId, organizationId: input.organizationId } });
    if (!account) return { ok: false as const, error: "That office is not in your organization." };
  }
  const expiresAt = new Date(input.now.getTime() + lifetime * 60 * 60 * 1000);
  const invitation = await db.schedulingInvitation.create({
    data: {
      organizationId: input.organizationId,
      createdById: input.userId,
      accountId: input.accountId,
      invitationType: "meeting",
      status: "ACTIVE",
      maxUses: 1,
      lifetimeHours: lifetime,
      expiresAt,
      publicContact: input.publicContact,
      slots: { create: slots.map((slot) => ({ startsAt: slot.startsAt, endsAt: slot.endsAt })) },
    },
    include: { slots: true, createdBy: true, account: true },
  });
  const link = await issueSecureLink(db, {
    organizationId: input.organizationId,
    purpose: "scheduling",
    accountId: input.accountId,
    schedulingInvitationId: invitation.id,
    expiresAt,
  });
  await db.auditLog.create({
    data: {
      organizationId: input.organizationId,
      actorId: input.userId,
      action: "scheduling_invitation.created",
      entityType: "SchedulingInvitation",
      entityId: invitation.id,
      metadata: { lifetimeHours: lifetime, slotCount: slots.length },
    },
  });
  return { ok: true as const, invitation, token: link.token, url: `${appUrl()}/m/${link.token}` };
}

export async function submitMeetingRequest(
  db: Db,
  input: { tokenHash: string; slotId: string; officeName: string; requesterName: string; requesterEmail: string; purpose: string; now: Date },
) {
  const link = await db.secureLinkToken.findFirst({
    where: { tokenHash: input.tokenHash, purpose: "scheduling" },
  });
  if (!link?.schedulingInvitationId) return { ok: false as const, error: "This scheduling invitation link is not valid." };
  const officeName = input.officeName.trim();
  const requesterName = input.requesterName.trim();
  const purpose = input.purpose.trim();
  if (officeName.length < 2 || requesterName.length < 2 || purpose.length < 8) {
    return { ok: false as const, error: "Office name, your name, and the meeting purpose are required." };
  }

  try {
    const request = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "SchedulingInvitation" WHERE id = ${link.schedulingInvitationId} FOR UPDATE`;
      const invitation = await tx.schedulingInvitation.findUnique({
        where: { id: link.schedulingInvitationId! },
        include: { slots: true },
      });
      if (!invitation) throw new Error("This scheduling invitation link is not valid.");
      const access = invitationAccess({
        now: input.now,
        expiresAt: invitation.expiresAt,
        status: invitation.status,
        useCount: invitation.useCount,
        maxUses: invitation.maxUses,
        revoked: invitation.status === "REVOKED",
      });
      if (access !== "open" || link.revokedAt) {
        if (invitation.status === "ACTIVE" && invitation.expiresAt <= input.now) {
          await tx.schedulingInvitation.update({ where: { id: invitation.id }, data: { status: "EXPIRED" } });
        }
        throw new Error(
          access === "used"
            ? "This invitation was already used. It cannot book another time."
            : "This scheduling invitation has expired. To request another meeting or lunch and learn, please submit a new request or contact your representative.",
        );
      }
      const slot = invitation.slots.find((item) => item.id === input.slotId);
      if (!slot) throw new Error("That time was not offered on this invitation.");
      const created = await tx.meetingRequest.create({
        data: {
          organizationId: invitation.organizationId,
          invitationId: invitation.id,
          accountId: invitation.accountId,
          officeName,
          requesterName,
          requesterEmail: input.requesterEmail.trim() || null,
          purpose,
          requestedStartsAt: slot.startsAt,
          requestedEndsAt: slot.endsAt,
          status: "PENDING",
        },
      });
      await tx.meetingStatusEvent.create({
        data: { requestId: created.id, fromStatus: null, toStatus: "PENDING", actorLabel: "office" },
      });
      const useCount = invitation.useCount + 1;
      await tx.schedulingInvitation.update({
        where: { id: invitation.id },
        data: { useCount, status: useCount >= invitation.maxUses ? "USED" : invitation.status },
      });
      await tx.secureLinkToken.update({ where: { id: link.id }, data: { revokedAt: input.now, meetingRequestId: created.id } });
      await tx.notification.create({
        data: {
          organizationId: invitation.organizationId,
          userId: invitation.createdById,
          kind: "meeting_requested",
          title: "Meeting request is pending",
          body: `${officeName} requested a time. It is not on your calendar until you approve it.`,
          href: `/meetings/${created.id}`,
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: invitation.organizationId,
          actorId: null,
          action: "meeting_request.submitted",
          entityType: "MeetingRequest",
          entityId: created.id,
          metadata: { invitationId: invitation.id },
        },
      });
      return created;
    });
    return { ok: true as const, requestId: request.id };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "The request was not saved." };
  }
}

export async function requestReplacementInvitation(
  db: Db,
  input: { tokenHash: string; officeName: string; note: string; now: Date },
) {
  const link = await db.secureLinkToken.findFirst({
    where: { tokenHash: input.tokenHash, purpose: "scheduling" },
    include: { schedulingInvitation: true },
  });
  const invitation = link?.schedulingInvitation;
  if (!invitation) return { ok: false as const, error: "This scheduling invitation link is not valid." };
  const access = invitationAccess({
    now: input.now,
    expiresAt: invitation.expiresAt,
    status: invitation.status,
    useCount: invitation.useCount,
    maxUses: invitation.maxUses,
    revoked: invitation.status === "REVOKED",
  });
  if (access === "open") return { ok: false as const, error: "This invitation is still open. Request one of the offered times." };
  const note = input.note.trim();
  const officeName = input.officeName.trim() || "An office";
  if (note.length < 3) return { ok: false as const, error: "Add a short note for your representative." };
  await db.notification.create({
    data: {
      organizationId: invitation.organizationId,
      userId: invitation.createdById,
      kind: "invitation_requested",
      title: "Office asked for a new invitation",
      body: `${officeName}: ${note}`,
      href: "/meetings",
    },
  });
  await db.auditLog.create({
    data: {
      organizationId: invitation.organizationId,
      actorId: null,
      action: "scheduling_invitation.replacement_requested",
      entityType: "SchedulingInvitation",
      entityId: invitation.id,
      metadata: { officeName },
    },
  });
  return { ok: true as const };
}

async function commitmentIntervals(db: Db, organizationId: string, userId: string) {
  const [lunches, meetings] = await Promise.all([
    db.lunchBooking.findMany({
      where: {
        organizationId,
        representativeId: userId,
        status: { notIn: ["CANCELED", "AWAITING_APPROVAL", "COMPLETED"] },
      },
    }),
    db.meeting.findMany({
      where: { organizationId, userId, status: "CONFIRMED" },
    }),
  ]);
  return [
    ...lunches.map((lunch) => ({ start: lunch.slotStartsAt, end: lunch.slotEndsAt, label: "Another RepPilot lunch" })),
    ...meetings.map((meeting) => ({ start: meeting.startsAt, end: meeting.endsAt, label: "Another confirmed meeting" })),
  ];
}

export async function approveMeetingRequest(db: Db, input: { organizationId: string; userId: string; requestId: string; now: Date }) {
  const existing = await db.meetingRequest.findFirst({
    where: { id: input.requestId, organizationId: input.organizationId },
    include: { meeting: true, invitation: { include: { slots: true, createdBy: true } } },
  });
  if (!existing) return { ok: false as const, error: "That request is not in your organization." };
  if (existing.meeting) return { ok: true as const, meetingId: existing.meeting.id, created: false, syncState: existing.meeting.syncState };
  if (existing.invitation.createdById !== input.userId) return { ok: false as const, error: "Only the representative who sent the invitation can approve it." };
  if (!canTransition(existing.status, "APPROVED") || !canTransition("APPROVED", "CONFIRMED")) {
    return { ok: false as const, error: "This request can no longer be approved." };
  }
  const window = bufferedWindow(existing.requestedStartsAt, existing.requestedEndsAt, DEFAULT_BUFFER_MINUTES);
  const internal = conflictingLabel({ start: window.start, end: window.end, intervals: await commitmentIntervals(db, input.organizationId, input.userId) });
  if (internal) {
    return {
      ok: false as const,
      error: `${internal} overlaps this time, including a ${DEFAULT_BUFFER_MINUTES}-minute buffer. The request stays pending. Propose another offered time instead.`,
      alternatives: existing.invitation.slots
        .filter((slot) => slot.startsAt.getTime() !== existing.requestedStartsAt.getTime())
        .map((slot) => slot.startsAt.toISOString()),
    };
  }
  const external = await externalBusy(db, input.userId, window.start, window.end);
  if (external.status === "unavailable") return { ok: false as const, error: external.message };
  if (external.status === "ok") {
    const label = conflictingLabel({
      start: window.start,
      end: window.end,
      intervals: external.busy.map((busy) => ({ ...busy, label: `${external.provider} calendar` })),
    });
    if (label) {
      return { ok: false as const, error: `That time is busy on the connected ${label}. The request stays pending.` };
    }
  }

  try {
    const meeting = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "MeetingRequest" WHERE id = ${existing.id} FOR UPDATE`;
      const current = await tx.meetingRequest.findUnique({ where: { id: existing.id }, include: { meeting: true } });
      if (!current) throw new Error("That request is not in your organization.");
      if (current.meeting) {
        return { meeting: current.meeting, officeName: current.officeName, startsAt: current.requestedStartsAt, endsAt: current.requestedEndsAt, already: true as const };
      }
      if (current.status !== "PENDING") throw new Error("This request can no longer be approved.");
      const again = conflictingLabel({
        start: window.start,
        end: window.end,
        intervals: await commitmentIntervals(tx as Db, input.organizationId, input.userId),
      });
      if (again) throw new Error(`${again} overlaps this time. The request stays pending.`);
      await tx.meetingRequest.update({
        where: { id: current.id },
        data: { status: "CONFIRMED", decidedById: input.userId, decidedAt: input.now },
      });
      await recordStatus(tx as Db, { requestId: current.id, fromStatus: "PENDING", toStatus: "APPROVED", actorId: input.userId, actorLabel: "representative" });
      await recordStatus(tx as Db, { requestId: current.id, fromStatus: "APPROVED", toStatus: "CONFIRMED", actorId: input.userId, actorLabel: "representative" });
      const created = await tx.meeting.create({
        data: {
          organizationId: current.organizationId,
          requestId: current.id,
          userId: input.userId,
          accountId: current.accountId,
          startsAt: current.requestedStartsAt,
          endsAt: current.requestedEndsAt,
          status: "CONFIRMED",
          provider: "internal",
          syncState: "not_connected",
        },
      });
      await tx.calendarEventMapping.create({
        data: {
          organizationId: current.organizationId,
          userId: input.userId,
          provider: "internal",
          title: `Meeting · ${current.officeName}`,
          startsAt: current.requestedStartsAt,
          endsAt: current.requestedEndsAt,
          syncState: "not_connected",
        },
      });
      await tx.notification.create({
        data: {
          organizationId: current.organizationId,
          userId: input.userId,
          kind: "meeting_confirmed",
          title: "Meeting confirmed",
          body: `${current.officeName} is confirmed in RepPilot. An external calendar event is written only when a connected calendar accepts it.`,
          href: `/meetings/${current.id}`,
        },
      });
      return { meeting: created, officeName: current.officeName, startsAt: current.requestedStartsAt, endsAt: current.requestedEndsAt, already: false as const };
    });
    if (meeting.already) return { ok: true as const, meetingId: meeting.meeting.id, created: false, syncState: meeting.meeting.syncState };
    const externalEvent = await createExternalEvent(db, input.userId, {
      summary: `RepPilot meeting · ${meeting.officeName}`,
      description: "Confirmed in RepPilot after representative approval. Office staff details are not included.",
      start: meeting.startsAt,
      end: meeting.endsAt,
    });
    if (externalEvent.syncState !== "not_connected") {
      await db.meeting.updateMany({
        where: { id: meeting.meeting.id, externalEventId: null },
        data: { provider: externalEvent.provider, syncState: externalEvent.syncState, externalEventId: externalEvent.externalEventId },
      });
      await db.calendarEventMapping.updateMany({
        where: { organizationId: input.organizationId, userId: input.userId, startsAt: meeting.startsAt, externalEventId: null, syncState: "not_connected" },
        data: { provider: externalEvent.provider, syncState: externalEvent.syncState, externalEventId: externalEvent.externalEventId },
      });
    }
    return { ok: true as const, meetingId: meeting.meeting.id, created: true, syncState: externalEvent.syncState };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "The meeting was not confirmed." };
  }
}

export async function declineMeetingRequest(db: Db, input: { organizationId: string; userId: string; requestId: string; note: string; now: Date }) {
  return changeRequest(db, { ...input, to: "DECLINED" });
}

export async function proposeMeetingTime(
  db: Db,
  input: { organizationId: string; userId: string; requestId: string; startsAt: Date; endsAt: Date; now: Date },
) {
  const request = await db.meetingRequest.findFirst({
    where: { id: input.requestId, organizationId: input.organizationId },
    include: { invitation: { include: { slots: true } } },
  });
  if (!request) return { ok: false as const, error: "That request is not in your organization." };
  if (request.invitation.createdById !== input.userId) return { ok: false as const, error: "Only the representative who sent the invitation can propose a time." };
  if (!canTransition(request.status, "RESCHEDULE_PROPOSED")) return { ok: false as const, error: "This request cannot be rescheduled from its current state." };
  const slot = request.invitation.slots.find((item) => item.startsAt.getTime() === input.startsAt.getTime() && item.endsAt.getTime() === input.endsAt.getTime());
  if (!slot) return { ok: false as const, error: "Propose one of the times already on the invitation." };
  await db.meetingRequest.update({
    where: { id: request.id },
    data: { status: "RESCHEDULE_PROPOSED", proposedStartsAt: slot.startsAt, proposedEndsAt: slot.endsAt, decidedById: input.userId, decidedAt: input.now },
  });
  await recordStatus(db, { requestId: request.id, fromStatus: request.status, toStatus: "RESCHEDULE_PROPOSED", actorId: input.userId, actorLabel: "representative" });
  const link = await issueSecureLink(db, {
    organizationId: request.organizationId,
    purpose: "scheduling_reply",
    accountId: request.accountId,
    schedulingInvitationId: request.invitationId,
    meetingRequestId: request.id,
    expiresAt: new Date(input.now.getTime() + 48 * 60 * 60 * 1000),
  });
  return { ok: true as const, url: `${appUrl()}/m/${link.token}` };
}

async function changeRequest(
  db: Db,
  input: { organizationId: string; userId: string; requestId: string; note: string; now: Date; to: MeetingStatus },
) {
  const request = await db.meetingRequest.findFirst({
    where: { id: input.requestId, organizationId: input.organizationId },
    include: { invitation: true, meeting: true },
  });
  if (!request) return { ok: false as const, error: "That request is not in your organization." };
  if (request.invitation.createdById !== input.userId) return { ok: false as const, error: "Only the representative who sent the invitation can decide it." };
  if (!canTransition(request.status, input.to)) return { ok: false as const, error: "That decision is not available for this request." };
  await db.meetingRequest.update({
    where: { id: request.id },
    data: { status: input.to, decisionNote: input.note.trim() || null, decidedById: input.userId, decidedAt: input.now },
  });
  if (request.meeting && (input.to === "CANCELLED" || input.to === "COMPLETED")) {
    await db.meeting.update({ where: { id: request.meeting.id }, data: { status: input.to === "CANCELLED" ? "CANCELLED" : "COMPLETED" } });
  }
  await recordStatus(db, { requestId: request.id, fromStatus: request.status, toStatus: input.to, actorId: input.userId, actorLabel: "representative" });
  return { ok: true as const };
}

export async function cancelMeetingRequest(db: Db, input: { organizationId: string; userId: string; requestId: string; note: string; now: Date }) {
  return changeRequest(db, { ...input, to: "CANCELLED" });
}

export async function completeMeetingRequest(db: Db, input: { organizationId: string; userId: string; requestId: string; note: string; now: Date }) {
  return changeRequest(db, { ...input, to: "COMPLETED" });
}

export async function acceptProposedTime(db: Db, input: { tokenHash: string; now: Date }) {
  const link = await db.secureLinkToken.findFirst({
    where: { tokenHash: input.tokenHash, purpose: "scheduling_reply", revokedAt: null },
    include: { meetingRequest: { include: { invitation: true } } },
  });
  const request = link?.meetingRequest;
  if (!link || !request?.proposedStartsAt || !request.proposedEndsAt) return { ok: false as const, error: "This proposal link is not valid." };
  if (link.expiresAt <= input.now) return { ok: false as const, error: "This proposal link has expired." };
  if (request.status !== "RESCHEDULE_PROPOSED") return { ok: false as const, error: "This proposal is no longer open." };
  const window = bufferedWindow(request.proposedStartsAt, request.proposedEndsAt, DEFAULT_BUFFER_MINUTES);
  const internal = conflictingLabel({
    start: window.start,
    end: window.end,
    intervals: await commitmentIntervals(db, request.organizationId, request.invitation.createdById),
  });
  if (internal) return { ok: false as const, error: `${internal} now overlaps the proposed time. Ask your representative for another invitation.` };
  const external = await externalBusy(db, request.invitation.createdById, window.start, window.end);
  if (external.status === "unavailable") return { ok: false as const, error: "The representative's calendar could not be rechecked. This proposal was not confirmed." };
  if (external.status === "ok") {
    const label = conflictingLabel({
      start: window.start,
      end: window.end,
      intervals: external.busy.map((busy) => ({ ...busy, label: external.provider })),
    });
    if (label) return { ok: false as const, error: "That proposed time is no longer free. It was not confirmed." };
  }
  const externalEvent = await createExternalEvent(db, request.invitation.createdById, {
    summary: `RepPilot meeting · ${request.officeName}`,
    description: "Confirmed after the representative proposed the time and the office accepted it.",
    start: request.proposedStartsAt,
    end: request.proposedEndsAt,
  });
  const meeting = await db.$transaction(async (tx) => {
    const current = await tx.meetingRequest.findUnique({ where: { id: request.id }, include: { meeting: true } });
    if (!current || current.status !== "RESCHEDULE_PROPOSED") throw new Error("This proposal is no longer open.");
    if (current.meeting) return current.meeting;
    await tx.meetingRequest.update({
      where: { id: current.id },
      data: {
        status: "CONFIRMED",
        requestedStartsAt: current.proposedStartsAt!,
        requestedEndsAt: current.proposedEndsAt!,
        decidedAt: input.now,
      },
    });
    await tx.meetingStatusEvent.create({
      data: { requestId: current.id, fromStatus: "RESCHEDULE_PROPOSED", toStatus: "CONFIRMED", actorLabel: "office" },
    });
    const created = await tx.meeting.create({
      data: {
        organizationId: current.organizationId,
        requestId: current.id,
        userId: request.invitation.createdById,
        accountId: current.accountId,
        startsAt: current.proposedStartsAt!,
        endsAt: current.proposedEndsAt!,
        status: "CONFIRMED",
        provider: externalEvent.provider,
        syncState: externalEvent.syncState,
        externalEventId: externalEvent.externalEventId,
      },
    });
    await tx.secureLinkToken.update({ where: { id: link.id }, data: { revokedAt: input.now } });
    await tx.notification.create({
      data: {
        organizationId: current.organizationId,
        userId: request.invitation.createdById,
        kind: "meeting_confirmed",
        title: "Office accepted the proposed time",
        body: `${current.officeName} accepted the time you proposed.`,
        href: `/meetings/${current.id}`,
      },
    });
    return created;
  });
  return { ok: true as const, meetingId: meeting.id };
}
