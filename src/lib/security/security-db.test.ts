import {beforeAll,afterAll,describe,it,expect,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {prisma} from "../db";
import {decryptString} from "../domain/crypto";
import {beginEnrollment,finishEnrollment,consumeMfa} from "./mfa-service";
import {issuePasswordReset,applyPasswordReset,resetHash} from "./password-service";
import {totp} from "./totp";
import {compare} from "bcryptjs";
describe.skipIf(process.env.ROUTE_DB_INTEGRATION!=="true")("owner security in disposable PostgreSQL",()=>{
 let id:string;const now=new Date("2026-11-17T12:00:00Z"),password="New test password 123!";
 beforeAll(async()=>{id=(await prisma.user.create({data:{name:"Security fixture",email:crypto.randomUUID()+"@example.invalid",passwordHash:"old"}})).id;});
 afterAll(async()=>{if(id)await prisma.user.delete({where:{id}});await prisma.$disconnect();});
 it("expires enrollment, encrypts secrets and atomically consumes MFA codes",async()=>{
  await beginEnrollment(prisma,id,new Date(+now-600001));
  await expect(finishEnrollment(prisma,id,"000000",now)).rejects.toThrow("expired");
  const secret=await beginEnrollment(prisma,id,now);
  const setup=await finishEnrollment(prisma,id,totp(secret,Math.floor(+now/30000)),now);
  const stored=await prisma.userMfa.findUniqueOrThrow({where:{userId:id}});
  expect(stored.secretCiphertext).not.toBe(secret);expect(decryptString(stored.secretCiphertext!)).toBe(secret);
  expect(JSON.stringify(stored.recoveryHashes)).not.toContain(setup.codes[0]);
  expect(await consumeMfa(prisma,id,totp(secret,Math.floor(+now/30000)),now)).toBe(false);
  const result=await Promise.all([consumeMfa(prisma,id,setup.codes[0],now),consumeMfa(prisma,id,setup.codes[0],now)]);
  expect(result.sort()).toEqual([false,true]);
  await beginEnrollment(prisma,id,now);
  expect((await prisma.userMfa.findUniqueOrThrow({where:{userId:id}})).secretCiphertext).toBe(stored.secretCiphertext);
 });
 it("stores reset hashes, invalidates older links, consumes once and preserves MFA",async()=>{
  const old=await issuePasswordReset(prisma,id,now),fresh=await issuePasswordReset(prisma,id,now);
  expect(await applyPasswordReset(prisma,old.token,password,now)).toBe(false);
  const row=await prisma.passwordResetToken.findUniqueOrThrow({where:{id:fresh.id}});
  expect(row.tokenHash).toBe(resetHash(fresh.token));expect(row.tokenHash).not.toBe(fresh.token);
  const version=(await prisma.user.findUniqueOrThrow({where:{id}})).sessionVersion;
  const results=await Promise.all([applyPasswordReset(prisma,fresh.token,password,now),applyPasswordReset(prisma,fresh.token,password,now)]);
  expect(results.sort()).toEqual([false,true]);
  const user=await prisma.user.findUniqueOrThrow({where:{id}});expect(user.sessionVersion).toBe(version+1);expect(await compare(password,user.passwordHash)).toBe(true);
  expect((await prisma.userMfa.findUniqueOrThrow({where:{userId:id}})).enabledAt).not.toBeNull();
  const expired=await issuePasswordReset(prisma,id,new Date(+now-1800001));expect(await applyPasswordReset(prisma,expired.token,password,now)).toBe(false);
 });
});
