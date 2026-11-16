import { beforeEach, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
vi.mock("server-only",()=>({}));
const mocks = vi.hoisted(()=>({ subscription:vi.fn(),receipt:vi.fn(),transaction:vi.fn(),stripe:vi.fn() }));
vi.mock("@/lib/db",()=>({prisma:{subscription:{findUnique:mocks.subscription},auditLog:{findUnique:mocks.receipt},$transaction:mocks.transaction}}));
vi.mock("@/lib/stripe",()=>({customerSubscriptions:mocks.stripe}));
vi.mock("@/lib/billing-flow",()=>({completeTrialCardSetup:vi.fn()}));
import { POST } from "./route";
function request(customer="cus_example", valid=true) {
 const body=JSON.stringify({id:"evt_example",type:"invoice.paid",livemode:true,data:{object:{customer}}}),t=Math.floor(Date.now()/1000);
 const signature=createHmac("sha256","whsec_test").update(`${t}.${body}`).digest('hex');
 return new Request('https://reppilot.app/api/webhooks/stripe',{method:'POST',body,headers:{'stripe-signature':valid?`t=${t},v1=${signature}`:'invalid'}});
}
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('STRIPE_WEBHOOK_SECRET','whsec_test');mocks.subscription.mockResolvedValue({id:'s',organizationId:'org',trialEndsAt:null});mocks.receipt.mockResolvedValue(null);mocks.stripe.mockResolvedValue({data:[]});mocks.transaction.mockResolvedValue(undefined);});
it("rejects forged events before touching the database",async()=>{expect((await POST(request('cus_example',false))).status).toBe(400);expect(mocks.subscription).not.toHaveBeenCalled();});
it("acknowledges duplicate deliveries without repeating side effects",async()=>{mocks.receipt.mockResolvedValue({id:'receipt'});expect((await POST(request())).status).toBe(200);expect(mocks.stripe).not.toHaveBeenCalled();expect(mocks.transaction).not.toHaveBeenCalled();});
it("requests a retry when Stripe cannot verify payment",async()=>{mocks.stripe.mockRejectedValue(new Error('Unavailable'));expect((await POST(request())).status).toBe(503);expect(mocks.transaction).not.toHaveBeenCalled();});
it("never associates an unbound customer with an organization",async()=>{mocks.subscription.mockResolvedValue(null);expect((await POST(request())).status).toBe(200);expect(mocks.transaction).not.toHaveBeenCalled();});
