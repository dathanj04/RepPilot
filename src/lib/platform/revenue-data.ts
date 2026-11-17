import "server-only";
import {prisma} from "../db";
import {stripeConfigured,stripeRequest} from "../stripe";
import {buildRevenueReport,listRevenueSubscriptions} from "./revenue";
export async function loadRevenueReport(){
 if(!stripeConfigured())throw Error("Stripe is not configured. Customer totals are unavailable.");
 const [subscriptions,workspaces]=await Promise.all([listRevenueSubscriptions(stripeRequest),prisma.organization.findMany({where:{isDemo:false,subscription:{stripeCustomerId:{not:null}}},select:{id:true,name:true,subscription:{select:{stripeCustomerId:true}}}})]);
 return buildRevenueReport(subscriptions,workspaces);
}
