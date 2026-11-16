import { prisma } from "../db";
import { deliverEmail } from "./send";
import { lunchCalendar, lunchConfirmationMessage } from "./lunch-calendar";

export async function sendLunchConfirmation(bookingId:string,stage:'approved'|'confirmed') {
 try {
  const booking=await prisma.lunchBooking.findUnique({where:{id:bookingId},include:{account:true,representative:true,organization:true,invitation:true}});
  if(!booking || !['SCHEDULED','CONFIRMED'].includes(booking.status))return {status:'not_ready'};
  const recipient=booking.invitation?.recipientEmail?.trim() || booking.account.email?.trim();
  if(!recipient)return {status:'missing_recipient'};
  const details={id:booking.id,office:booking.account.name,location:`${booking.account.street}, ${booking.account.city}, ${booking.account.state} ${booking.account.zip}`,rep:booking.representative.name,repEmail:booking.representative.email,organization:booking.organization.name,purpose:booking.purpose,attendees:booking.confirmedAttendees??booking.expectedAttendees,startsAt:booking.slotStartsAt,endsAt:booking.slotEndsAt,createdAt:booking.createdAt,timezone:booking.timezone,confirmed:stage==='confirmed'};
  const message=lunchConfirmationMessage(details);
  return await deliverEmail({organizationId:booking.organizationId,to:recipient,...message,idempotencyKey:`lunch-confirmation:${booking.id}:${stage}:${booking.slotStartsAt.toISOString()}`,replyTo:booking.representative.email,attachments:[{filename:'RepPilot-Lunch-and-Learn.ics',content:Buffer.from(lunchCalendar(details)).toString('base64'),content_type:'text/calendar; charset=utf-8; method=PUBLISH'}]});
 }catch{return {status:'failed'};}
}
