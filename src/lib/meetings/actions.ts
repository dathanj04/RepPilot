"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fromZonedTime } from "date-fns-tz";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { parseOrgSettings } from "@/lib/org-settings";
import { consumeSharedRateLimit } from "@/lib/domain/rate-limit-store";
import { hashToken } from "@/lib/domain/tokens";
import { escapeHtml } from "@/lib/email/templates";
import { deliverEmail } from "@/lib/email/send";
import {
  acceptProposedTime,
  approveMeetingRequest,
  cancelMeetingRequest,
  completeMeetingRequest,
  createSchedulingInvitation,
  declineMeetingRequest,
  proposeMeetingTime,
  requestReplacementInvitation,
  submitMeetingRequest,
} from "@/lib/services/meetings";
import { approveLunchBooking } from "@/lib/services/lunches";

function slotsFromForm(formData: FormData, timezone: string, now: Date) {
  const dates = formData.getAll("slotDate").map(String);
  const times = formData.getAll("slotTime").map(String);
  return dates
    .map((date, index) => {
      const time = times[index] || "09:00";
      if (!date) return null;
      const startsAt = fromZonedTime(`${date}T${time}:00`, timezone);
      if (startsAt <= now) return null;
      return { startsAt, endsAt: new Date(startsAt.getTime() + 30 * 60 * 1000) };
    })
    .filter((slot): slot is { startsAt: Date; endsAt: Date } => Boolean(slot));
}

export async function createSchedulingInvitationAction(formData: FormData) {
  const user = await getCurrentUser();
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: user.organizationId } });
  const settings = parseOrgSettings(org.settings);
  const accountId = String(formData.get("accountId") || "") || null;
  const result = await createSchedulingInvitation(prisma, {
    organizationId: user.organizationId,
    userId: user.id,
    accountId,
    lifetimeHours: Number(formData.get("lifetimeHours") || 24),
    allowedHours: settings.allowedInvitationHours,
    slots: slotsFromForm(formData, user.timezone, new Date()),
    publicContact: formData.get("publicContact") === "on",
    now: new Date(),
  });
  if (!result.ok) return result;
  revalidatePath("/meetings");
  return { ok: true as const, url: result.url };
}

export async function decideMeetingAction(formData: FormData) {
  const user = await getCurrentUser();
  const requestId = String(formData.get("requestId") || "");
  const decision = String(formData.get("decision") || "");
  const now = new Date();
  const note = String(formData.get("note") || "");
  let result: { ok: boolean; error?: string; url?: string };
  if (decision === "approve") {
    const approved = await approveMeetingRequest(prisma, { organizationId: user.organizationId, userId: user.id, requestId, now });
    if (approved.ok && approved.created) {
      const request = await prisma.meetingRequest.findFirst({ where: { id: requestId, organizationId: user.organizationId }, include: { invitation: { include: { createdBy: true } } } });
      if (request?.requesterEmail) {
        await deliverEmail({
          organizationId: user.organizationId,
          to: request.requesterEmail,
          subject: `Meeting confirmed with ${request.invitation.createdBy.name}`,
          text: `${request.invitation.createdBy.name} approved the meeting request from ${request.officeName}. This message confirms the time that was pending.`,
          html: `<p>${escapeHtml(request.invitation.createdBy.name)} approved the meeting request from ${escapeHtml(request.officeName)}.</p>`,
          idempotencyKey: `meeting-confirmed:${request.id}`,
        });
      }
    }
    result = approved.ok ? { ok: true } : { ok: false, error: approved.error };
  } else if (decision === "decline") {
    result = await declineMeetingRequest(prisma, { organizationId: user.organizationId, userId: user.id, requestId, note, now });
  } else if (decision === "cancel") {
    result = await cancelMeetingRequest(prisma, { organizationId: user.organizationId, userId: user.id, requestId, note, now });
  } else if (decision === "complete") {
    result = await completeMeetingRequest(prisma, { organizationId: user.organizationId, userId: user.id, requestId, note, now });
  } else if (decision === "propose") {
    const startsAt = fromZonedTime(`${String(formData.get("proposeDate") || "")}T${String(formData.get("proposeTime") || "09:00")}:00`, user.timezone);
    const proposed = await proposeMeetingTime(prisma, {
      organizationId: user.organizationId,
      userId: user.id,
      requestId,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 30 * 60 * 1000),
      now,
    });
    result = proposed.ok ? { ok: true, url: proposed.url } : { ok: false, error: proposed.error };
  } else {
    result = { ok: false, error: "Choose a decision." };
  }
  revalidatePath(`/meetings/${requestId}`);
  revalidatePath("/meetings");
  revalidatePath("/calendar");
  if (!result.ok) redirect(`/meetings/${requestId}?notice=${encodeURIComponent(result.error || "The request was not updated.")}`);
  redirect(`/meetings/${requestId}?notice=${encodeURIComponent(result.url ? `Proposal link: ${result.url}` : "Decision saved.")}`);
}

