"use server";
import { sendLunchConfirmation } from "./email/lunch-confirmation";
import { deliverInvitationEmail } from "./email/invitation-delivery";
import { workspaceAccess } from "./workspace-access";

import { hash, compare } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fromZonedTime } from "date-fns-tz";
import { prisma } from "./db";
import { clearPreviewSession, getSession } from "./session";
import { getCurrentUser } from "./auth";
import {getBusinessUser} from "./business-access";
import { canManageOrg, canReviewCompliance, appUrl, accountEditScope, taskEditScope } from "./permissions";
import { saveCheckIn, updateCheckIn } from "./services/checkins";
import { createInvitation } from "./services/lunches";
import { decideCateringApproval, recordCateringHandoff, recordCateringOrder, requestCateringApproval, requestPolicyException, reviewPolicyException } from "./services/orders";
import { receiptFileAllowed } from "./domain/catering";
import { extractCheckIn } from "./ai/gemini";
import { buildAccountBrief, draftFollowUpEmail } from "./domain/briefing";
import { hasBusinessCompliance } from "./compliance-access";
import { renderInvitationEmail } from "./email/templates";
import { consumeSharedRateLimit } from "./domain/rate-limit-store";
import { credentialVersion } from "./session-options";
import { recommendStops } from "./domain/routing";
import { isProfileTimezone } from "./domain/accounts";
import { findDuplicateAccount } from "./services/accounts";
import { parseOrgSettings, orgSettingsSchema, type OrgSettings } from "./org-settings";
import { safeWebsiteUrl } from "./domain/urls";
import { geocodeAddress } from "./maps/service";

const ROLES = [
  ["REP", "Representative", "Field representative", "organization"],
  ["MANAGER", "Manager", "Team manager", "organization"],
  ["COMPLIANCE_ADMIN", "Compliance administrator", "Reviews meal-policy exceptions", "organization"],
  ["ORG_ADMIN", "Organization administrator", "Manages the organization", "organization"],
  ["PLATFORM_ADMIN", "Platform administrator", "RepPilot platform operations", "platform"],
] as const;

async function ensureRoles() {
  for (const [key, name, description, scope] of ROLES) {
    await prisma.role.upsert({
      where: { key },
      update: {},
      create: { key, name, description, scope },
    });
  }
}

export async function loginFormAction(
  _previous: { error: string } | null,
  formData: FormData,
) {
  const result = await loginAction(formData);
  return result ?? { error: "Sign-in did not complete." };
}

export async function loginAction(formData: FormData) {
  await ensureRoles();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const attempts = await consumeSharedRateLimit(prisma, `login:${email || "blank"}`, 8, 15 * 60_000);
  if (!attempts.ok) return { error: "Too many sign-in attempts. Wait a few minutes and try again." };
  const user = await prisma.user.findUnique({
    where: { email },
    include: { memberships: { include: { role: true } } },
  });
  if (!user || user.disabledAt || !(await compare(password, user.passwordHash))) {
    return { error: "Email or password is incorrect." };
  }
  const membership = user.memberships.find(m=>m.role.key==="PLATFORM_ADMIN")??user.memberships[0];
  if (!membership) return { error: "This account is not in an organization." };
  const session = await getSession();
  const version = credentialVersion(user.passwordHash);
  session.userId = user.id;
  session.organizationId = membership.organizationId;
  session.roleKey = membership.role.key;
  session.credentialVersion = version;
  session.sessionVersion = user.sessionVersion;
  session.mfaVerifiedAt = undefined;
  await session.save();
  await clearPreviewSession();
  redirect(membership.role.key === "PLATFORM_ADMIN" ? "/platform" : "/today");
}

export async function logoutAction() {
  const session = await getSession();
  session.destroy();
  await clearPreviewSession();
  redirect("/login");
}

export async function signupFormAction(
  _previous: { error: string } | null,
  formData: FormData,
) {
  try {
    const result = await signupAction(formData);
    return result ?? { error: "The account was not created." };
  } catch (error) {
    const digest = typeof error === "object" && error && "digest" in error ? String((error as { digest?: unknown }).digest) : "";
    if (digest.startsWith("NEXT_REDIRECT")) throw error;
    return { error: "The account could not be created. Check the details and try again." };
  }
}

