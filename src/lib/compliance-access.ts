import { prisma } from "./db";
import { complianceFeatureAvailable } from "./domain/compliance-access";
export async function hasBusinessCompliance(user: {organizationId:string;trialDaysLeft:number|null}) {
  const subscription=await prisma.subscription.findUnique({where:{organizationId:user.organizationId},select:{plan:true}});
  return complianceFeatureAvailable(subscription?.plan,user.trialDaysLeft);
}
