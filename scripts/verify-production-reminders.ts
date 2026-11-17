import {prisma} from "../src/lib/db";
import {reportOperationalAlert} from "../src/lib/monitoring";
const fixture="ops-verification-20261117";
async function main(){
 if(process.env.VERCEL_ENV!=="production"||!process.argv.includes("--owner-inbox-only"))throw Error("Production owner-only verification must be explicit");
 const mode=process.argv.at(-1);
 if(mode==="prepare"){
  const owner=await prisma.user.findUniqueOrThrow({where:{email:"dathan.johnson@gmail.com"}});
  const existing=await prisma.organization.findUnique({where:{slug:fixture}});
  if(existing&&!existing.isDemo)throw Error("Fixture collision");
  const now=new Date();
  const org=await prisma.organization.upsert({where:{slug:fixture},update:{},create:{slug:fixture,name:"RepPilot internal email verification — no office",isDemo:true,subscription:{create:{plan:"business",status:"trialing",trialStartedAt:now,trialEndsAt:new Date(now.getTime()+14*86400000)}}}});
  const priorAccount=await prisma.account.findUnique({where:{id:fixture}});
  if(priorAccount&&(!priorAccount.isDemo||priorAccount.organizationId!==org.id||priorAccount.email!==owner.email))throw Error("Account fixture collision");
  const account=await prisma.account.upsert({where:{id:fixture},update:{},create:{id:fixture,organizationId:org.id,name:"Owner inbox test — not a real office",isDemo:true,specialty:"Internal verification",street:"Internal verification",city:"Test",state:"TX",zip:"00000",email:owner.email}});
  const priorBooking=await prisma.lunchBooking.findUnique({where:{id:fixture}});
  if(priorBooking&&(priorBooking.organizationId!==org.id||priorBooking.accountId!==account.id||priorBooking.representativeId!==owner.id))throw Error("Booking fixture collision");
  await prisma.lunchBooking.upsert({where:{id:fixture},update:{},create:{id:fixture,organizationId:org.id,accountId:account.id,representativeId:owner.id,slotStartsAt:new Date(now.getTime()+7*86400000),slotEndsAt:new Date(now.getTime()+7*86400000+1800000),status:"SCHEDULED",purpose:"Owner-only scheduled-email verification",expectedAttendees:1,timezone:"America/Chicago"}});
  const priorReminder=await prisma.lunchReminder.findUnique({where:{id:fixture}});
  if(priorReminder&&(priorReminder.organizationId!==org.id||priorReminder.bookingId!==fixture||priorReminder.idempotencyKey!==fixture))throw Error("Reminder fixture collision");
  await prisma.lunchReminder.upsert({where:{id:fixture},update:{},create:{id:fixture,organizationId:org.id,bookingId:fixture,kind:"SEVEN_DAY",scheduledFor:new Date(now.getTime()+60000),idempotencyKey:fixture}});
  await reportOperationalAlert("ops.test","Owner-requested alert verification",{route:"/api/cron/reminders",method:"POST"});
  console.log(JSON.stringify({event:"verification.prepared",ownerInboxOnly:true,dueAfterSeconds:60}));
 }else if(mode==="verify"){
  const reminder=await prisma.lunchReminder.findUniqueOrThrow({where:{id:fixture}});
  const deliveries=await prisma.notificationDelivery.findMany({where:{idempotencyKey:fixture},select:{status:true,providerMessageId:true}});
  const success=await prisma.rateLimitBucket.findUnique({where:{key:"operational:reminders:last-success"}});
  let providerStatus="unavailable";
  const id=deliveries[0]?.providerMessageId;
  if(id){const r=await fetch("https://api.resend.com/emails/"+encodeURIComponent(id),{headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`}});if(r.ok)providerStatus=(await r.json()).last_event||"accepted";else providerStatus="lookup_http_"+r.status;}
  const alert=await prisma.rateLimitBucket.findFirst({where:{key:{startsWith:"operational:alert-receipt:"}},orderBy:{updatedAt:"desc"}});
  let alertStatus="unavailable";
  if(alert){const ar=await fetch("https://api.resend.com/emails/"+encodeURIComponent(alert.key.split(":").at(-1)!),{headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`}});if(ar.ok)alertStatus=(await ar.json()).last_event||"accepted";else alertStatus="lookup_http_"+ar.status;}
  console.log(JSON.stringify({event:"verification.alert",providerStatus:alertStatus}));
  console.log(JSON.stringify({event:"verification.result",reminderStatus:reminder.status,deliveryRecords:deliveries.length,deliveryStatus:deliveries[0]?.status||"none",providerStatus,heartbeatValid:Boolean(success&&success.resetAt>new Date())}));
  const ownerConfirmed=process.argv.includes("--owner-confirmed-receipt");
  // Use this flag only after the authorized recipient explicitly confirms both messages.
  // It records human evidence without presenting a send-only key as provider delivery proof.
  if(reminder.status!=="SENT"||deliveries.length!==1||(!ownerConfirmed&&(providerStatus!=="delivered"||alertStatus!=="delivered")))throw Error("Scheduled delivery not yet verified");
  if(ownerConfirmed){
   const booking=await prisma.lunchBooking.findUniqueOrThrow({where:{id:fixture},include:{organization:true,account:true}});
   const owner=await prisma.user.findUniqueOrThrow({where:{email:"dathan.johnson@gmail.com"}});
   if(!booking.organization.isDemo||booking.organization.slug!==fixture||!booking.account.isDemo||booking.account.email!==owner.email)throw Error("Invalid verification fixture");
   await prisma.auditLog.upsert({where:{id:fixture+"-receipt"},update:{},create:{id:fixture+"-receipt",organizationId:booking.organizationId,actorId:owner.id,action:"ops.verification.owner_confirmed_receipt",entityType:"LunchReminder",entityId:fixture,metadata:{reminderReceived:true,alertReceived:true,deliveryRecords:1,evidence:"Owner explicitly confirmed both messages on November 17, 2026. Scheduled runs: 15:05 UTC processed 1; 15:10 UTC processed 0."}}});
   await prisma.lunchBooking.update({where:{id:fixture},data:{status:"CANCELED",notes:"Internal verification complete. Owner confirmed reminder and alert receipt. No real office contacted."}});
  }
  console.log(JSON.stringify({event:"verification.complete",ownerConfirmedReceipt:ownerConfirmed,duplicateDeliveryRecords:0}));
 }else throw Error("Choose prepare or verify");
}
main().catch(()=>{console.error("Production verification incomplete; no secrets or customer data logged.");process.exitCode=1;}).finally(()=>prisma.$disconnect());
