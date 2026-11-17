import "dotenv/config";
import {prisma} from "../src/lib/db";
async function main(){
 const email=process.env.CONFIRMED_PLATFORM_OWNER_EMAIL?.trim().toLowerCase();
 if(!email||!process.argv.includes("--confirm-owner"))throw Error("Set CONFIRMED_PLATFORM_OWNER_EMAIL to the verified owner's existing account email and pass --confirm-owner. Never guess an owner identity.");
 const user=await prisma.user.findUniqueOrThrow({where:{email}});
 if(user.disabledAt)throw Error("Owner account is disabled. Investigate before provisioning.");
 await prisma.$transaction(async tx=>{
  const role=await tx.role.upsert({where:{key:"PLATFORM_ADMIN"},create:{key:"PLATFORM_ADMIN",name:"Platform administrator",description:"RepPilot owner operations",scope:"platform"},update:{}});
  const org=await tx.organization.upsert({where:{slug:"reppilot-owner-console"},create:{slug:"reppilot-owner-console",name:"RepPilot Owner Console"},update:{}});
  await tx.organizationMembership.upsert({where:{organizationId_userId:{organizationId:org.id,userId:user.id}},create:{organizationId:org.id,userId:user.id,roleId:role.id},update:{roleId:role.id}});
  await tx.auditLog.create({data:{organizationId:org.id,actorId:user.id,action:"platform.owner.provisioned",entityType:"User",entityId:user.id,metadata:{reason:"Verified owner identity explicitly selected by operator. Existing password retained."}}});
 });
 console.log("Owner access provisioned. Sign out and sign in with the existing password. No password was changed.");
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>prisma.$disconnect());
