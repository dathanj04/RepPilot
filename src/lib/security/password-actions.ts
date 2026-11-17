"use server";
import {headers} from "next/headers";
import {createHash} from "node:crypto";
import {prisma} from "../db";
import {consumeSharedRateLimit} from "../domain/rate-limit-store";
import {deliverEmail} from "../email/send";
import {appUrl} from "../permissions";
import {escapeHtml} from "../email/templates";
import {issuePasswordReset,applyPasswordReset} from "./password-service";
export type PasswordState={error?:string;message?:string;complete?:boolean};
const notice="If that email has an account, a password-reset link will be sent. Check your inbox and spam folder.";
async function allowed(emailOrToken:string){const h=await headers(),ip=h.get("x-forwarded-for")?.split(",")[0]?.trim()??"unknown";const fingerprint=createHash("sha256").update(emailOrToken).digest("hex");const [a,b]=await Promise.all([consumeSharedRateLimit(prisma,"password-recovery:"+fingerprint,3,15*60000),consumeSharedRateLimit(prisma,"password-recovery-ip:"+ip,15,15*60000)]);return a.ok&&b.ok;}
export async function requestPasswordResetAction(_state:PasswordState,form:FormData):Promise<PasswordState>{
 const email=String(form.get("email")||"").trim().toLowerCase();
 if(email.length>254||!/^\S+@\S+\.\S+$/.test(email))return {error:"Enter a valid account email."};
 try{
  if(!await allowed(email))return {message:notice};
  const user=await prisma.user.findUnique({where:{email},select:{id:true,email:true,disabledAt:true,memberships:{select:{organizationId:true},take:1}}});
  if(user&&!user.disabledAt&&user.memberships[0]){
   const reset=await issuePasswordReset(prisma,user.id),url=appUrl()+"/password-reset/confirm?token="+encodeURIComponent(reset.token);
   const text="You requested a RepPilot password reset. Open this link within 30 minutes: "+url+"\nIf you did not request it, ignore this email. Your password and MFA are unchanged until you complete the reset.";
   await deliverEmail({organizationId:user.memberships[0].organizationId,to:user.email,subject:"Reset your RepPilot password",text,html:'<p>You requested a RepPilot password reset.</p><p><a href="'+escapeHtml(url)+'">Reset your password</a></p><p>This link expires in 30 minutes and works once. If you did not request it, ignore this email. MFA remains enabled.</p>',idempotencyKey:"password-reset-"+reset.id});
  }
 }catch{/* Do not reveal whether an account or provider failed. Delivery failures remain in operations. */}
 return {message:notice};
}
export async function confirmPasswordResetAction(_state:PasswordState,form:FormData):Promise<PasswordState>{
 const token=String(form.get("token")||""),password=String(form.get("password")||"");
 if(password.length<12||password.length>128)return {error:"Choose a password between 12 and 128 characters."};
 if(password!==String(form.get("confirmPassword")||""))return {error:"The passwords do not match."};
 try{if(!await allowed(token))return {error:"Too many attempts. Wait 15 minutes before trying again."};if(!await applyPasswordReset(prisma,token,password))return {error:"This link is invalid, expired, or already used. Request a new password-reset email."};return {complete:true,message:"Password updated. Existing sign-ins have been revoked. Sign in with your new password; owner MFA is still required."};}catch{return {error:"The password could not be reset. Please try again."};}
}
