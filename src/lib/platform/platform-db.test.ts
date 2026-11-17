import {beforeAll,afterAll,describe,it,expect,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {prisma} from "../db";
import {changePlatformRecord} from "./service";
import {workspaceAccess} from "../workspace-access";
describe.skipIf(process.env.ROUTE_DB_INTEGRATION!=="true")("platform administration in disposable PostgreSQL",()=>{
 let org:string,ownerOrg:string,owner:string,user:string,member:string,repRole:string;
 const actor=()=>({id:owner,organizationId:ownerOrg,roleKey:"PLATFORM_ADMIN"});
 const reason="Investigating a verified support request";
 beforeAll(async()=>{
  const roles=await Promise.all(["ORG_ADMIN","REP","PLATFORM_ADMIN"].map(key=>prisma.role.upsert({where:{key},create:{key,name:key,description:"test",scope:key==="PLATFORM_ADMIN"?"platform":"organization"},update:{}})));repRole=roles[1].id;
  const a=await prisma.organization.create({data:{name:"Platform test",slug:"platform-test-"+crypto.randomUUID(),subscription:{create:{plan:"business",status:"trialing",trialStartedAt:new Date(),trialEndsAt:new Date(Date.now()+86400000)}}}});org=a.id;
  const b=await prisma.organization.create({data:{name:"Owner",slug:"platform-owner-"+crypto.randomUUID()}});ownerOrg=b.id;
  const u=await prisma.user.create({data:{name:"Owner",email:crypto.randomUUID()+"@example.invalid",passwordHash:"test-only",memberships:{create:{organizationId:ownerOrg,roleId:roles[2].id}}}});owner=u.id;
  const v=await prisma.user.create({data:{name:"Customer",email:crypto.randomUUID()+"@example.invalid",passwordHash:"test-only",memberships:{create:{organizationId:org,roleId:roles[0].id}}},include:{memberships:true}});user=v.id;member=v.memberships[0].id;
 });
 afterAll(async()=>{if(org)await prisma.organization.delete({where:{id:org}});if(ownerOrg)await prisma.organization.delete({where:{id:ownerOrg}});if(owner)await prisma.user.delete({where:{id:owner}});if(user)await prisma.user.delete({where:{id:user}});await prisma.$disconnect();});
 it("denies a customer actor and requires a useful reason",async()=>{
  await expect(changePlatformRecord(prisma,{...actor(),roleKey:"ORG_ADMIN"},{kind:"workspace",id:org,value:"pause",reason})).rejects.toThrow("Platform");
  await expect(changePlatformRecord(prisma,actor(),{kind:"workspace",id:org,value:"pause",reason:"x"})).rejects.toThrow("reason");
 });
 it("pauses and resumes private/public workspace access without deleting records or changing billing",async()=>{
  expect(await workspaceAccess(prisma,org,true)).toBe(true);
  await changePlatformRecord(prisma,actor(),{kind:"workspace",id:org,value:"pause",reason});
  expect(await workspaceAccess(prisma,org,true)).toBe(false);
  expect((await prisma.subscription.findUniqueOrThrow({where:{organizationId:org}})).status).toBe("trialing");
  await changePlatformRecord(prisma,actor(),{kind:"workspace",id:org,value:"resume",reason});
  expect(await workspaceAccess(prisma,org,true)).toBe(true);
 });
 it("protects the owner and the last organization administrator",async()=>{
  await expect(changePlatformRecord(prisma,actor(),{kind:"workspace",id:ownerOrg,value:"pause",reason})).rejects.toThrow("administrator");
  await expect(changePlatformRecord(prisma,actor(),{kind:"user",id:owner,value:"disable",reason})).rejects.toThrow("protected");
  await expect(changePlatformRecord(prisma,actor(),{kind:"role",id:member,value:"REP",reason})).rejects.toThrow("at least one");
  await expect(changePlatformRecord(prisma,actor(),{kind:"role",id:member,value:"PLATFORM_ADMIN",reason})).rejects.toThrow("organization role");
 });
 it("persists user access changes and records actor and reason",async()=>{
  await changePlatformRecord(prisma,actor(),{kind:"user",id:user,value:"disable",reason});
  expect((await prisma.user.findUniqueOrThrow({where:{id:user}})).disabledAt).not.toBeNull();
  await changePlatformRecord(prisma,actor(),{kind:"user",id:user,value:"enable",reason});
  expect((await prisma.user.findUniqueOrThrow({where:{id:user}})).disabledAt).toBeNull();
  const log=await prisma.auditLog.findFirstOrThrow({where:{actorId:owner,action:"platform.user.disabled"}});
  expect((log.metadata as {reason:string}).reason).toBe(reason);
 });
});
