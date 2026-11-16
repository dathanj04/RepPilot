import {writeFile} from "node:fs/promises";
import {sealData} from "iron-session";
import {prisma} from "../src/lib/db";
import {credentialVersion,sessionOptions} from "../src/lib/session-options";
async function main(){
 if(process.env.CI!=="true"||!process.env.DATABASE_URL?.includes("@localhost:5432/route_test"))throw Error("This seed only runs in the disposable route-test database.");
 const role=await prisma.role.upsert({where:{key:"ORG_ADMIN"},create:{key:"ORG_ADMIN",name:"Administrator",description:"Test role",scope:"organization"},update:{}});
 const org=await prisma.organization.create({data:{name:"Browser acceptance",slug:"browser-"+crypto.randomUUID(),subscription:{create:{plan:"business",status:"trialing",trialStartedAt:new Date(),trialEndsAt:new Date(Date.now()+86400000*14)}}}});
 const user=await prisma.user.create({data:{name:"Browser tester",email:crypto.randomUUID()+"@example.invalid",passwordHash:"browser-test-only",memberships:{create:{organizationId:org.id,roleId:role.id}}}});
 await prisma.account.createMany({data:Array.from({length:16},(_,i)=>({organizationId:org.id,name:"Office "+String(i+1).padStart(2,"0"),specialty:"Pediatrics",street:(i+1)+" Main St",city:"Plano",state:"TX",zip:"75024",latitude:33+i/100,longitude:-96}))});
 const account=await prisma.account.findFirstOrThrow({where:{organizationId:org.id,name:"Office 01"}});
 const lunch=await prisma.lunchBooking.create({data:{organizationId:org.id,accountId:account.id,representativeId:user.id,slotStartsAt:new Date(Date.now()+86400000),slotEndsAt:new Date(Date.now()+90000000),status:"AWAITING_APPROVAL",purpose:"Browser cancellation",expectedAttendees:8,timezone:"America/Chicago"}});
 const personalOrg=await prisma.organization.create({data:{name:"Individual browser test",slug:"individual-browser-"+crypto.randomUUID(),subscription:{create:{plan:"individual",status:"active",stripeCustomerId:"cus_browser_individual",trialStartedAt:new Date(Date.now()-30*86400000),trialEndsAt:new Date(Date.now()-16*86400000)}}}});
 const personal=await prisma.user.create({data:{name:"Individual tester",email:crypto.randomUUID()+"@example.invalid",passwordHash:"browser-test-only",memberships:{create:{organizationId:personalOrg.id,roleId:role.id}}}});
 const options=sessionOptions(),cookie=await sealData({userId:user.id,organizationId:org.id,roleKey:"ORG_ADMIN",credentialVersion:credentialVersion(user.passwordHash)},{password:options.password,ttl:options.ttl});
 await writeFile("/tmp/route-browser-session.json",JSON.stringify({cookie,name:options.cookieName,lunchId:lunch.id,individualOrganizationId:personalOrg.id,individualCookie:await sealData({userId:personal.id,organizationId:personalOrg.id,roleKey:"ORG_ADMIN",credentialVersion:credentialVersion(personal.passwordHash)},{password:options.password,ttl:options.ttl})}));
 await prisma.$disconnect();
}
main().catch(e=>{console.error(e);process.exit(1);});
