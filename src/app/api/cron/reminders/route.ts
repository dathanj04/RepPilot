import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { processDueReminders } from "@/lib/services/reminders";
import { deliverEmail } from "@/lib/email/send";
import { renderReminderEmail } from "@/lib/email/templates";
import { appUrl } from "@/lib/permissions";
import { reportOperationalAlert } from "@/lib/monitoring";

export const maxDuration=60;
export const POST=run;
export const GET=run;
function authorized(request:Request){
 const supplied=Buffer.from(request.headers.get("authorization")||"");
 return [process.env.SCHEDULER_SECRET,process.env.CRON_SECRET].some(secret=>{
  if(!secret)return false;
  const expected=Buffer.from(`Bearer ${secret}`);
  return expected.length===supplied.length&&timingSafeEqual(expected,supplied);
 });
}
async function heartbeat(name:string,count:number){
 const key="operational:reminders:"+name;
 await prisma.rateLimitBucket.upsert({where:{key},create:{key,count,resetAt:new Date(Date.now()+15*60000)},update:{count,resetAt:new Date(Date.now()+15*60000)}});
}
async function run(request:Request){
 if(!authorized(request))return Response.json({error:"Unauthorized"},{status:401});
 try{
  const results=await processDueReminders(prisma,new Date(),{appUrl:appUrl(),render:renderReminderEmail,send:deliverEmail});
  const failed=results.filter(r=>r.status==="failed").length;
  await heartbeat("last-run",results.length);
  if(failed){
   await reportOperationalAlert("reminder.failed","Delivery failure",{route:"/api/cron/reminders",method:request.method});
   return Response.json({processed:results.length,failed},{status:503});
  }
  await heartbeat("last-success",results.length);
  return Response.json({processed:results.length,failed:0});
 }catch{
  await reportOperationalAlert("reminder.failed","Scheduler failure",{route:"/api/cron/reminders",method:request.method});
  return Response.json({error:"Reminder processing failed"},{status:503});
 }
}
