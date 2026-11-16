import { createHmac } from "node:crypto";
import { expect, it } from "vitest";
import { validStripeSignature } from "./stripe-webhook";
const now = 1800000000000, timestamp = String(now/1000), secret = "whsec_test_only";
const sign = (body:string,t=timestamp) => `t=${t},v1=${createHmac('sha256',secret).update(`${t}.${body}`).digest('hex')}`;
it("accepts authentic raw payloads and rotating signatures", () => {
 expect(validStripeSignature('{"id":1}',sign('{"id":1}'),secret,now)).toBe(true);
 expect(validStripeSignature('x',sign('x')+',v1='+'0'.repeat(64),secret,now)).toBe(true);
});
it("rejects tampering, replay, future timestamps, missing secret and malformed signatures", () => {
 expect(validStripeSignature('modified',sign('original'),secret,now)).toBe(false);
 for(const t of [String(now/1000-301),String(now/1000+301)]) expect(validStripeSignature('x',sign('x',t),secret,now)).toBe(false);
 expect(validStripeSignature('x',sign('x'),'',now)).toBe(false);
 expect(validStripeSignature('x',`t=${timestamp},v1=bad`,secret,now)).toBe(false);
});
