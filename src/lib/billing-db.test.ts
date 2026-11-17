import {beforeAll,afterAll,describe,expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
vi.mock("next/headers",()=>({headers:async()=>new Headers({"user-agent":"RepPilot web billing test"})}));
vi.mock("next/navigation",()=>({redirect:(path:string)=>{throw Error("REDIRECT:"+path);}}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
const state=vi.hoisted(()=>({user:{id:"",organizationId:"",roleKey:"ORG_ADMIN",name:"Billing test",email:"billing@example.invalid",trialDaysLeft:1},customerCalls:0,checkoutCalls:0,subscriptionCalls:0,complete:false,created:false}));
vi.mock("./auth",()=>({getCurrentUser:async()=>state.user}));
vi.mock("./domain/rate-limit-store",()=>({consumeSharedRateLimit:async()=>({ok:true})}));
vi.mock("./stripe",async original=>({...await original<typeof import("./stripe")>(),
 customerSubscriptions:async()=>({data:state.created?[{id:"sub_once",status:"trialing"}]:[]}),
 stripeRequest:async(path:string,params?:URLSearchParams)=>{
  if(path==="customers"){state.customerCalls++;return {id:"cus_isolated"};}
  if(path==="checkout/sessions"){state.checkoutCalls++;return {id:"cs_isolated",mode:"setup",status:"open",url:"https://checkout.stripe.com/c/pay/isolated"};}
  if(path==="checkout/sessions/cs_isolated")return {id:"cs_isolated",mode:"setup",status:state.complete?"complete":"open",url:"https://checkout.stripe.com/c/pay/isolated",customer:"cus_isolated",client_reference_id:state.user.organizationId,livemode:true,setup_intent:"seti_verified",metadata:{organizationId:state.user.organizationId,planKey:"annual",billingFlow:"trial_card_v1",consent:"yes",catalogVersion:"20261116-v2"}};
  if(path==="setup_intents/seti_verified")return {customer:"cus_isolated",status:"succeeded",payment_method:"pm_verified",livemode:true};
  if(path==="subscriptions"){state.subscriptionCalls++;expect(params!.get("trial_end")).toBe(String(Math.ceil(end.getTime()/1000)));state.created=true;return {id:"sub_once"};}
  throw Error("Unexpected Stripe path "+path);
 }}));
import {prisma} from "./db";
import {startCheckoutAction} from "./billing-actions";
import {completeTrialCardSetup} from "./billing-flow";
let end:Date;
describe.skipIf(process.env.ROUTE_DB_INTEGRATION!=="true")("billing persistence and concurrency in isolated PostgreSQL",()=>{
 beforeAll(async()=>{
  vi.stubEnv("STRIPE_WEBHOOK_SECRET","whsec_isolated");
  const org=await prisma.organization.create({data:{name:"Billing isolation",slug:"billing-"+crypto.randomUUID()}});
  const user=await prisma.user.create({data:{name:"Billing tester",email:crypto.randomUUID()+"@example.invalid",passwordHash:"test-only"}});
  state.user.id=user.id;state.user.organizationId=org.id;
  end=new Date(Date.now()+3600000);
  await prisma.subscription.create({data:{organizationId:org.id,plan:"basic",status:"trialing",trialStartedAt:new Date(+end-14*86400000),trialEndsAt:end}});
 });
 afterAll(async()=>{if(state.user.organizationId)await prisma.organization.delete({where:{id:state.user.organizationId}});if(state.user.id)await prisma.user.delete({where:{id:state.user.id}});await prisma.$disconnect();vi.unstubAllEnvs();});
 it("serializes parallel card requests into one bound customer and one Checkout",async()=>{
  const form=()=>{const f=new FormData();f.set("plan","annual");f.set("billingConsent","yes");return f;};
  const results=await Promise.allSettled([startCheckoutAction(form()),startCheckoutAction(form())]);
  expect(results.every(r=>r.status==="rejected"&&String(r.reason).includes("REDIRECT:https://checkout.stripe.com"))).toBe(true);
  expect(state.customerCalls).toBe(1);expect(state.checkoutCalls).toBe(1);
  const record=await prisma.subscription.findUniqueOrThrow({where:{organizationId:state.user.organizationId}});
  expect(record.stripeCustomerId).toBe("cus_isolated");expect(record.stripeCheckoutId).toBe("cs_isolated");expect(record.trialEndsAt).toEqual(end);
 });
 it("serializes duplicate setup deliveries and preserves the original trial",async()=>{
  state.complete=true;
  await Promise.all([completeTrialCardSetup(state.user.organizationId,"cs_isolated"),completeTrialCardSetup(state.user.organizationId,"cs_isolated")]);
  expect(state.subscriptionCalls).toBe(1);
  const record=await prisma.subscription.findUniqueOrThrow({where:{organizationId:state.user.organizationId}});
  expect(record.plan).toBe("business");expect(record.status).toBe("trialing");expect(record.trialEndsAt).toEqual(end);
  expect(await prisma.auditLog.count({where:{id:"billing_setup_cs_isolated",organizationId:state.user.organizationId}})).toBe(1);
 });
 it("does not resubscribe after cancellation when an old completion is replayed",async()=>{
  state.created=false;
  await completeTrialCardSetup(state.user.organizationId,"cs_isolated");
  expect(state.subscriptionCalls).toBe(1);
 });
});
