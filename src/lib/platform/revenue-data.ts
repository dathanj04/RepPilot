import "server-only";
import {prisma} from "../db";
import {stripeConfigured,stripeRequest} from "../stripe";
import {buildRevenueReport,listRevenueSubscriptions} from "./revenue";
export async function loadRevenueReport(){
 if(!stripeConfigured())throw Error("Stripe is not configured. Customer totals are unavailable.");
 const [subscriptions,workspaces]=await Promise.all([listRevenueSubscriptions(stripeRequest),prisma.organization.findMany({where:{isDemo:false,subscription:{isNot:null}},select:{id:true,name:true,memberships:{where:{role:{key:"ORG_ADMIN"}},select:{user:{select:{email:true}}},take:1},subscription:{select:{stripeCustomerId:true,status:true,plan:true,trialStartedAt:true,trialEndsAt:true}}}})]);
 return buildRevenueReport(subscriptions,workspaces);
}
