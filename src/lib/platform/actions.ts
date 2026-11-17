"use server";
import {compare} from "bcryptjs";
import {revalidatePath} from "next/cache";
import {requirePlatformAdmin} from "../auth";
import {prisma} from "../db";
import {consumeSharedRateLimit} from "../domain/rate-limit-store";
import {changePlatformRecord} from "./service";
import {deliverEmail} from "../email/send";
import {cancellationMessage,type CancellationDetails} from "../email/lunch-cancellation";
export type PlatformState={error?:string;message?:string};
export async function platformChangeAction(_state:PlatformState,form:FormData):Promise<PlatformState>{
 const actor=await requirePlatformAdmin();
 try{
  if(!(await consumeSharedRateLimit(prisma,"platform:"+actor.id,10,60000)).ok)throw Error("Wait a minute before trying again.");
  const record=await prisma.user.findUniqueOrThrow({where:{id:actor.id},select:{passwordHash:true}});
  if(!await compare(String(form.get("password")||""),record.passwordHash))throw Error("Your current password did not match.");
  if(form.get("confirmed")!=="yes")throw Error("Confirm this administrative change.");
  const kind=String(form.get("kind")),id=String(form.get("id")||""),reason=String(form.get("reason")||"").trim();
  if(kind==="retry-cancellation"){
   if(reason.length<10||reason.length>1000)throw Error("Give a reason between 10 and 1,000 characters.");
   const delivery=await prisma.notificationDelivery.findUniqueOrThrow({where:{id}});
   if(delivery.status!=="failed")throw Error("Only a failed cancellation notice can be retried.");
   const audit=await prisma.auditLog.findFirst({where:{id:delivery.idempotencyKey,organizationId:delivery.organizationId,action:"lunch.canceled"}});
   if(!audit)throw Error("This notice cannot be reconstructed safely. Use the original workflow.");
   const details=audit.metadata as unknown as CancellationDetails;
   if(!details.notifyOffice||details.recipientEmail!==delivery.toAddress)throw Error("The stored cancellation recipient is not valid.");
   const result=await deliverEmail({organizationId:delivery.organizationId,to:details.recipientEmail,replyTo:details.repEmail,idempotencyKey:audit.id,...cancellationMessage(details,audit.createdAt)});
   await prisma.auditLog.create({data:{organizationId:delivery.organizationId,actorId:actor.id,action:"platform.cancellation.retry",entityType:"NotificationDelivery",entityId:id,metadata:{reason,status:result.status}}});
   if(result.status!=="sent")throw Error("The provider has not confirmed this notice was sent. Check delivery status before retrying.");
  }else{
   if(kind!=="workspace"&&kind!=="user"&&kind!=="role")throw Error("Choose a valid operation.");
   await changePlatformRecord(prisma,actor,{kind,id,value:String(form.get("value")||""),reason});
  }
  revalidatePath("/platform","layout");return {message:"Change saved and recorded in the audit log."};
 }catch(e){return {error:e instanceof Error?e.message:"The administrative change could not be saved."};}
}
