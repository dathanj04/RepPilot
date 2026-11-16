import type {Db} from "../db";
import {canEditTeamRecords} from "../permissions";
import {cancellationMessage,type CancellationDetails} from "../email/lunch-cancellation";
import type {OutboundEmail} from "./reminders";
type Actor={id:string;organizationId:string;roleKey:string};
export const cancellationId=(kind:"booking"|"invitation",id:string)=>"lunch_cancel_"+kind+"_"+id;
export async function cancelPendingLunch(db:Db,actor:Actor,input:{kind:"booking"|"invitation";id:string;reason:string;recipientEmail:string;notifyOffice:boolean;externalOrderAcknowledged:boolean}){
 const reason=input.reason.trim();
 if(reason.length<5||reason.length>1000)throw Error("Enter a cancellation reason between 5 and 1,000 characters.");
 if(input.notifyOffice&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.recipientEmail))throw Error("Enter the office email, or turn off email notification.");
 if(input.recipientEmail.length>254)throw Error("The office email is too long.");
 return db.$transaction(async tx=>{
  const auditId=cancellationId(input.kind,input.id);
  let details:CancellationDetails;
  if(input.kind==="invitation"){
   await tx.$queryRaw`SELECT id FROM "LunchInvitation" WHERE id=${input.id} FOR UPDATE`;
   const invitation=await tx.lunchInvitation.findFirst({where:{id:input.id,organizationId:actor.organizationId},include:{account:true,createdBy:true,booking:true}});
   if(!invitation||(!canEditTeamRecords(actor.roleKey)&&invitation.createdById!==actor.id))throw Error("This invitation is not available to you.");
   const prior=await tx.auditLog.findUnique({where:{id:auditId}});
   if(prior)return prior;
   if(invitation.booking)throw Error("The office has requested a lunch. Open that lunch to cancel the selected time.");
   if(invitation.status!=="ACTIVE")throw Error("Only a pending invitation can be canceled.");
   details={kind:input.kind,targetId:input.id,ownerId:invitation.createdById,office:invitation.account.name,recipientEmail:input.recipientEmail.trim(),reason,rep:invitation.createdBy.name,repEmail:invitation.createdBy.email,location:[invitation.account.street,invitation.account.city,invitation.account.state,invitation.account.zip].join(", "),notifyOffice:input.notifyOffice,startsAt:null,endsAt:null,timezone:invitation.createdBy.timezone};
   await tx.lunchInvitation.update({where:{id:input.id},data:{status:"CANCELED"}});
   await tx.invitationTimeSlot.updateMany({where:{invitationId:input.id},data:{status:"withdrawn"}});
   await tx.secureLinkToken.updateMany({where:{invitationId:input.id,organizationId:actor.organizationId,revokedAt:null},data:{revokedAt:new Date()}});
  }else{
   const snapshot=await tx.lunchBooking.findFirst({where:{id:input.id,organizationId:actor.organizationId},select:{invitationId:true}});
   if(snapshot?.invitationId)await tx.$queryRaw`SELECT id FROM "LunchInvitation" WHERE id=${snapshot.invitationId} FOR UPDATE`;
   await tx.$queryRaw`SELECT id FROM "LunchBooking" WHERE id=${input.id} FOR UPDATE`;
   const booking=await tx.lunchBooking.findFirst({where:{id:input.id,organizationId:actor.organizationId},include:{account:true,representative:true,order:true}});
   if(!booking||(!canEditTeamRecords(actor.roleKey)&&booking.representativeId!==actor.id))throw Error("This lunch is not available to you.");
   const prior=await tx.auditLog.findUnique({where:{id:auditId}});
   if(prior)return prior;
   if(!["AWAITING_APPROVAL","SCHEDULED","CONFIRMED","CHANGE_REQUESTED"].includes(booking.status))throw Error("Only a pending or upcoming lunch can be canceled. Completed lunches remain in history.");
   const ordered=booking.order&&!["NOT_STARTED","CANCELED"].includes(booking.order.status);
   if(ordered&&!input.externalOrderAcknowledged)throw Error("Confirm that you will manage any catering cancellation with the vendor.");
   details={kind:input.kind,targetId:input.id,ownerId:booking.representativeId,office:booking.account.name,recipientEmail:input.recipientEmail.trim(),reason,rep:booking.representative.name,repEmail:booking.representative.email,location:[booking.account.street,booking.account.city,booking.account.state,booking.account.zip].join(", "),notifyOffice:input.notifyOffice,startsAt:booking.slotStartsAt.toISOString(),endsAt:booking.slotEndsAt.toISOString(),timezone:booking.timezone};
   await tx.lunchBooking.update({where:{id:input.id},data:{status:"CANCELED"}});
   await tx.lunchReminder.updateMany({where:{bookingId:input.id,status:{in:["SCHEDULED","SENDING"]}},data:{status:"CANCELED"}});
   await tx.secureLinkToken.updateMany({where:{organizationId:actor.organizationId,revokedAt:null,OR:[{bookingId:input.id},...(booking.invitationId?[{invitationId:booking.invitationId}]:[])]},data:{revokedAt:new Date()}});
   if(booking.invitationId)await tx.lunchInvitation.update({where:{id:booking.invitationId},data:{status:"CANCELED"}});
   await tx.calendarEventMapping.deleteMany({where:{organizationId:actor.organizationId,provider:"internal",lunchBookingId:input.id}});
   await tx.officeSpendingEntry.deleteMany({where:{bookingId:input.id,organizationId:actor.organizationId,kind:"commitment"}});
   if(booking.order?.status==="NOT_STARTED")await tx.cateringOrder.update({where:{id:booking.order.id},data:{status:"CANCELED"}});
  }
  const notice=cancellationMessage(details,new Date());
  const audit=await tx.auditLog.create({data:{id:auditId,organizationId:actor.organizationId,actorId:actor.id,action:"lunch.canceled",entityType:input.kind==="booking"?"LunchBooking":"LunchInvitation",entityId:input.id,metadata:JSON.parse(JSON.stringify(details))}});
  if(details.notifyOffice)await tx.notificationDelivery.create({data:{organizationId:actor.organizationId,channel:"email",toAddress:details.recipientEmail,subject:notice.subject,htmlBody:"",textBody:"",status:"failed",error:"Cancellation notice awaiting delivery",idempotencyKey:auditId}});
  return audit;
 });
}
export async function dispatchCancellation(db:Db,actor:Actor,id:string,send:(email:OutboundEmail)=>Promise<{status:string}>){
 const audit=await db.auditLog.findFirst({where:{id,organizationId:actor.organizationId,action:"lunch.canceled"}});
 if(!audit)throw Error("Cancellation was not found.");
 const details=audit.metadata as unknown as CancellationDetails;
 if(!canEditTeamRecords(actor.roleKey)&&details.ownerId!==actor.id)throw Error("This cancellation is not available to you.");
 if(!details.notifyOffice)return {status:"not_requested"};
 const existing=await db.notificationDelivery.findUnique({where:{idempotencyKey:audit.id}});
 if(existing?.status==="sent")return {status:"sent"};
 const message=cancellationMessage(details,audit.createdAt);
 return send({organizationId:actor.organizationId,to:details.recipientEmail,...message,replyTo:details.repEmail,idempotencyKey:audit.id});
}
