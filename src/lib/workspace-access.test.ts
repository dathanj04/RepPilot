import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const paid = vi.hoisted(() => vi.fn());
vi.mock("./stripe", () => ({ hasPaidAccess: paid }));
import { workspaceAccess } from "./workspace-access";
import type { Db } from "./db";
function db(end: Date) { return { subscription: { findUnique: vi.fn().mockResolvedValue({ status: "trialing", trialStartedAt: new Date(Date.now()-86400000), trialEndsAt: end, stripeCustomerId: "cus_1" }) } } as unknown as Db; }
afterEach(() => vi.resetAllMocks());
describe("public links obey workspace expiry", () => {
 it("keeps the original free trial available", async () => expect(await workspaceAccess(db(new Date(Date.now()+86400000)), "org_1")).toBe(true));
 it("blocks expired public links without confirmed payment", async () => { paid.mockResolvedValue(false); expect(await workspaceAccess(db(new Date(Date.now()-1000)), "org_1")).toBe(false); });
 it("reopens paid links with current Stripe verification", async () => { paid.mockResolvedValue(true); expect(await workspaceAccess(db(new Date(Date.now()-1000)), "org_1")).toBe(true); expect(paid).toHaveBeenCalledWith("cus_1", "org_1"); });
});
