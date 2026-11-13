import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { hasPaidAccess } from "./stripe";
beforeEach(() => { vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_test_placeholder"); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("live entitlement verification", () => {
 it("fails closed with no configured key", async () => { vi.stubEnv("STRIPE_SECRET_KEY", ""); expect(await hasPaidAccess("cus_1", "org_1")).toBe(false); });
 it("fails closed on Stripe outage", async () => { vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline"))); expect(await hasPaidAccess("cus_1", "org_1")).toBe(false); });
 it("checks the bound customer without caching", async () => { const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) }); vi.stubGlobal("fetch", fetch); expect(await hasPaidAccess("cus_1", "org_1")).toBe(false); expect(fetch.mock.calls[0][0]).toContain("customer=cus_1"); expect(fetch.mock.calls[0][1].cache).toBe("no-store"); });
});