export async function signupAction(formData: FormData) {
  const { createOrganizationAccount } = await import("./signup");
  const result = await createOrganizationAccount({
    name: String(formData.get("name") || ""),
    email: String(formData.get("email") || ""),
    password: String(formData.get("password") || ""),
    organization: String(formData.get("organization") || ""),
  });
  if ("error" in result) return result;
  redirect("/onboarding");
}

export async function saveAccountAction(formData: FormData) {
  const user = await getCurrentUser();
  const id = String(formData.get("id") || "");
  if (id && !(await prisma.account.findFirst({ where: { id, ...accountEditScope(user) } }))) {
    redirect("/accounts?notice=You cannot edit this practice.");
  }
  const websiteInput = String(formData.get("website") || "").trim();
  const website = safeWebsiteUrl(websiteInput);
  if (websiteInput && !website) redirect("/accounts?notice=Use an absolute http or https website URL.");
  const data = {
    name: String(formData.get("name") || "").trim(),
    officeType: String(formData.get("officeType") || "Clinic").trim(),
    specialty: String(formData.get("specialty") || "").trim(),
    street: String(formData.get("street") || "").trim(),
    city: String(formData.get("city") || "").trim(),
    state: String(formData.get("state") || "").trim(),
    zip: String(formData.get("zip") || "").trim(),
    phone: String(formData.get("phone") || "").trim() || null,
    email: String(formData.get("email") || "").trim() || null,
    website,
    officeHours: String(formData.get("officeHours") || "").trim() || null,
    generalNotes: String(formData.get("generalNotes") || "").trim() || null,
    providerCount: Number(formData.get("providerCount") || 1),
    latitude: formData.get("latitude") ? Number(formData.get("latitude")) : null,
    longitude: formData.get("longitude") ? Number(formData.get("longitude")) : null,
  };
  if (!data.name || !data.specialty || !data.street || !data.city || !data.state || !data.zip) {
    redirect(id ? `/accounts/${id}/edit?notice=Name, specialty, and address are required.` : "/accounts/new?notice=Name, specialty, and address are required.");
  }
  if (data.generalNotes && /\b(patient|diagnosis|mrn)\b/i.test(data.generalNotes)) {
    redirect(id ? `/accounts/${id}/edit?notice=Office notes cannot include patient information.` : "/accounts/new?notice=Office notes cannot include patient information.");
  }
  const duplicate = await findDuplicateAccount(prisma, {
    organizationId: user.organizationId,
    name: data.name,
    street: data.street,
    zip: data.zip,
    exceptId: id || undefined,
  });
  if (duplicate) {
    redirect(`/accounts/${duplicate.id}?notice=An office with this name and address is already in your organization.`);
  }
  let geocodeNotice = "";
  let geocodeStatus: "ok" | "not_found" | "error" | null = null;
  const needsPoint = data.latitude == null || data.longitude == null || Number.isNaN(data.latitude) || Number.isNaN(data.longitude);
  if (needsPoint) {
    data.latitude = null;
    data.longitude = null;
    const geocoded = await geocodeAddress(`${data.street}, ${data.city}, ${data.state} ${data.zip}`);
    if (geocoded.status === "ok") {
      data.latitude = geocoded.value.lat;
      data.longitude = geocoded.value.lng;
      geocodeStatus = "ok";
    } else if (geocoded.status === "not_found") {
      geocodeStatus = "not_found";
      geocodeNotice = "Saved without map coordinates. The geocoder had no precise address match for that address.";
    } else if (geocoded.status === "error") {
      geocodeStatus = "error";
      geocodeNotice = "Saved without map coordinates. Geocoding did not return a location.";
    }
  }
  async function logGeocode(entityId: string) {
    if (!geocodeStatus) return;
    await prisma.auditLog.create({
      data: {
        organizationId: user.organizationId,
        actorId: user.id,
        action: "maps.geocode",
        entityType: "Account",
        entityId,
        metadata: { status: geocodeStatus },
      },
    });
  }
  if (id) {
    const existing = await prisma.account.findFirst({ where: { id, organizationId: user.organizationId } });
    if (!existing) redirect("/accounts?notice=That office was not found.");
    await prisma.account.update({ where: { id, ...accountEditScope(user) }, data });
    await prisma.auditLog.create({
      data: {
        organizationId: user.organizationId,
        actorId: user.id,
        action: "account.updated",
        entityType: "Account",
        entityId: id,
        metadata: { name: data.name },
      },
    });
    await logGeocode(id);
    revalidatePath(`/accounts/${id}`);
    redirect(geocodeNotice ? `/accounts/${id}?notice=${encodeURIComponent(geocodeNotice)}` : `/accounts/${id}`);
  }
  const account = await prisma.account.create({
    data: { ...data, organizationId: user.organizationId, status: "ACTIVE" },
  });
  await prisma.accountAssignment.create({
    data: { organizationId: user.organizationId, accountId: account.id, userId: user.id },
  });
  await prisma.auditLog.create({
    data: {
      organizationId: user.organizationId,
      actorId: user.id,
      action: "account.created",
      entityType: "Account",
      entityId: account.id,
      metadata: { name: data.name },
    },
  });
  await logGeocode(account.id);
  revalidatePath("/accounts");
  redirect(geocodeNotice ? `/accounts/${account.id}?notice=${encodeURIComponent(geocodeNotice)}` : `/accounts/${account.id}`);
}

