import { prisma } from "./db";
import {hasBusinessFeatures,type PlanTier} from "./domain/paid-access";
import { complianceFeatureAvailable } from "./domain/compliance-access";
export async function hasBusinessCompliance(user: {organizationId:string;trialDaysLeft:number|null;planTier?:PlanTier|null}) {
  if(user.planTier!==undefined)return hasBusinessFeatures(user);
  const subscription=await prisma.subscription.findUnique({where:{organizationId:user.organizationId},select:{plan:true}});
  return complianceFeatureAvailable(subscription?.plan,user.trialDaysLeft);
}
