import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { verifyStripeSignature } from "../src/lib/stripe";

describe("Stripe webhook signature validation", () => {
  const secret = "whsec_local_test_only";
  const now = 1_800_000_000;
  const payload = JSON.stringify({ id: "evt_testing", type: "customer.subscription.created" });

  function header(body: string, time: number, key = secret) {
    const digest = createHmac("sha256", key).update(`${time}.${body}`).digest("hex");
    return `t=${time},v1=${digest}`;
  }

  it("accepts an authentic event within Stripe's five-minute tolerance", () => {
    expect(verifyStripeSignature(payload, header(payload, now), secret, now)).toBe(true);
  });
  it("rejects a modified body, wrong secret and incorrect signatures", () => {
    expect(verifyStripeSignature(payload + " ", header(payload, now), secret, now)).toBe(false);
    expect(verifyStripeSignature(payload, header(payload, now, "wrong"), secret, now)).toBe(false);
    expect(verifyStripeSignature(payload, `t=${now},v1=deadbeef`, secret, now)).toBe(false);
  });
  it("rejects stale, future and malformed timestamps", () => {
    expect(verifyStripeSignature(payload, header(payload, now - 301), secret, now)).toBe(false);
    expect(verifyStripeSignature(payload, header(payload, now + 301), secret, now)).toBe(false);
    expect(verifyStripeSignature(payload, "t=not-time,v1=abcd", secret, now)).toBe(false);
  });
  it("accepts one valid signature among multiple rotation candidates", () => {
    expect(verifyStripeSignature(payload, `t=${now},v1=${"0".repeat(64)},${header(payload, now).split(",")[1]}`, secret, now)).toBe(true);
  });
});
