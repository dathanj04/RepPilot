import { describe, expect, it } from "vitest";
import {
  proposedTrialEnd,
  stripeEpochSecondsToIso,
  summarizeStripeTrial,
  TRIAL_LENGTH_DAYS,
} from "../src/lib/domain/trial-billing";

describe("Stripe trial presentation rules", () => {
  it("proposes a 14-day window, including across month boundaries", () => {
    const start = new Date("2026-11-17T18:00:00.000Z");
    expect(TRIAL_LENGTH_DAYS).toBe(14);
    expect(proposedTrialEnd(start).toISOString()).toBe("2026-12-01T18:00:00.000Z");
  });

  it("converts Stripe seconds to UTC timestamps", () => {
    expect(stripeEpochSecondsToIso(0)).toBe("1970-01-01T00:00:00.000Z");
    expect(stripeEpochSecondsToIso(-1)).toBeNull();
    expect(stripeEpochSecondsToIso(NaN)).toBeNull();
  });

  it("shows a stored card and trial end without claiming an immediate charge", () => {
    const start = Date.parse("2026-11-17T18:00:00Z") / 1000;
    const end = Date.parse("2026-12-01T18:00:00Z") / 1000;
    const view = summarizeStripeTrial({
      status: "trialing",
      trialStart: start,
      trialEnd: end,
      hasDefaultPaymentMethod: true,
      now: new Date("2026-11-20T18:00:00Z"),
    });
    expect(view.daysRemaining).toBe(11);
    expect(view.cardOnFile).toBe(true);
    expect(view.trialEndsAt).toBe("2026-12-01T18:00:00.000Z");
    expect(view.chargeMessage).toContain("No subscription payment is due before the trial ends");
  });

  it("does not infer paid status or another charge date from expired trials", () => {
    const view = summarizeStripeTrial({
      status: "past_due",
      trialStart: null,
      trialEnd: null,
      hasDefaultPaymentMethod: false,
    });
    expect(view.state).toBe("past_due");
    expect(view.daysRemaining).toBeNull();
  });

  it("does not treat unrecognized provider states as active", () => {
    const view = summarizeStripeTrial({
      status: "unpaid",
      trialStart: null,
      trialEnd: null,
      hasDefaultPaymentMethod: true,
    });
    expect(view.state).toBe("unknown");
  });
});
