import type {Db} from "../db";
import {decryptString,encryptString} from "../domain/crypto";
import {newAuthenticatorSecret,newRecoveryCodes,recoveryHash,verifiedStep} from "./totp";
export async function beginEnrollment(db:Db,userId:string,now=new Date()){
 const secret=newAuthenticatorSecret();
 await db.userMfa.upsert({where:{userId},create:{userId,pendingSecretCiphertext:encryptString(secret),pendingExpiresAt:new Date(+now+10*60000)},update:{pendingSecretCiphertext:encryptString(secret),pendingExpiresAt:new Date(+now+10*60000)}});
 return secret;
}
export async function finishEnrollment(db:Db,userId:string,code:string,now=new Date()){
 return db.$transaction(async tx=>{
  await tx.$executeRaw`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`;
  const record=await tx.userMfa.findUnique({where:{userId}});
  if(!record?.pendingSecretCiphertext||!record.pendingExpiresAt||record.pendingExpiresAt<=now)throw Error("Setup expired. Start authenticator setup again.");
  const step=verifiedStep(decryptString(record.pendingSecretCiphertext),code,+now);
  if(step===null)throw Error("The authenticator code did not match.");
  const codes=newRecoveryCodes();
  await tx.userMfa.update({where:{userId},data:{secretCiphertext:record.pendingSecretCiphertext,pendingSecretCiphertext:null,pendingExpiresAt:null,enabledAt:now,lastUsedStep:step,recoveryHashes:codes.map(c=>recoveryHash(userId,c))}});
  const user=await tx.user.update({where:{id:userId},data:{sessionVersion:{increment:1}},select:{sessionVersion:true}});
  return {codes,sessionVersion:user.sessionVersion};
 });
}
export async function consumeMfa(db:Db,userId:string,code:string,now=new Date()){
 if(code.length>100)return false;
 return db.$transaction(async tx=>{
  await tx.$executeRaw`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`;
  const record=await tx.userMfa.findUnique({where:{userId}});if(!record?.enabledAt||!record.secretCiphertext)return false;
  const step=verifiedStep(decryptString(record.secretCiphertext),code.trim(),+now,record.lastUsedStep);
  if(step!==null){await tx.userMfa.update({where:{userId},data:{lastUsedStep:step}});return true;}
  const hashes=Array.isArray(record.recoveryHashes)?record.recoveryHashes.filter((v):v is string=>typeof v==="string"):[];
  const candidate=recoveryHash(userId,code);if(!hashes.includes(candidate))return false;
  await tx.userMfa.update({where:{userId},data:{recoveryHashes:hashes.filter(h=>h!==candidate)}});return true;
 });
}
