"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../auth";
import { prisma } from "../db";
import { prepareVisitBrief, recordReferralSyncAttempt, saveMonthlyTheme } from "../services/visit-intelligence";

function lines(value: FormDataEntryValue | null) {
  return String(value || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export async function regenerateBriefAction(formData: FormData) {
  const user = await getCurrentUser();
  const accountId = String(formData.get("accountId") || "");
  const result = await prepareVisitBrief(prisma, {
    organizationId: user.organizationId,
    userId: user.id,
    accountId,
    timeZone: user.timezone,
    now: new Date(),
    force: true,
  });
  if (!result.ok) redirect(`/accounts/${accountId}?notice=${encodeURIComponent(result.error)}`);
  revalidatePath(`/accounts/${accountId}`);
  revalidatePath(`/accounts/${accountId}/check-in`);
  revalidatePath("/today");
}

export async function syncReferralAction(formData: FormData) {
  const user = await getCurrentUser();
  const accountId = String(formData.get("accountId") || "");
  const provider = String(formData.get("provider") || "salesforce");
  const result = await recordReferralSyncAttempt(prisma, {
    organizationId: user.organizationId,
    actorId: user.id,
    accountId,
    provider,
  });
  const message = result.ok ? result.message : result.error;
  redirect(`/admin?notice=${encodeURIComponent(message)}`);
}

export async function saveThemeAction(formData: FormData) {
  const user = await getCurrentUser();
  const status = String(formData.get("status") || "DRAFT");
  const result = await saveMonthlyTheme(prisma, {
    organizationId: user.organizationId,
    actorId: user.id,
    roleKey: user.roleKey,
    themeId: String(formData.get("themeId") || "") || null,
    title: String(formData.get("title") || ""),
    description: String(formData.get("description") || ""),
    startDate: String(formData.get("startDate") || ""),
    endDate: String(formData.get("endDate") || ""),
    specialties: lines(formData.get("specialties")),
    territoryIds: formData.getAll("territoryId").map(String).filter(Boolean),
    userIds: formData.getAll("userId").map(String).filter(Boolean),
    priority: String(formData.get("priority") || "NORMAL"),
    talkingPoints: lines(formData.get("talkingPoints")),
    resources: lines(formData.get("resources")),
    targetMetric: String(formData.get("targetMetric") || "") || null,
    status: status === "PUBLISHED" || status === "ARCHIVED" ? status : "DRAFT",
  });
  const notice = result.ok ? "Theme saved." : result.error;
  redirect(`/manager/themes?notice=${encodeURIComponent(notice)}`);
}

export async function saveCrmMatchAction(formData: FormData) {
  const user = await getCurrentUser();
  if (user.roleKey !== "ORG_ADMIN" && user.roleKey !== "COMPLIANCE_ADMIN") {
    redirect("/admin?notice=You%20cannot%20change%20CRM%20mappings.");
  }
  const accountId = String(formData.get("accountId") || "") || null;
  const connectionId = String(formData.get("connectionId") || "");
  const externalOrganizationId = String(formData.get("externalOrganizationId") || "").trim();
  const status = String(formData.get("status") || "ambiguous");
  const connection = await prisma.externalCRMConnection.findFirst({
    where: { id: connectionId, organizationId: user.organizationId },
  });
  if (!connection || !externalOrganizationId) {
    redirect("/admin?notice=Choose%20a%20CRM%20connection%20and%20an%20external%20organization%20id.");
  }
  if (accountId) {
    const account = await prisma.account.findFirst({ where: { id: accountId, organizationId: user.organizationId } });
    if (!account) redirect("/admin?notice=That%20office%20is%20not%20in%20your%20organization.");
  }
  await prisma.practiceCrmMatch.upsert({
    where: { connectionId_externalOrganizationId: { connectionId: connection.id, externalOrganizationId } },
    update: { accountId, status, note: "Reviewed by an administrator. Similar names are not merged automatically." },
    create: {
      organizationId: user.organizationId,
      connectionId: connection.id,
      accountId,
      externalOrganizationId,
      status,
      note: "Reviewed by an administrator. Similar names are not merged automatically.",
    },
  });
  await prisma.auditLog.create({
    data: {
      organizationId: user.organizationId,
      actorId: user.id,
      action: "crm.match.updated",
      entityType: "PracticeCrmMatch",
      entityId: connection.id,
      metadata: { externalOrganizationId, status, accountId },
    },
  });
  redirect("/admin?notice=CRM%20mapping%20saved.%20No%20referral%20count%20was%20created.");
}
