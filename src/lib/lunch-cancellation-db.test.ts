import {beforeAll,afterAll,describe,it,expect,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {prisma} from "./db";
import {cancelPendingLunch,dispatchCancellation,cancellationId} from "./services/lunch-cancellation";
import {approveLunchBooking} from "./services/lunches";
describe.skipIf(process.env.ROUTE_DB_INTEGRATION!=="true")("lunch cancellation in isolated PostgreSQL",()=>{
 let org:string,otherOrg:string,user:string,otherUser:string,account:string,booking:string,invitation:string,n=0;
 const actor=()=>({id:user,organizationId:org,roleKey:"REP"});
 const input=(id:string,kind:"booking"|"invitation"="booking")=>({id,kind,reason:"Our presenter needs to reschedule.",recipientEmail:"office@example.invalid",notifyOffice:true,externalOrderAcknowledged:false});
 const createBooking=async(status="AWAITING_APPROVAL")=>{
  n++;const start=new Date(Date.now()+n*86400000);
  return prisma.lunchBooking.create({data:{organizationId:org,accountId:account,representativeId:user,slotStartsAt:start,slotEndsAt:new Date(+start+3600000),status,purpose:"Educational update",expectedAttendees:8,timezone:"America/Chicago"}});
 };
 beforeAll(async()=>{
  const a=await prisma.organization.create({data:{name:"Cancellation test",slug:"cancellation-"+crypto.randomUUID()}});
  const b=await prisma.organization.create({data:{name:"Other test",slug:"cancellation-"+crypto.randomUUID()}});
  org=a.id;otherOrg=b.id;
  const u=await prisma.user.create({data:{name:"Owner",email:crypto.randomUUID()+"@example.invalid",passwordHash:"test-only"}});
  const v=await prisma.user.create({data:{name:"Other",email:crypto.randomUUID()+"@example.invalid",passwordHash:"test-only"}});
  user=u.id;otherUser=v.id;
  const office=await prisma.account.create({data:{organizationId:org,name:"Test office",specialty:"Pediatrics",street:"1 Main",city:"Plano",state:"TX",zip:"75024",email:"office@example.invalid"}});account=office.id;
  await prisma.subscription.create({data:{organizationId:org,plan:"business",status:"trialing",trialStartedAt:new Date(),trialEndsAt:new Date(Date.now()+14*86400000)}});
  const i=await prisma.lunchInvitation.create({data:{organizationId:org,accountId:account,createdById:user,purpose:"Educational update",status:"ACTIVE",recipientEmail:"office@example.invalid",expiresAt:new Date(Date.now()+86400000),slots:{create:{startsAt:new Date(Date.now()+86400000),endsAt:new Date(Date.now()+90000000),status:"offered"}}}});
  invitation=i.id;
  await prisma.secureLinkToken.create({data:{organizationId:org,invitationId:invitation,purpose:"invitation",tokenHash:crypto.randomUUID(),tokenCiphertext:"test-only",expiresAt:new Date(Date.now()+86400000)}});
  const booked=await createBooking();booking=booked.id;
  await prisma.lunchReminder.create({data:{organizationId:org,bookingId:booking,kind:"SEVEN_DAY",scheduledFor:new Date(),status:"SCHEDULED",idempotencyKey:crypto.randomUUID()}});
  await prisma.secureLinkToken.create({data:{organizationId:org,bookingId:booking,purpose:"lunch_confirmation",tokenHash:crypto.randomUUID(),tokenCiphertext:"test-only",expiresAt:new Date(Date.now()+86400000)}});
  await prisma.calendarEventMapping.create({data:{organizationId:org,userId:user,provider:"internal",syncState:"internal",externalEventId:crypto.randomUUID(),lunchBookingId:booking,title:"Lunch",startsAt:booked.slotStartsAt,endsAt:booked.slotEndsAt}});
  await prisma.officeSpendingEntry.createMany({data:["commitment","recorded"].map(kind=>({organizationId:org,accountId:account,bookingId:booking,kind,amountCents:10000,occurredOn:new Date(),policyStatus:"pending"}))});
 });
 afterAll(async()=>{if(org)await prisma.organization.delete({where:{id:org}});if(otherOrg)await prisma.organization.delete({where:{id:otherOrg}});if(user)await prisma.user.delete({where:{id:user}});if(otherUser)await prisma.user.delete({where:{id:otherUser}});await prisma.$disconnect();});
 it("rejects another tenant or another rep before changing a lunch",async()=>{
  await expect(cancelPendingLunch(prisma,{...actor(),organizationId:otherOrg},input(booking))).rejects.toThrow("not available");
  await expect(cancelPendingLunch(prisma,{...actor(),id:otherUser},input(booking))).rejects.toThrow("not available");
  expect((await prisma.lunchBooking.findUniqueOrThrow({where:{id:booking}})).status).toBe("AWAITING_APPROVAL");
 });
 it("cancels pending invitations exactly once and revokes all booking links",async()=>{
  await Promise.all([cancelPendingLunch(prisma,actor(),input(invitation,"invitation")),cancelPendingLunch(prisma,actor(),input(invitation,"invitation"))]);
  expect((await prisma.lunchInvitation.findUniqueOrThrow({where:{id:invitation}})).status).toBe("CANCELED");
  expect(await prisma.secureLinkToken.count({where:{invitationId:invitation,revokedAt:null}})).toBe(0);
  expect(await prisma.auditLog.count({where:{id:cancellationId("invitation",invitation)}})).toBe(1);
  expect(await prisma.notificationDelivery.count({where:{idempotencyKey:cancellationId("invitation",invitation)}})).toBe(1);
 });
 it("removes a pending lunch from scheduling while preserving actual spending and a reason",async()=>{
  const record=await cancelPendingLunch(prisma,actor(),input(booking));
  expect((record.metadata as {reason:string}).reason).toContain("reschedule");
  expect((await prisma.lunchBooking.findUniqueOrThrow({where:{id:booking}})).status).toBe("CANCELED");
  expect(await prisma.lunchReminder.count({where:{bookingId:booking,status:"SCHEDULED"}})).toBe(0);
  expect(await prisma.secureLinkToken.count({where:{bookingId:booking,revokedAt:null}})).toBe(0);
  expect(await prisma.calendarEventMapping.count({where:{lunchBookingId:booking,provider:"internal"}})).toBe(0);
  expect(await prisma.officeSpendingEntry.count({where:{bookingId:booking,kind:"commitment"}})).toBe(0);
  expect(await prisma.officeSpendingEntry.count({where:{bookingId:booking,kind:"recorded"}})).toBe(1);
 });
 it("reports failed email delivery and retries without canceling or sending twice",async()=>{
  const id=cancellationId("booking",booking);
  const fail=vi.fn(async()=>({status:"failed"}));expect(await dispatchCancellation(prisma,actor(),id,fail)).toEqual({status:"failed"});
  const sent=vi.fn(async()=>{await prisma.notificationDelivery.update({where:{idempotencyKey:id},data:{status:"sent"}});return {status:"sent"};});
  await dispatchCancellation(prisma,actor(),id,sent);await dispatchCancellation(prisma,actor(),id,sent);
  expect(sent).toHaveBeenCalledTimes(1);expect(await prisma.auditLog.count({where:{id}})).toBe(1);
 });
 it("never deletes completed lunches and requires acknowledgment of external catering",async()=>{
  const done=await createBooking("COMPLETED");await expect(cancelPendingLunch(prisma,actor(),input(done.id))).rejects.toThrow("Completed");
  const ordered=await createBooking();await prisma.cateringOrder.create({data:{organizationId:org,accountId:account,bookingId:ordered.id,status:"ORDER_RECORDED"}});
  await expect(cancelPendingLunch(prisma,actor(),input(ordered.id))).rejects.toThrow("vendor");
  await cancelPendingLunch(prisma,actor(),{...input(ordered.id),externalOrderAcknowledged:true});
  expect((await prisma.cateringOrder.findUniqueOrThrow({where:{bookingId:ordered.id}})).status).toBe("ORDER_RECORDED");
 });
 it("does not resurrect a canceled lunch when approval races cancellation",async()=>{
  const pending=await createBooking();
  await Promise.all([approveLunchBooking(prisma,{organizationId:org,userId:user,bookingId:pending.id,now:new Date()}),cancelPendingLunch(prisma,actor(),input(pending.id))]);
  expect((await prisma.lunchBooking.findUniqueOrThrow({where:{id:pending.id}})).status).toBe("CANCELED");
  expect(await prisma.lunchReminder.count({where:{bookingId:pending.id,status:"SCHEDULED"}})).toBe(0);
 });
});
