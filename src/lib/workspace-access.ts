import "server-only";
import type { Db } from "./db";
import { trialAccess } from "./domain/trial";
import { hasPaidAccess, getPaidTier } from "./stripe";
export async function workspaceAccess(db: Db, organizationId: string,businessOnly=false) {
  const subscription = await db.subscription.findUnique({ where: { organizationId },include:{organization:{select:{suspendedAt:true}}} });
  if(subscription?.organization?.suspendedAt)return false;
  if(trialAccess(subscription).allowed)return true;
  return businessOnly?(await getPaidTier(subscription?.stripeCustomerId,organizationId))==="business":await hasPaidAccess(subscription?.stripeCustomerId,organizationId);
}
