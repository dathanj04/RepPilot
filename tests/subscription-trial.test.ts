import { describe, expect, it } from "vitest";
import { normalizeBillingState, subscriberCsv, trialDaysRemaining, trialEndFromStart } from "../src/lib/domain/subscription-trial";

describe("subscription trial helpers", () => {
  it("sets a true 14-day interval across month boundaries", () => {
    expect(trialEndFromStart(new Date("2026-11-17T12:30:00.000Z")).toISOString()).toBe("2026-12-01T12:30:00.000Z");
  });
  it("rejects invalid trial start dates", () => {
    expect(() => trialEndFromStart(new Date("invalid"))).toThrow();
  });
  it("counts partial remaining days and never returns negative days", () => {
    expect(trialDaysRemaining("2026-12-01T12:00:00Z", new Date("2026-11-30T12:01:00Z"))).toBe(1);
    expect(trialDaysRemaining("2026-11-30T12:00:00Z", new Date("2026-12-01T12:00:00Z"))).toBe(0);
    expect(trialDaysRemaining(null)).toBeNull();
  });
  it("does not accidentally recognize demo or untrusted statuses as paid", () => {
    expect(normalizeBillingState("active")).toBe("active");
    expect(normalizeBillingState("trialing")).toBe("trialing");
    expect(normalizeBillingState("demo")).toBe("unknown");
  });
  it("exports subscriber amounts, trial dates and escapes spreadsheet injection", () => {
    const output = subscriberCsv([{
      organizationId: "org1", organizationName: "=DANGEROUS", email: 'a"b@example.test',
      plan: "business", stripeStatus: "trialing",
      trialStart: "2026-11-17T12:00:00Z", trialEnd: "2026-12-01T12:00:00Z",
      currentPeriodEnd: null, monthlyAmountCents: 7900, currency: "usd",
    }]);
    expect(output).toContain('"\'=DANGEROUS"');
    expect(output).toContain('"a""b@example.test"');
    expect(output).toContain('"79.00"');
    expect(output).toContain('"2026-12-01T12:00:00.000Z"');
    expect(output).toContain('"trialing"');
  });
});
