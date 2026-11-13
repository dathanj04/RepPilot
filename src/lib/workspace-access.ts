import "server-only";
import type { Db } from "./db";
import { trialAccess } from "./domain/trial";
import { hasPaidAccess } from "./stripe";
export async function workspaceAccess(db: Db, organizationId: string) {
  const subscription = await db.subscription.findUnique({ where: { organizationId } });
  return trialAccess(subscription).allowed || await hasPaidAccess(subscription?.stripeCustomerId, organizationId);
}
