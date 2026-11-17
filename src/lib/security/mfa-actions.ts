"use server";
import {compare} from "bcryptjs";
import {prisma} from "../db";
import {requireOwnerIdentity} from "../auth";
import {getSession} from "../session";
import {consumeSharedRateLimit} from "../domain/rate-limit-store";
import {beginEnrollment,finishEnrollment,consumeMfa} from "./mfa-service";
import {mfaSessionFresh} from "./totp";
export type MfaState={error?:string;message?:string;secret?:string;codes?:string[];verified?:boolean};
export async function ownerMfaAction(_state:MfaState,form:FormData):Promise<MfaState>{
 const user=await requireOwnerIdentity();
 try{
  if(!(await consumeSharedRateLimit(prisma,"owner-mfa:"+user.id,8,15*60000)).ok)throw Error("Too many attempts. Wait 15 minutes before trying again.");
  const operation=String(form.get("operation"));
  const session=await getSession();
  if(operation==="begin"){
   const [record,mfa]=await Promise.all([prisma.user.findUniqueOrThrow({where:{id:user.id},select:{passwordHash:true}}),prisma.userMfa.findUnique({where:{userId:user.id}})]);
   if(!await compare(String(form.get("password")||""),record.passwordHash))throw Error("Your current password did not match.");
   if(mfa?.enabledAt&&!mfaSessionFresh(session.mfaVerifiedAt))throw Error("Verify your current authenticator or a recovery code before replacing it.");
   const secret=await beginEnrollment(prisma,user.id);
   return {secret,message:"Add this setup key to your authenticator, then enter its six-digit code. Setup expires in 10 minutes."};
  }
  const code=String(form.get("code")||"").trim();
  if(operation==="finish"){
   const result=await finishEnrollment(prisma,user.id,code);
   session.sessionVersion=result.sessionVersion;session.mfaVerifiedAt=Date.now();await session.save();
   await prisma.auditLog.create({data:{organizationId:user.organizationId,actorId:user.id,action:"platform.mfa.enabled",entityType:"User",entityId:user.id,metadata:{reason:"Owner confirmed authenticator enrollment. Other sessions revoked."}}});
   return {codes:result.codes,verified:true,message:"Authenticator enabled. Save your recovery codes now; they are only displayed once."};
  }
  if(operation!=="verify")throw Error("Choose a valid security action.");
  if(!await consumeMfa(prisma,user.id,code))throw Error("The code is invalid, expired, or already used. Enter a new authenticator code or an unused recovery code.");
  session.mfaVerifiedAt=Date.now();await session.save();
  await prisma.auditLog.create({data:{organizationId:user.organizationId,actorId:user.id,action:"platform.mfa.verified",entityType:"User",entityId:user.id}});
  return {verified:true,message:"Identity verified for the next 30 minutes."};
 }catch(e){return {error:e instanceof Error?e.message:"Security verification failed."};}
}
