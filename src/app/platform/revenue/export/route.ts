import {requirePlatformAdmin} from "@/lib/auth";
import {loadRevenueReport} from "@/lib/platform/revenue-data";
import {revenueWorkbook} from "@/lib/platform/revenue-excel";
import {consumeSharedRateLimit} from "@/lib/domain/rate-limit-store";
import {prisma} from "@/lib/db";
export const maxDuration=60;
export async function GET(){
 const user=await requirePlatformAdmin();
 const headers={"Cache-Control":"private, no-store, max-age=0","X-Content-Type-Options":"nosniff"};
 if(!(await consumeSharedRateLimit(prisma,"revenue-export:"+user.id,5,60000)).ok)return Response.json({error:"Too many exports. Wait a minute and try again."},{status:429,headers});
 try{
  const report=await loadRevenueReport(),body=await revenueWorkbook(report);
  await prisma.auditLog.create({data:{organizationId:user.organizationId,actorId:user.id,action:"platform.revenue.exported",entityType:"RevenueReport",entityId:report.generatedAt,metadata:{generatedAt:report.generatedAt,customers:report.payingCustomers,subscriptions:report.payingSubscriptions}}});
  return new Response(body,{headers:{...headers,"Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","Content-Disposition":'attachment; filename="reppilot-paying-customers-'+report.generatedAt.slice(0,10)+'.xlsx"'}});
 }catch{return Response.json({error:"The live Stripe report could not be completed. No partial spreadsheet was generated. Please try again."},{status:503,headers});}
}