export async function updateProfileAction(formData: FormData) {
  const user = await getCurrentUser();
  const name = String(formData.get("name") || "").trim();
  const timezone = String(formData.get("timezone") || "");
  const currentPassword = String(formData.get("currentPassword") || "");
  const nextPassword = String(formData.get("nextPassword") || "");
  if (name.length < 2) redirect("/settings?notice=Add your name.");
  if (!isProfileTimezone(timezone)) redirect("/settings?notice=Choose a supported timezone.");
  const record = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  const data: { name: string; timezone: string; passwordHash?: string } = { name, timezone };
  if (nextPassword) {
    if (nextPassword.length < 8) redirect("/settings?notice=Use at least 8 characters for the new password.");
    if (!(await compare(currentPassword, record.passwordHash))) {
      redirect("/settings?notice=The current password does not match.");
    }
    data.passwordHash = await hash(nextPassword, 10);
  }
  await prisma.user.update({ where: { id: user.id }, data });
  if (data.passwordHash) {
    const version = credentialVersion(data.passwordHash);
    const session = await getSession();
    session.credentialVersion = version;
    await session.save();
    await clearPreviewSession();
  }
  awai…3023 tokens truncated…ean(slot));
  const hours = Number(formData.get("expiryHours") || 48);
  const result = await createInvitation(prisma, {
    organizationId: user.organizationId,
    userId: user.id,
    accountId,
    purpose: String(formData.get("purpose") || ""),
    recipientName: String(formData.get("recipientName") || ""),
    recipientEmail: String(formData.get("recipientEmail") || ""),
    expiresAt: new Date(Date.now() + hours * 60 * 60 * 1000),
    expectedAttendees: Number(formData.get("expectedAttendees") || 8),
    estimatedBudgetCents: formData.get("budget") ? Math.round(Number(formData.get("budget")) * 100) : null,
    mealPreferences: String(formData.get("mealPreferences") || ""),
    deliveryInstructions: String(formData.get("deliveryInstructions") || ""),
    slots,
  });
  if (!result.ok) return result;
  const account = await prisma.account.findUniqueOrThrow({ where: { id: accountId } });
  const url = `${appUrl()}/i/${result.token}`;
  const message = renderInvitationEmail({
    officeName: account.name,
    repName: user.name,
    organizationName: user.organizationName,
    purpose: String(formData.get("purpose") || ""),
    url,
  });
  const delivery = await deliverInvitationEmail({
    organizationId: user.organizationId,
    to: String(formData.get("recipientEmail") || "") || account.email,
    subject: message.subject,
    html: message.html,
    text: message.text,
    idempotencyKey: `invitation:${result.invitation.id}`,
    userId: user.id,
    notification: {
      kind: "invitation_ready",
      title: "Invitation link is ready",
      body: `${account.name} can choose one of the times you offered.`,
      href: `/accounts/${accountId}?tab=lunches`,
    },
  });
  revalidatePath("/lunches");
  return {
    ok: true as const,
    url,
    emailStatus: delivery.status,
    invitationId: result.invitation.id,
  };
}

