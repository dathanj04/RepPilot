import "server-only";
import { getPaidTier } from "./stripe";
import { trialAccess } from "./domain/trial";
import {hasBusinessFeatures,type PlanTier} from "./domain/paid-access";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { credentialVersion } from "./session-options";
import { clearPreviewSession, getSession } from "./session";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  timezone: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  roleKey: string;
  isDemo: boolean;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  planTier?:PlanTier|null;
};

export async function getCurrentUser(options: { allowExpiredTrial?: boolean } = {}): Promise<CurrentUser> {
  const session = await getSession();
  if (!session.userId || !session.organizationId) redirect("/login");

  const membership = await prisma.organizationMembership.findUnique({
    where: {
      organizationId_userId: {
        organizationId: session.organizationId,
        userId: session.userId,
      },
    },
    include: { user: true, role: true, organization: { include: { subscription: true } } },
  });
  if (!membership || session.credentialVersion !== credentialVersion(membership.user.passwordHash)) {
    session.destroy();
    await clearPreviewSession();
    redirect("/login");
  }

  if(membership.user.disabledAt)redirect("/login?error=Account%20access%20is%20disabled.%20Contact%20support.");
  if(membership.organization.suspendedAt&&membership.role.key!=="PLATFORM_ADMIN")redirect("/support?notice=Workspace%20access%20is%20paused.%20Contact%20support.");
  let access = trialAccess(membership.organization.subscription);
  let planTier:PlanTier|null=access.allowed?"business":null;
  if(!access.allowed){
    planTier=await getPaidTier(membership.organization.subscription?.stripeCustomerId,membership.organizationId);
    if(planTier)access={allowed:true,daysLeft:null,endsAt:null};
  }
  if (!options.allowExpiredTrial && membership.role.key !== "PLATFORM_ADMIN" && !access.allowed) redirect("/trial-ended");

  return {
    planTier,
    trialEndsAt: access.endsAt,
    trialDaysLeft: access.daysLeft,
    id: membership.user.id,
    name: membership.user.name,
    email: membership.user.email,
    timezone: membership.user.timezone || membership.organization.timezone,
    organizationId: membership.organizationId,
    organizationName: membership.organization.name,
    organizationSlug: membership.organization.slug,
    roleKey: membership.role.key,
    isDemo: membership.organization.isDemo,
  };
}

export async function requireAppUser(options: { allowExpiredTrial?: boolean } = {}) {
  const user = await getCurrentUser(options);
  if (user.roleKey === "PLATFORM_ADMIN") redirect("/platform");
  return user;
}

export async function requirePlatformAdmin() {
  const user = await getCurrentUser();
  if (user.roleKey !== "PLATFORM_ADMIN") redirect("/today");
  return user;
}

export async function requireBusinessUser(){
 const user=await requireAppUser();
 if(!hasBusinessFeatures(user))redirect("/billing?upgrade=business");
 return user;
}
