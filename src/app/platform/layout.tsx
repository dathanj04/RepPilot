import Link from "next/link";
import {connection} from "next/server";
import {requirePlatformAdmin} from "@/lib/auth";
import {logoutAction} from "@/lib/actions";
export const instant=false;
export default async function PlatformLayout({children}:{children:React.ReactNode}){
 await connection();const user=await requirePlatformAdmin();
 return <div className="min-h-dvh bg-[#f4f7fa] text-[#14263d]"><header className="border-b bg-white px-4 py-4"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3"><div><p className="font-bold">RepPilot · Owner console</p><p className="text-xs text-slate-500">{user.email}</p></div><form action={logoutAction}><button className="min-h-11 rounded-xl border px-4">Sign out</button></form></div><nav …13247 tokens truncated… active ? "meal_policy.updated" : "meal_policy.created", entityType: "MealPolicy", entityId: active?.id || org.id, metadata: { perPersonCapCents: Math.round(cap * 100), reviewedByAccountAdmin: true } } });
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