function centsOrNull(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const amount = Number(text);
  if (!Number.isFinite(amount) || amount < 0) return Number.NaN;
  return Math.round(amount * 100);
}

async function receiptFileFromForm(value: FormDataEntryValue | null) {
  if (!(value instanceof File) || value.size === 0) return null;
  const bytes = new Uint8Array(await value.arrayBuffer());
  const contentType = value.type || "application/octet-stream";
  const check = receiptFileAllowed({ contentType, byteSize: bytes.byteLength });
  if (!check.ok) return { error: check.error } as const;
  return { fileName: value.name.slice(0, 180) || "receipt", contentType, bytes };
}

export async function handoffAction(formData: FormData) {
  const user = await getBusinessUser();
  const bookingId = String(formData.get("bookingId") || "");
  const vendor = String(formData.get("vendor") || "");
  const result = await recordCateringHandoff(prisma, {
    organizationId: user.organizationId,
    userId: user.id,
    bookingId,
    vendor,
  });
  revalidatePath(`/lunches/${bookingId}`);
  if (!result.ok) redirect(`/lunches/${bookingId}?notice=${encodeURIComponent(result.error)}`);
  redirect(`/lunches/${bookingId}?notice=Marked as ordering externally. The provider site is where the order is placed.`);
}

export async function recordOrderAction(formData: FormData) {
  const user = await getBusinessUser();
  const bookingId = String(formData.get("bookingId") || "");
  const groupOrderInput = String(formData.get("groupOrderUrl") || "").trim();
  const groupOrderUrl = safeWebsiteUrl(groupOrderInput);
  if (groupOrderInput && !groupOrderUrl) redirect(`/lunches/${bookingId}?notice=Use an absolute http or https order URL.`);
  const receiptFile = await receiptFileFromForm(formData.get("receiptFile"));
  if (receiptFile && "error" in receiptFile) {
    redirect(`/lunches/${bookingId}?notice=${encodeURIComponent(receiptFile.error ?? "Receipt file was rejected.")}`);
  }
  const parts = {
    subtotalCents: centsOrNull(formData.get("subtotal")),
    taxCents: centsOrNull(formData.get("tax")),
    feeCents: centsOrNull(formData.get("fees")),
    deliveryCents: centsOrNull(formData.get("delivery")),
    tipCents: centsOrNull(formData.get("tip")),
  };
  if (Object.values(parts).some((value) => Number.isNaN(value))) {
    redirect(`/lunches/${bookingId}?notice=${encodeURIComponent("Line items have to be zero or a positive dollar amount.")}`);
  }
  const result = await recordCateringOrder(prisma, {
    organizationId: user.organizationId,
    userId: user.id,
    bookingId,
    vendor: String(formData.get("vendor") || "other"),
    finalAmountCents: Math.round(Number(formData.get("amount") || 0) * 100),
    orderReference: String(formData.get("reference") || ""),
    attendees: Number(formData.get("attendees") || 0),
    receiptNote: String(formData.get("receiptNote") || ""),
    status: String(formData.get("status") || "ORDER_RECORDED") as "ORDER_RECORDED" | "COMPLETED" | "CANCELED",
    deliveryStatus: formData.get("deliveryStatus") === "RECORDED_BY_REP" ? "RECORDED_BY_REP" : "NOT_TRACKED",
    parts,
    receiptFile: receiptFile && "bytes" in receiptFile ? receiptFile : null,
  });
  if (result.ok && formData.get("groupOrderUrl")) {
    const booking = await prisma.lunchBooking.findFirst({
      where: { id: bookingId, organizationId: user.organizationId },
      include: { order: true },
    });
    if (booking?.order) {
      await prisma.cateringOrder.update({
        where: { id: booking.order.id },
        data: { groupOrderUrl },
      });
    }
  }
  revalidatePath(`/lunches/${bookingId}`);
  revalidatePath("/spending");
  if (!result.ok) redirect(`/lunches/${bookingId}?notice=${encodeURIComponent(result.error)}`);
  redirect(`/lunches/${bookingId}?notice=Order details recorded. This does not confirm payment or delivery.`);
}

