"use server";
import {getCurrentUser} from "./auth";
import {prisma} from "./db";
import {revalidatePath} from "next/cache";
import {consumeSharedRateLimit} from "./domain/rate-limit-store";
import {deliverEmail} from "./email/send";
import {cancellationId,cancelPendingLunch,dispatchCancellation} from "./services/lunch-cancellation";
export type CancellationState={error?:string;message?:string;cancelled?:boolean;deliveryStatus?:string};
export async function cancelLunchAction(_previous:CancellationState,form:FormData):Promise<CancellationState>{
 const user=await getCurrentUser();
 const kind=form.get("kind");const id=String(form.get("id")||"");
 if((kind!=="booking"&&kind!=="invitation")||!id||id.length>100)return {error:"Choose a valid lunch or invitation."};
 try{
  if(!(await consumeSharedRateLimit(prisma,"cancel-lunch:"+user.id,10,60000)).ok)return {error:"Please wait a minute before trying again."};
  if(form.get("operation")!=="retry")await cancelPendingLunch(prisma,user,{kind,id,reason:String(form.get("reason")||""),recipientEmail:String(form.get("recipientEmail")||""),notifyOffice:form.get("notifyOffice")==="yes",externalOrderAcknowledged:form.get("externalOrderAcknowledged")==="yes"});
  let status="failed";
  status=(await dispatchCancellation(prisma,user,cancellationId(kind,id),async email=>{try{const d=await deliverEmail(email);return {status:d.status};}catch{return {status:"failed"};}})).status;
  for(const path of ["/lunches","/calendar","/today","/accounts","/notifications"])revalidatePath(path);
  revalidatePath("/lunches/"+id);
  return {cancelled:true,deliveryStatus:status,message:status==="sent"?"Canceled. The cancellation email was sent to the office.":status==="not_requested"?"Canceled without sending an email.":"Canceled, but the office email has not been confirmed sent. Retry the notice below."};
 }catch(e){return {error:e instanceof Error?e.message:"The lunch could not be canceled."};}
}
