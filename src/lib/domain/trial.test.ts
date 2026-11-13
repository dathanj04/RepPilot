import { describe, expect, it } from "vitest";
import { newTrial, trialAccess } from "./trial";
const start = new Date("2026-11-12T18:30:00Z");
const trial = { status: "trialing", ...newTrial(start) };
describe("14-day organization trials", () => {
 it("starts once at signup and lasts exactly 336 hours", () => { expect(trial.trialEndsAt.toISOString()).toBe("2026-11-26T18:30:00.000Z"); expect(trialAccess(trial, start).daysLeft).toBe(14); });
 it("allows the final millisecond but expires at the boundary", () => { expect(trialAccess(trial, new Date(trial.trialEndsAt.getTime()-1)).allowed).toBe(true); expect(trialAccess(trial, trial.trialEndsAt).allowed).toBe(false); });
 it("does not extend when checked again", () => { expect(trialAccess(trial, new Date("2026-11-25T18:30:00Z")).daysLeft).toBe(1); expect(trial.trialEndsAt.toISOString()).toBe("2026-11-26T18:30:00.000Z"); });
 it("does not grant access for missing, canceled or invalid subscriptions", () => { expect(trialAccess(null,start).allowed).toBe(false); expect(trialAccess({...trial,status:"canceled"},start).allowed).toBe(false); expect(trialAccess({...trial,trialStartedAt:new Date("2027-01-01")},start).allowed).toBe(false); });
 it("does not trust an unverified active status", () => { expect(trialAccess({...trial,status:"active"},new Date("2027-01-01")).allowed).toBe(false); });
});