export async function requestCateringAction(formData: FormData) {
  const user = await getBusinessUser();
  const bookingId = String(formData.get("bookingId") || "");
  const estimated = centsOrNull(formData.get("estimate"));
  if (Number.isNaN(estimated)) {
    redirect(`/lunches/${bookingId}?notice=${encodeURIComponent("Enter the estimated total from your notes, or leave it blank.")}`);
  }
  const result = await requestCateringApproval(prisma, {
    organizationId: user.organizationId,
    userId: user.id,
    bookingId,
    attendees: Number(formData.get("attendees") || 0),
    estimatedAmountCents: estimated,
    dietary: String(formData.get("dietary") || ""),
    deliveryInstructions: String(formData.get("deliveryInstructions") || ""),
  });
  revalidatePath(`/lunches/${bookingId}`);
  revalidatePath("/manager");
  redirect(`/lunches/${bookingId}?notice=${encodeURIComponent(result.ok ? "Catering was submitted for a separate approval. No order was placed." : result.error)}`);
}

export async function decideCateringAction(formData: FormData) {
  const user = await getBusinessUser();
  if (!(await hasBusinessCompliance(user))) redirect("/billing?error=Upgrade%20to%20Business%20to%20use%20compliance%20review.");
  if (!canReviewCompliance(user.roleKey)) redirect("/compliance?notice=Only%20the%20account%20administrator%20can%20review%20compliance.");
  const bookingId = String(formData.get("bookingId") || "");
  if (formData.get("decision") === "approve" && !(await prisma.mealPolicy.findFirst({ where: { organizationId: user.organizationId, active: true }, select: { id: true } }))) redirect("/compliance?notice=Configure%20your%20company%20meal%20policy%20before%20approving%20catering.");
  const result = await decideCateringApproval(prisma, {
    organizationId: user.organizationId,
    reviewerId: user.id,
    reviewerRole: user.roleKey,
    bookingId,
    approve: formData.get("decision") === "approve",
    note: String(formData.get("note") || ""),
  });
  revalidatePath("/manager");
  revalidatePath(`/lunches/${bookingId}`);
  redirect(`/compliance?notice=${encodeURIComponent(result.ok ? "Catering decision saved. Opening a provider site still does not place the order." : result.error)}`);
}

export async function exceptionAction(formData: FormData) {
  const user = await getBusinessUser();
  if (!(await hasBusinessCompliance(user))) redirect("/billing?error=Upgrade%20to%20Business%20to%20use%20compliance%20review.");
  const bookingId = String(formData.get("bookingId") || "");
  const result = await requestPolicyException(prisma, {
    organizationId: user.organizationId,
    userId: user.id,
    bookingId,
    reason: String(formData.get("reason") || ""),
    orderTotalCents: Math.round(Number(formData.get("amount") || 0) * 100),
    attendees: Number(formData.get("attendees") || 0),
  });
  revalidatePath(`/lunches/${bookingId}`);
  redirect(`/lunches/${bookingId}?notice=${encodeURIComponent(result.request.reviewNote || `Exception status: ${result.request.status}`)}`);
}

export async function reviewExceptionAction(formData: FormData) {
  const user = await getBusinessUser();
  if (!(await hasBusinessCompliance(user))) redirect("/billing?error=Upgrade%20to%20Business%20to%20use%20compliance%20review.");
  if (!canReviewCompliance(user.roleKey)) redirect("/compliance?notice=You cannot review policy exceptions.");
  const result = await reviewPolicyException(prisma, {
    organizationId: user.organizationId,
    reviewerId: user.id,
    requestId: String(formData.get("requestId") || ""),
    approve: formData.get("decision") === "approve",
    note: String(formData.get("note") || ""),
  });
  revalidatePath("/compliance");
  if (!result.ok) redirect(`/compliance?notice=${encodeURIComponent(result.error)}`);
  redirect("/compliance?notice=Exception reviewed.");
}