export async function schedulingPublicAction(payload: {
  token: string;
  intent: "request" | "replacement" | "accept_proposal";
  slotId?: string;
  officeName?: string;
  requesterName?: string;
  requesterEmail?: string;
  purpose?: string;
  note?: string;
}) {
  const limit = await consumeSharedRateLimit(prisma, `public:${hashToken(payload.token).slice(0, 24)}`, 20, 60_000);
  if (!limit.ok) return { error: "Too many attempts. Wait a minute and try again." };
  const tokenHash = hashToken(payload.token);
  const now = new Date();
  if (payload.intent === "request" && payload.slotId) {
    const result = await submitMeetingRequest(prisma, {
      tokenHash,
      slotId: payload.slotId,
      officeName: payload.officeName || "",
      requesterName: payload.requesterName || "",
      requesterEmail: payload.requesterEmail || "",
      purpose: payload.purpose || "",
      now,
    });
    return result.ok
      ? { ok: true as const, message: "Request sent. It stays pending until the representative approves it. This link cannot be used again." }
      : { error: result.error };
  }
  if (payload.intent === "replacement") {
    const result = await requestReplacementInvitation(prisma, {
      tokenHash,
      officeName: payload.officeName || "",
      note: payload.note || "",
      now,
    });
    return result.ok
      ? { ok: true as const, message: "Your representative was notified. No meeting was booked." }
      : { error: result.error };
  }
  if (payload.intent === "accept_proposal") {
    const result = await acceptProposedTime(prisma, { tokenHash, now });
    return result.ok
      ? { ok: true as const, message: "The proposed time is confirmed. A second acceptance will not create another meeting." }
      : { error: result.error };
  }
  return { error: "That action is not available." };
}

export async function approveLunchAction(formData: FormData) {
  const user = await getCurrentUser();
  const bookingId = String(formData.get("bookingId") || "");
  const result = await approveLunchBooking(prisma, {
    organizationId: user.organizationId,
    userId: user.id,
    bookingId,
    now: new Date(),
  });
  revalidatePath(`/lunches/${bookingId}`);
  redirect(`/lunches/${bookingId}?notice=${encodeURIComponent(result.ok ? "Lunch approved. It is on your RepPilot calendar." : result.error)}`);
}

export async function disconnectCalendarAction(formData: FormData) {
  const user = await getCurrentUser();
  const provider = String(formData.get("provider") || "");
  if (provider !== "google" && provider !== "microsoft") redirect("/calendar?notice=Unknown calendar provider.");
  await prisma.calendarConnection.updateMany({
    where: { userId: user.id, organizationId: user.organizationId, provider },
    data: { status: "not_connected", credentialCiphertext: null, externalAccountEmail: null },
  });
  await prisma.auditLog.create({
    data: {
      organizationId: user.organizationId,
      actorId: user.id,
      action: "calendar.disconnected",
      entityType: "CalendarConnection",
      entityId: provider,
    },
  });
  revalidatePath("/calendar");
  redirect("/calendar?notice=Calendar disconnected. Busy time from that provider is no longer read.");
}
