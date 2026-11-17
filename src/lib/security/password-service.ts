import {createHash,randomBytes} from "node:crypto";
import {hash} from "bcryptjs";
import type {Db} from "../db";
export const resetHash=(token:string)=>createHash("sha256").update(token).digest("hex");
export async function issuePasswordReset(db:Db,userId:string,now=new Date()){
 const token=randomBytes(32).toString("base64url");
 const record=await db.$transaction(async tx=>{
  await tx.$executeRaw`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`;
  await tx.passwordResetToken.updateMany({where:{userId,usedAt:null},data:{usedAt:now}});
  return tx.passwordResetToken.create({data:{userId,tokenHash:resetHash(token),expiresAt:new Date(+now+30*60000)}});
 });
 return {token,id:record.id};
}
export async function applyPasswordReset(db:Db,token:string,password:string,now=new Date()){
 if(token.length<32||token.length>100||password.length<12||password.length>128)return false;
 const record=await db.passwordResetToken.findUnique({where:{tokenHash:resetHash(token)}});
 if(!record||record.usedAt||record.expiresAt<=now)return false;
 const passwordHash=await hash(password,12);
 return db.$transaction(async tx=>{
  await tx.$executeRaw`SELECT id FROM "User" WHERE id=${record.userId} FOR UPDATE`;
  const claimed=await tx.passwordResetToken.updateMany({where:{id:record.id,usedAt:null,expiresAt:{gt:now}},data:{usedAt:now}});
  if(claimed.count!==1)return false;
  await tx.user.update({where:{id:record.userId},data:{passwordHash,sessionVersion:{increment:1}}});
  await tx.passwordResetToken.updateMany({where:{userId:record.userId,usedAt:null},data:{usedAt:now}});
  return true;
 });
}
