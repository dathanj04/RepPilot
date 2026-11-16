import { afterEach, expect, it, vi } from "vitest";
const delivery = vi.hoisted(() => ({ findUnique: vi.fn(), create: vi.fn(), update: vi.fn() }));
vi.mock("../db", () => ({ prisma: { notificationDelivery: delivery } }));
vi.mock("../logger", () => ({ logEvent: vi.fn() }));
vi.mock("../monitoring", () => ({ reportOperationalAlert: vi.fn() }));
import { deliverEmail } from "./send";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetAllMocks(); });

it.each([false, true])("never persists email bodies when provider connected=%s", async (connected) => {
  vi.stubEnv("APP_ENV", "development");
  vi.stubEnv("VERCEL_ENV", "");
  vi.stubEnv("RESEND_API_KEY", connected ? "test-only-key" : "");
  delivery.findUnique.mockResolvedValue(null);
  delivery.create.mockResolvedValue({ id: "delivery" });
  delivery.update.mockImplementation(async (value) => value.data);
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "provider-message" }) });
  vi.stubGlobal("fetch", fetch);
  await deliverEmail({ organizationId: "org", to: "test@example.test", subject: "Invitation", html: "<a>private clinic token</a>", text: "private clinic token", idempotencyKey: "invitation-1" });
  expect(delivery.create.mock.calls[0][0].data).toMatchObject({ htmlBody: "", textBody: "", idempotencyKey: "invitation-1" });
  expect(delivery.update.mock.calls[0][0].data).toMatchObject({ htmlBody: "", textBody: "", status: connected ? "sent" : "logged_demo" });
  if (connected) {
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ html: "<a>private clinic token</a>", text: "private clinic token" });
  }
});

it("passes the calendar attachment and rep reply address to the email provider",async()=>{
 vi.stubEnv('APP_ENV','production');vi.stubEnv('RESEND_API_KEY','test-only-key');
 delivery.findUnique.mockResolvedValue(null);delivery.create.mockResolvedValue({id:'delivery'});delivery.update.mockImplementation(async value=>value.data);
 const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({id:'provider-id'})});vi.stubGlobal('fetch',fetch);
 const attachments=[{filename:'lunch.ics',content:Buffer.from('BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n').toString('base64'),content_type:'text/calendar; charset=utf-8; method=PUBLISH'}];
 await deliverEmail({organizationId:'org',to:'office@example.test',subject:'Confirmed',html:'<p>Confirmed</p>',text:'Confirmed',idempotencyKey:'calendar:test',replyTo:'rep@example.test',attachments});
 expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({attachments,reply_to:'rep@example.test'});
 expect(delivery.update.mock.calls[0][0].data).toMatchObject({htmlBody:'',textBody:'',status:'sent'});
});
