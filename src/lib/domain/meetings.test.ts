import { describe, expect, it } from "vitest";
import {
  EXPIRED_INVITATION_MESSAGE,
  bufferedWindow,
  canTransition,
  conflictingLabel,
  invitationAccess,
  parseGoogleFreeBusy,
  parseMicrosoftSchedule,
  requestExpiredBecauseTimePassed,
  resolveInvitationLifetime,
} from "./meetings";

const now = new Date("2026-11-07T18:00:00.000Z");

describe("meeting transitions", () => {
  it("allows approval only from pending, and confirmation only after approval", () => {
    expect(canTransition("PENDING", "APPROVED")).toBe(true);
    expect(canTransition("APPROVED", "CONFIRMED")).toBe(true);
    expect(canTransition("PENDING", "CONFIRMED")).toBe(false);
    expect(canTransition("DECLINED", "CONFIRMED")).toBe(false);
    expect(canTransition("CONFIRMED", "COMPLETED")).toBe(true);
  });
});

describe("scheduling invitations", () => {
  it("defaults the allowed lifetimes and rejects a lifetime the organization did not permit", () => {
    expect(resolveInvitationLifetime(24, [24])).toBe(24);
    expect(resolveInvitationLifetime(168, [24, 48])).toBeNull();
    expect(resolveInvitationLifetime(12, [24, 48, 168])).toBeNull();
  });

  it("rejects an expired token without expiring a request that was already submitted", () => {
    expect(
      invitationAccess({
        now,
        expiresAt: new Date("2026-10-08T18:00:00.000Z"),
        status: "ACTIVE",
        useCount: 0,
        maxUses: 1,
        revoked: false,
      }),
    ).toBe("expired");
    expect(
      requestExpiredBecauseTimePassed({
        status: "PENDING",
        requestedStartsAt: new Date("2026-11-20T18:00:00.000Z"),
        now,
      }),
    ).toBe(false);
    expect(EXPIRED_INVITATION_MESSAGE).toContain("has expired");
  });

  it("rejects a used single-use token", () => {
    expect(
      invitationAccess({
        now,
        expiresAt: new Date("2026-11-08T18:00:00.000Z"),
        status: "USED",
        useCount: 1,
        maxUses: 1,
        revoked: true,
      }),
    ).toBe("revoked");
    expect(
      invitationAccess({
        now,
        expiresAt: new Date("2026-11-08T18:00:00.000Z"),
        status: "USED",
        useCount: 1,
        maxUses: 1,
        revoked: false,
      }),
    ).toBe("used");
  });
});

describe("conflicts", () => {
  it("flags an overlapping commitment and ignores a gap that clears the buffer", () => {
    const window = bufferedWindow(new Date("2026-11-10T15:00:00.000Z"), new Date("2026-11-10T16:00:00.000Z"), 10);
    expect(
      conflictingLabel({
        start: window.start,
        end: window.end,
        intervals: [{ start: new Date("2026-11-10T15:50:00.000Z"), end: new Date("2026-11-10T16:20:00.000Z"), label: "Existing lunch" }],
      }),
    ).toBe("Existing lunch");
    expect(
      conflictingLabel({
        start: window.start,
        end: window.end,
        intervals: [{ start: new Date("2026-11-10T16:30:00.000Z"), end: new Date("2026-11-10T17:00:00.000Z"), label: "Later" }],
      }),
    ).toBeNull();
  });

  it("reads busy blocks from Google and Microsoft payloads and skips free time", () => {
    expect(
      parseGoogleFreeBusy({
        calendars: { primary: { busy: [{ start: "2026-11-10T15:00:00Z", end: "2026-11-10T15:30:00Z" }] } },
      }),
    ).toHaveLength(1);
    expect(
      parseMicrosoftSchedule({
        value: [
          {
            scheduleItems: [
              { status: "free", start: { dateTime: "2026-11-10T12:00:00" }, end: { dateTime: "2026-11-10T13:00:00" } },
              { status: "busy", start: { dateTime: "2026-11-10T15:00:00" }, end: { dateTime: "2026-11-10T16:00:00" } },
            ],
          },
        ],
      }),
    ).toHaveLength(1);
  });
});
