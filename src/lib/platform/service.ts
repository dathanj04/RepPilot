import type {Db} from "../db";
export type PlatformActor={id:string;organizationId:string;roleKey:string};
export type PlatformChange={kind:"workspace"|"user"|"role";id:string;value:string;reason:string};
export async function changePlatformRecord(db:Db,actor:PlatformActor,input:PlatformChange){
 if(actor.roleKey!=="PLATFORM_ADMIN")throw Error("Platform administrator access is required.");
 const reason=input.reason.trim();if(reason.length<10||reason.length>1000)throw Error("Give a reason between 10 and 1,000 characters.");
 if(!input.id||input.id.length>100)throw Error("Choose a valid record.");
 return db.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('reppilot-platform-administration'))`;
  let organizationId=actor.organizationId,oldValue:string,newValue:string;
  if(input.kind==="workspace"){
   if(!["pause","resume"].includes(input.value))throw Error("Choose pause or resume.");
   const org=await tx.organization.findUniqueOrThrow({where:{id:input.id},include:{memberships:{include:{role:true}}}});
   if(org.memberships.some(m=>m.role.key==="PLATFORM_ADMIN"))throw Error("A platform administrator workspace cannot be paused.");
   organizationId=org.id;oldValue=org.suspendedAt?"paused":"active";newValue=input.value==="pause"?"paused":"active";
   await tx.organization.update({where:{id:org.id},data:{suspendedAt:newValue==="paused"?new Date():null}});
  }else if(input.kind==="user"){
   if(!["disable","enable"].includes(input.value))throw Error("Choose disable or enable.");
   const user=await tx.user.findUniqueOrThrow({where:{id:input.id},include:{memberships:{include:{role:true}}}});
   if(user.id===actor.id||user.memberships.some(m=>m.role.key==="PLATFORM_ADMIN"))throw Error("Platform administrator sign-ins are protected.");
   organizationId=user.memberships[0]?.organizationId??actor.organizationId;
   oldValue=user.disabledAt?"disabled":"enabled";newValue=input.value==="disable"?"disabled":"enabled";
   await tx.user.update({where:{id:user.id},data:{disabledAt:newValue==="disabled"?new Date():null,...(newValue==="disabled"?{sessionVersion:{increment:1}}:{})}});
  }else if(input.kind==="role"){
   if(!["REP","MANAGER","COMPLIANCE_ADMIN","ORG_ADMIN"].includes(input.value))throw Error("Choose an organization role.");
   const member=await tx.organizationMembership.findUniqueOrThrow({where:{id:input.id},include:{role:true,user:{include:{memberships:{include:{role:true}}}}}});
   if(member.user.memberships.some(m=>m.role.key==="PLATFORM_ADMIN"))throw Error("Platform administrator roles are protected.");
   if(member.role.key==="ORG_ADMIN"&&input.value!=="ORG_ADMIN"&&await tx.organizationMembership.count({where:{organizationId:member.organizationId,role:{key:"ORG_ADMIN"}}})<=1)throw Error("Keep at least one organization administrator.");
   const role=await tx.role.findUniqueOrThrow({where:{key:input.value}});
   organizationId=member.organizationId;oldValue=member.role.key;newValue=role.key;
   await tx.organizationMembership.update({where:{id:member.id},data:{roleId:role.id}});
  }else throw Error("Unknown operation.");
  return tx.auditLog.create({data:{organizationId,actorId:actor.id,action:"platform."+input.kind+"."+newValue,entityType:input.kind,entityId:input.id,metadata:{reason,oldValue,newValue}}});
 });
}
