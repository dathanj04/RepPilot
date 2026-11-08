import { afterEach, describe, expect, it, vi } from "vitest";
import { safeWebsiteUrl } from "./domain/urls";
import { accountEditScope, taskEditScope } from "./permissions";
import { sessionOptions } from "./session-options";
import { updateCheckIn } from "./services/checkins";
import { recordCateringHandoff } from "./services/orders";
import type { Db } from "./db";

afterEach(() => vi.unstubAllEnvs());

describe("website destinations", () => {
  it.each(["javascript:alert(1)", "data:text/html,test", "file:///tmp/a", "//evil.example", "/relative", "https://user:pass@example.com", "java\nscript:alert(1)"])("rejects %s", (value) => {
    expect(safeWebsiteUrl(value)).toBeNull();
  });
  it("keeps valid web URLs and handles absent links", () => {
    expect(safeWebsiteUrl(" https://example.com/practice ")).toBe("https://example.com/practice");
    expect(safeWebsiteUrl("http://example.com")).toBe("http://example.com/");
    expect(safeWebsiteUrl(null)).toBeNull();
  });
});

describe("edit scopes", () => {
  const rep = { id: "rep-a", organizationId: "org-a", roleKey: "REP" };
  it("limits ordinary and unknown roles to their own records", () => {
    for (const roleKey of ["REP", "COMPLIANCE_ADMIN", "PLATFORM_ADMIN", "unknown"]) {
      expect(accountEditScope({ ...rep, roleKey })).toEqual({ organizationId: "org-a", assignments: { some: { userId: "rep-a", organizationId: "org-a" } } });
      expect(taskEditScope({ ...rep, roleKey })).toEqual({ organizationId: "org-a", ownerId: "rep-a" });
    }
  });
  it("retains tenant boundaries for team editors", () => {
    for (const roleKey of ["MANAGER", "ORG_ADMIN"]) {
      expect(accountEditScope({ ...rep, roleKey })).toEqual({ organizationId: "org-a" });
      expect(taskEditScope({ ...rep, roleKey })).toEqual({ organizationId: "org-a" });
    }
  });
  it("rejects another member's check-in without mutating it", async () => {
    const update = vi.fn();
    const findFirst = vi.fn(async ({ where }) => where.userId === "rep-b" ? { id: "visit" } : null);
    const db = { accountInteraction: { findFirst, update } } as unknown as Db;
    expect(await updateCheckIn(db, { organizationId: "org-a", userId: "rep-a", interactionId: "visit", summary: "changed", outcome: null, activities: [] })).toEqual({ ok: false, error: "Check-in was not found." });
    expect(update).not.toHaveBeenCalled();
  });
  it("rejects another representative's catering handoff", async () => {
    const findFirst = vi.fn(async ({ where }) => where.representativeId === "rep-b" ? { order: { id: "order" } } : null);
    const db = { lunchBooking: { findFirst } } as unknown as Db;
    expect(await recordCateringHandoff(db, { organizationId: "org-a", userId: "rep-a", bookingId: "lunch", vendor: "ezcater" })).toEqual({ ok: false, error: "Lunch order was not found." });
  });
});

describe("session configuration", () => {
  it("fails closed without a private secret", () => {
    vi.stubEnv("SESSION_PASSWORD", "");
    expect(() => sessionOptions()).toThrow("SESSION_PASSWORD");
  });
  it("uses protected cookies in production", () => {
    vi.stubEnv("SESSION_PASSWORD", "x".repeat(40));
    vi.stubEnv("NODE_ENV", "production");
    expect(sessionOptions().cookieOptions).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax", path: "/" });
  });
});
