import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const paid = vi.hoisted(() => vi.fn());
const tier=vi.hoisted(()=>vi.fn());
vi.mock("./stripe", () => ({ hasPaidAccess: paid,getPaidTier:tier }));
import { workspaceAccess } from "./workspace-access";
import type { Db } from "./db";
function db(end: Date) { return { subscription: { findUnique: vi.fn().mockResolvedValue({ status: "trialing", trialStartedAt: new Date(Date.now()-86400000), trialEndsAt: end, stripeCustomerId: "cus_1" }) } } as unknown as Db; }
afterEach(() => vi.resetAllMocks());
describe("public links obey workspace expiry", () => {
 it("keeps the original free trial available", async () => expect(await workspaceAccess(db(new Date(Date.now()+86400000)), "org_1")).toBe(true));
 it("blocks expired public links without confirmed payment", async () => { paid.mockResolvedValue(false); expect(await workspaceAccess(db(new Date(Date.now()-1000)), "org_1")).toBe(false); });
 it("reopens paid links with current Stripe verification", async () => { paid.mockResolvedValue(true); expect(await workspaceAccess(db(new Date(Date.now()-1000)), "org_1")).toBe(true); expect(paid).toHaveBeenCalledWith("cus_1", "org_1"); });
});

it("keeps Business links available during the original trial regardless of the chosen future tier",async()=>{expect(await workspaceAccess(db(new Date(Date.now()+1000)),"org_1",true)).toBe(true);expect(tier).not.toHaveBeenCalled();});
it("rejects Business public links for a paid Individual workspace",async()=>{tier.mockResolvedValue("individual");expect(await workspaceAccess(db(new Date(Date.now()-1000)),"org_1",true)).toBe(false);tier.mockResolvedValue("business");expect(await workspaceAccess(db(new Date(Date.now()-1000)),"org_1",true)).toBe(true);});
