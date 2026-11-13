import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));
const mocks = vi.hoisted(() => ({ membership: vi.fn(), session: vi.fn() }));
vi.mock("./db", () => ({ prisma: { organizationMembership: { findUnique: mocks.membership } } }));
vi.mock("./session", () => ({ getSession: mocks.session, clearPreviewSession: vi.fn() }));
vi.mock("./session-options", () => ({ credentialVersion: () => "valid" }));
import { getCurrentUser, requireAppUser } from "./auth";
const membership = () => ({ organizationId: "org-1", user: { id: "user-1", name: "Test", email: "test@example.test", passwordHash: "hash", timezone: "UTC" }, role: { key: "ORG_ADMIN" }, organization: { name: "Test Org", slug: "test", timezone: "UTC", isDemo: false, subscription: { status: "trialing", trialStartedAt: new Date("2020-01-01"), trialEndsAt: new Date("2020-01-15") } } });
beforeEach(() => { vi.clearAllMocks(); mocks.session.mockResolvedValue({ userId: "user-1", organizationId: "org-1", credentialVersion: "valid", destroy: vi.fn() }); mocks.membership.mockResolvedValue(membership()); });
describe("authenticated trial enforcement", () => {
 it("keeps the normal app shell blocked after expiry", async () => { await expect(requireAppUser()).rejects.toThrow("REDIRECT:/trial-ended"); });
 it("permits a server-selected billing shell after expiry", async () => { expect((await requireAppUser({ allowExpiredTrial: true })).id).toBe("user-1"); });
 it("blocks an expired session on server requests", async () => { await expect(getCurrentUser()).rejects.toThrow("REDIRECT:/trial-ended"); });
 it("permits the explicit privacy and export path after expiry", async () => { expect((await getCurrentUser({ allowExpiredTrial: true })).id).toBe("user-1"); });
 it("still requires authentication when an expiry bypass is used", async () => { mocks.session.mockResolvedValue({}); await expect(getCurrentUser({ allowExpiredTrial: true })).rejects.toThrow("REDIRECT:/login"); });
 it("uses the authenticated organization rather than client input", async () => { await getCurrentUser({ allowExpiredTrial: true }); expect(mocks.membership.mock.calls[0][0].where.organizationId_userId).toEqual({ organizationId: "org-1", userId: "user-1" }); });
 it("allows an active paid subscription", async () => { const m = membership(); m.organization.subscription.status = "active"; mocks.membership.mockResolvedValue(m); expect((await getCurrentUser()).trialDaysLeft).toBe(null); });
});