export async function saveRouteAction(payload: { accountIds: string[]; reasons: Record<string, string> }) {
  const user = await getCurrentUser();
  if (!Array.isArray(payload.accountIds) || payload.accountIds.length < 1 || payload.accountIds.length > 12 || new Set(payload.accountIds).size !== payload.accountIds.length) return { error: "Save 1–12 different accounts per route." };
  const accounts = await prisma.account.findMany({
    where: { ...accountEditScope(user), id: { in: payload.accountIds } },
  });
  if (accounts.length !== payload.accountIds.length) return { error: "One of those offices is unavailable or is not assigned to you." };
  const route = await prisma.dailyRoute.create({
    data: {
      organizationId: user.organizationId,
      userId: user.id,
      routeDate: new Date(),
      status: "saved",
      summary: "Saved stop order. Drive time is not stored on the route. Check drive time when you need a current routing provider duration.",
      stops: {
        create: payload.accountIds.map((accountId, index) => ({
          accountId,
          position: index + 1,
          reason: payload.reasons[accountId] || "Added by the representative",
        })),
      },
    },
  });
  revalidatePath("/route");
  return { id: route.id };
}

export async function suggestRouteAction(origin: { lat: number; lng: number } | null) {
  const user = await getCurrentUser();
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: user.organizationId } });
  const settings = parseOrgSettings(org.settings);
  const [accounts, tasks, lunches] = await Promise.all([
    prisma.account.findMany({ where: { organizationId: user.organizationId } }),
    prisma.followUpTask.findMany({ where: { organizationId: user.organizationId, status: "OPEN" } }),
    prisma.lunchBooking.findMany({
      where: { organizationId: user.organizationId, status: { notIn: ["CANCELED", "COMPLETED"] }, slotStartsAt: { gte: new Date() } },
      include: { account: true },
    }),
  ]);
  const recommendations = recommendStops({
    accounts: accounts.map((account) => ({
      id: account.id,
      name: account.name,
      city: account.city,
      location: account.latitude != null && account.longitude != null ? { lat: account.latitude, lng: account.longitude } : null,
      lastVisitAt: account.lastVisitAt,
    })),
    tasks: tasks.map((task) => ({
      accountId: task.accountId,
      title: task.title,
      dueDate: task.dueDate,
      priority: task.priority,
      status: task.status,
    })),
    lunches: lunches.map((lunch) => ({ accountId: lunch.accountId, city: lunch.account.city, startsAt: lunch.slotStartsAt })),
    now: new Date(),
    origin,
    staleDays: settings.staleBriefingDays,
    limit: 6,
  });
  return {
    recommendations: recommendations.map((item) => ({
      ...item,
      name: accounts.find((account) => account.id === item.accountId)?.name ?? "Office",
    })),
    note: "Stops come from your records. Straight-line miles are not drive time. Use Check drive time after the routing provider is configured.",
  };
}

export async function updateOrgAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!canManageOrg(user.roleKey)) redirect("/admin?notice=Only an organization administrator can change these settings.");
  const requestedCap = formData.get("cap");
  if (requestedCap != null && (!Number.isFinite(Number(requestedCap)) || Number(requestedCap) < 0)) return { ok: false as const, error: "Enter a valid nonnegative company meal cap." };
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: user.organizationId } });
  const settings = parseOrgSettings(org.settings);
  settings.recentVisitDays = Number(formData.get("recentVisitDays") || settings.recentVisitDays);
  settings.overdueVisitDays = Number(formData.get("overdueVisitDays") || settings.overdueVisitDays);
  settings.invitationExpiryHours = Number(formData.get("invitationExpiryHours") || settings.invitationExpiryHours);
  const allowedHours = [24, 48, 168].filter((hours) => formData.get(`allow${hours}`) === "on");
  settings.allowedInvitationHours = (allowedHours.length > 0 ? allowedHours : [24]) as OrgSettings["allowedInvitationHours"];
  settings.workdayStart = String(formData.get("workdayStart") || settings.workdayStart);
  settings.workdayEnd = String(formData.get("workdayEnd") || settings.workdayEnd);
  settings.aiEnabled = formData.get("aiEnabled") === "on";
  const validated = orgSettingsSchema.safeParse(settings);
  if (!validated.success) return { ok: false as const, error: "Enter positive whole numbers for visit days and invitation hours." };
  const complianceEnabled = await hasBusinessCompliance(user);
  await prisma.$transaction(async tx => {
  await tx.organization.update({
    where: { id: org.id },
    data: {
      name: String(formData.get("name") || org.name),
      settings,
      branding: { displayName: String(formData.get("name") || org.name), emailFromName: String(formData.get("emailFromName") || org.name) },
    },
  });
  if (complianceEnabled) {
  const cap = Number(formData.get("cap") || 25);
  const active = await tx.mealPolicy.findFirst({ where: { organizationId: org.id, active: true } });
  if (active) {
    await tx.mealPolicy.update({
      where: { id: active.id },
      data: {
        perPersonCapCents: Math.round(cap * 100),
        entertainmentAllowed: false,
        referralLinkedMealsAllowed: false,
      },
    });
  } else if (formData.get("createPolicy") === "on") {
    await tx.mealPolicy.create({
      data: {
        organizationId: org.id,
        name: "Internal Meal Policy",
        version: "1.0",
        active: true,
        perPersonCapCents: Math.round(cap * 100),
        entertainmentAllowed: false,
        referralLinkedMealsAllowed: false,
        exceptionsPermitted: true,
        educationalPurposeRequired: true,
      },
    });
  }
  if (active || formData.get("createPolicy") === "on") await tx.auditLog.create({ data: { organizationId: org.id, actorId: user.id, action: active ? "meal_policy.updated" : "meal_policy.created", entityType: "MealPolicy", entityId: active?.id || org.id, metadata: { perPersonCapCents: Math.round(cap * 100), reviewedByAccountAdmin: true } } });
  }
  });
  revalidatePath("/admin");
  revalidatePath("/compliance");
  return { ok: true as const };
}

export async function createTaskAction(formData: FormData) {
  const user = await getCurrentUser();
  const title = String(formData.get("title") || "").trim();
  if (title.length < 2) redirect("/tasks?notice=Add a short task title.");
  const accountId = String(formData.get("accountId") || "") || null;
  if (accountId) {
    const account = await prisma.account.findFirst({ where: { id: accountId, organizationId: user.organizationId } });
    if (!account) redirect("/tasks?notice=That office was not found.");
  }
  const due = String(formData.get("dueDate") || "");
  await prisma.followUpTask.create({
    data: {
      organizationId: user.organizationId,
      ownerId: user.id,
      accountId,
      title,
      dueDate: due ? fromZonedTime(`${due}T12:00:00`, user.timezone) : null,
      priority: String(formData.get("priority") || "NORMAL") === "HIGH" ? "HIGH" : "NORMAL",
      source: "manual",
      status: "OPEN",
    },
  });
  revalidatePath("/tasks");
  revalidatePath("/today");
  redirect("/tasks?notice=Task saved.");
}

export async function createMemberAction(formData: FormData) {
  const user = await getBusinessUser();
  if (!canManageOrg(user.roleKey)) redirect("/admin?notice=Only an organization administrator can add people.");
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const roleKey = String(formData.get("role") || "REP");
  if (!["REP", "MANAGER", "COMPLIANCE_ADMIN", "ORG_ADMIN"].includes(roleKey)) {
    redirect("/admin?notice=Choose a role inside this organization.");
  }
  if (name.length < 2 || password.length < 8 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirect("/admin?notice=Name, a valid email, and an 8-character password are required.");
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) redirect("/admin?notice=That email already has an account.");
  const role = await prisma.role.findUniqueOrThrow({ where: { key: roleKey } });
  const created = await prisma.user.create({
    data: { name, email, passwordHash: await hash(password, 10), timezone: user.timezone },
  });
  await prisma.organizationMembership.create({
    data: { organizationId: user.organizationId, userId: created.id, roleId: role.id },
  });
  revalidatePath("/admin");
  redirect("/admin?notice=Person added.");
}

export async function createTerritoryAction(formData: FormData) {
  const user = await getBusinessUser();
  if (!canManageOrg(user.roleKey)) redirect("/admin?notice=Only an organization administrator can add a territory.");
  const name = String(formData.get("name") || "").trim();
  if (name.length < 2) redirect("/admin?notice=Name the territory.");
  await prisma.territory.create({
    data: { organizationId: user.organizationId, name },
  });
  revalidatePath("/admin");
  redirect("/admin?notice=Territory added.");
}

export async function markNotificationsReadAction() {
  const user = await getCurrentUser();
  await prisma.notification.updateMany({
    where: { userId: user.id, organizationId: user.organizationId, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/notifications");
}

export async function clinicRespondAction(payload: {
  token: string;
  intent: "accept" | "confirm" | "change" | "request";
  slotId?: string;
  attendees?: number;
  message?: string;
  name?: string;
  requestCatering?: boolean;
  dietary?: string;
  deliveryInstructions?: string;
}) {
  const { hashToken } = await import("./domain/tokens");
  const ipLimit = await consumeSharedRateLimit(prisma, `public:${hashToken(payload.token).slice(0, 24)}`, 20, 60_000);
  if (!ipLimit.ok) return { error: "Too many attempts. Wait a minute and try again." };
  const { acceptInvitationSlot, confirmLunch, requestLunchChange } = await import("./services/lunches");
  const tokenHash = hashToken(payload.token);
  const now = new Date();
  if (payload.intent === "accept" && payload.slotId) {
    const result = await acceptInvitationSlot(prisma, {
      tokenHash,
      slotId: payload.slotId,
      now,
      responderName: payload.name,
      catering: payload.requestCatering
        ? {
            requested: true,
            attendees: payload.attendees,
            dietary: payload.dietary,
            deliveryInstructions: payload.deliveryInstructions,
          }
        : undefined,
    });
    return result.ok
      ? {
          ok: true as const,
          message: payload.requestCatering
            ? "Request sent. Your representative must approve the time before it is on the calendar. Catering needs a separate approval and is not ordered."
            : "Request sent. Your representative must approve it before it is on the calendar.",
        }
      : { error: result.error };
  }
  if (payload.intent === "confirm") {
    const result = await confirmLunch(prisma, {
      tokenHash,
      now,
      responderName: payload.name,
      attendeeCount: payload.attendees,
      deliveryInstructions: payload.deliveryInstructions,
    });
    if (!result.ok) return { error: result.error };
    const delivery = await sendLunchConfirmation(result.bookingId, "confirmed");
    return { ok: true as const, message: delivery.status === "sent" ? "Thank you. The lunch is confirmed. A confirmation email with a calendar invitation has been sent to the office." : "Thank you. The lunch is confirmed, but the confirmation email could not be delivered. Please contact your representative." };
  }
  if (payload.intent === "change" || payload.intent === "request") {
    const link = await prisma.secureLinkToken.findFirst({ where: { tokenHash, revokedAt: null }, include: { booking: true, account: true } });
    if (link && !await workspaceAccess(prisma, link.organizationId)) return { error: "This workspace is unavailable." };
    if (payload.intent === "request" && link?.accountId && !link.bookingId) {
      const rep = await prisma.accountAssignment.findFirst({ where: { accountId: link.accountId }, include: { user: true } });
      if (rep) {
        await prisma.notification.create({
          data: {
            organizationId: link.organizationId,
            userId: rep.userId,
            kind: "office_request",
            title: "Office sent a request",
            body: payload.message || "The office asked for a follow-up.",
            href: `/accounts/${link.accountId}`,
          },
        });
      }
      return { ok: true as const, message: "Your representative received the request. This page cannot book a new lunch." };
    }
    const result = await requestLunchChange(prisma, {
      tokenHash,
      now,
      message: payload.message || "The office asked for a change.",
      requestedAttendees: payload.attendees,
    });
    return result.ok ? { ok: true as const, message: "Your representative will follow up. The lunch was not canceled." } : { error: result.error };
  }
  return { error: "That action is not available on this link." };
}
