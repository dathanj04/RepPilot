import { describe, expect, it } from "vitest";
import { formatStraightLine, straightLineMiles } from "./distance";
import { classifyAccount } from "./markers";
import { evaluateMealPolicy, canRecordOrder, exceptionIsProhibited, perPersonCents } from "./policy";
import { assertCostParts, budgetRemainingCents, cateringGates, receiptFileAllowed } from "./catering";
import { summarizeSpending } from "./spending";
import { computeReminderInstants, reminderAction, rangesOverlap } from "./reminders";
import { evaluateConfirmationLink, evaluateSlotSelection } from "./invitations";
import { extractCheckInDeterministic, parseModelExtraction, resolveRelativeDate } from "./extraction";
import { buildAccountBrief, buildDailyBriefing, draftFollowUpEmail, narrativeUsesOnlyAllowedNumbers } from "./briefing";
import { recommendStops } from "./routing";
import { hashToken, tokenMatches } from "./tokens";
import { rateLimit, resetRateLimits } from "./rate-limit";
import { accountIdentityKey, isProfileTimezone } from "./accounts";

const now = new Date("2026-10-13T13:00:00.000Z");

describe("distance", () => {
  it("reports straight-line miles and never labels them as drive time", () => {
    const miles = straightLineMiles(
      { lat: 33.1507, lng: -96.8236 },
      { lat: 33.0198, lng: -96.6989 },
    );
    expect(miles).toBeGreaterThan(8);
    expect(miles).toBeLessThan(15);
    expect(formatStraightLine(miles)).toContain("straight-line");
    expect(formatStraightLine(miles).toLowerCase()).not.toContain("drive");
  });
});

describe("markers", () => {
  it("uses overdue before follow-up, and never for an unvisited office", () => {
    expect(
      classifyAccount({
        lastVisitAt: null,
        nextFollowUpAt: null,
        hasHighPriorityOverdue: false,
        now,
        recentDays: 14,
        overdueDays: 45,
      }),
    ).toBe("never");
    expect(
      classifyAccount({
        lastVisitAt: new Date("2026-10-10T15:00:00.000Z"),
        nextFollowUpAt: null,
        hasHighPriorityOverdue: false,
        now,
        recentDays: 14,
        overdueDays: 45,
      }),
    ).toBe("recent");
    expect(
      classifyAccount({
        lastVisitAt: new Date("2026-10-01T15:00:00.000Z"),
        nextFollowUpAt: new Date("2026-10-12T15:00:00.000Z"),
        hasHighPriorityOverdue: false,
        now,
        recentDays: 14,
        overdueDays: 45,
      }),
    ).toBe("follow_up");
    expect(
      classifyAccount({
        lastVisitAt: new Date("2026-08-01T15:00:00.000Z"),
        nextFollowUpAt: null,
        hasHighPriorityOverdue: false,
        now,
        recentDays: 14,
        overdueDays: 45,
      }),
    ).toBe("overdue");
  });
});

describe("policy", () => {
  const policy = {
    configured: true,
    perPersonCapCents: 2500,
    exceptionsPermitted: true,
    educationalPurposeRequired: true,
    version: "1.2",
  };

  it("blocks a missing policy instead of treating it as permission", () => {
    const decision = evaluateMealPolicy({
      policy: null,
      educationalPurposeDocumented: true,
      isEntertainment: false,
      referralLinked: false,
      orderTotalCents: 1000,
      eligibleAttendees: 4,
    });
    expect(decision.result).toBe("NOT_CONFIGURED");
    expect(canRecordOrder({ decision, exceptionStatus: "approved" }).allowed).toBe(false);
  });

  it("blocks entertainment and referral-linked meals even with an approval", () => {
    const decision = evaluateMealPolicy({
      policy,
      educationalPurposeDocumented: true,
      isEntertainment: true,
      referralLinked: true,
      orderTotalCents: 1200,
      eligibleAttendees: 4,
    });
    expect(exceptionIsProhibited(decision)).toBe(true);
    expect(canRecordOrder({ decision, exceptionStatus: "approved" }).allowed).toBe(false);
    expect(decision.disclaimer).toContain("not a federal");
  });

  it("blocks an internal cap overrun until an allowed exception is approved", () => {
    const decision = evaluateMealPolicy({
      policy,
      educationalPurposeDocumented: true,
      isEntertainment: false,
      referralLinked: false,
      orderTotalCents: 32400,
      eligibleAttendees: 12,
    });
    expect(perPersonCents(32400, 12)).toBe(2700);
    expect(decision.findings.some((finding) => finding.message.includes("$2"))).toBe(true);
    expect(canRecordOrder({ decision, exceptionStatus: "pending" }).allowed).toBe(false);
    expect(canRecordOrder({ decision, exceptionStatus: "approved" }).allowed).toBe(true);
  });

  it("passes a documented educational meal inside the cap", () => {
    const decision = evaluateMealPolicy({
      policy,
      educationalPurposeDocumented: true,
      isEntertainment: false,
      referralLinked: false,
      orderTotalCents: 24000,
      eligibleAttendees: 12,
    });
    expect(decision.result).toBe("PASS");
  });
});

describe("spending", () => {
  it("keeps recorded spending separate from future commitments", () => {
    const summary = summarizeSpending(
      [
        {
          kind: "recorded",
          amountCents: 18000,
          occurredOn: new Date("2026-10-01T17:00:00.000Z"),
          bookingId: "past",
        },
        {
          kind: "commitment",
          amountCents: 25000,
          occurredOn: new Date("2026-10-22T17:00:00.000Z"),
          bookingId: "future",
        },
        {
          kind: "commitment",
          amountCents: 99999,
          occurredOn: new Date("2026-10-02T17:00:00.000Z"),
          bookingId: "past",
        },
      ],
      2026,
    );
    expect(summary.recordedYearToDateCents).toBe(18000);
    expect(summary.upcomingCommitmentCents).toBe(25000);
    expect(summary.recordedYearToDateCents + summary.upcomingCommitmentCents).not.toBe(
      summary.recordedYearToDateCents,
    );
  });
});

describe("catering gates", () => {
  it("keeps an order closed until the lunch and the catering request are both approved", () => {
    expect(cateringGates({ lunchStatus: "AWAITING_APPROVAL", approvalStatus: "PENDING" }).reason).toMatch(/not approved this lunch/);
    expect(cateringGates({ lunchStatus: "SCHEDULED", approvalStatus: "PENDING" }).reason).toMatch(/own approval/);
    expect(cateringGates({ lunchStatus: "SCHEDULED", approvalStatus: "APPROVED" }).reason).toBeNull();
    expect(assertCostParts({ subtotalCents: 1000, taxCents: 80, feeCents: 20, deliveryCents: 100, tipCents: null }, 1200).ok).toBe(false);
    expect(assertCostParts({ subtotalCents: 1000, taxCents: 80, feeCents: 20, deliveryCents: 0, tipCents: 100 }, 1200).ok).toBe(true);
    expect(budgetRemainingCents(2500, 4, 8000)).toBe(2000);
    expect(receiptFileAllowed({ contentType: "text/plain", byteSize: 10 }).ok).toBe(false);
  });
});

describe("reminders and conflicts", () => {
  it("schedules the seven-day reminder on the local calendar and skips duplicates conceptually", () => {
    const appointment = new Date("2026-10-22T17:00:00.000Z");
    const instants = computeReminderInstants(appointment, "America/Chicago");
    expect(instants.FORTY_EIGHT_HOUR.toISOString()).toBe("2026-10-20T17:00:00.000Z");
    expect(instants.NONRESPONSE_24H.toISOString()).toBe("2026-10-21T17:00:00.000Z");
    expect(instants.TWENTY_FOUR_HOUR.toISOString()).toBe("2026-10-21T17:00:00.000Z");
    expect(instants.DELIVERY_DAY.toISOString()).toBe("2026-10-22T13:00:00.000Z");
    expect(instants.SEVEN_DAY.toISOString()).toBe("2026-10-15T17:00:00.000Z");
    expect(reminderAction({ kind: "TWENTY_FOUR_HOUR", bookingStatus: "CONFIRMED", confirmedAt: new Date() })).toBe("send");
    expect(reminderAction({ kind: "DELIVERY_DAY", bookingStatus: "CANCELED", confirmedAt: null })).toBe("skip");
    expect(
      reminderAction({
        kind: "FORTY_EIGHT_HOUR",
        bookingStatus: "CONFIRMED",
        confirmedAt: new Date(),
      }),
    ).toBe("skip");
    expect(
      reminderAction({
        kind: "SEVEN_DAY",
        bookingStatus: "SCHEDULED",
        confirmedAt: null,
      }),
    ).toBe("send");
    expect(
      reminderAction({
        kind: "NONRESPONSE_24H",
        bookingStatus: "CANCELED",
        confirmedAt: null,
      }),
    ).toBe("skip");
  });

  it("detects overlapping times", () => {
    expect(
      rangesOverlap(
        new Date("2026-10-22T17:00:00.000Z"),
        new Date("2026-10-22T18:00:00.000Z"),
        new Date("2026-10-22T17:30:00.000Z"),
        new Date("2026-10-22T18:30:00.000Z"),
      ),
    ).toBe(true);
  });
});

describe("invitations", () => {
  const base = {
    invitationStatus: "ACTIVE",
    expiresAt: new Date("2026-10-20T17:00:00.000Z"),
    now,
    revoked: false,
    slotBelongsToInvitation: true,
    representativeAuthorized: true,
    hasConflict: false,
  };

  it("rejects expired, revoked, foreign, and conflicting slots", () => {
    expect(evaluateSlotSelection({ ...base, expiresAt: new Date("2026-10-01T00:00:00.000Z") }).ok).toBe(false);
    expect(evaluateSlotSelection({ ...base, revoked: true }).ok).toBe(false);
    expect(evaluateSlotSelection({ ...base, slotBelongsToInvitation: false }).ok).toBe(false);
    expect(evaluateSlotSelection({ ...base, hasConflict: true }).ok).toBe(false);
    expect(evaluateSlotSelection(base).ok).toBe(true);
  });

  it("refuses confirmation after cancellation or revocation", () => {
    expect(
      evaluateConfirmationLink({
        revoked: false,
        expiresAt: new Date("2026-10-22T17:00:00.000Z"),
        now,
        bookingStatus: "CANCELED",
      }).ok,
    ).toBe(false);
    expect(
      evaluateConfirmationLink({
        revoked: true,
        expiresAt: new Date("2026-10-22T17:00:00.000Z"),
        now,
        bookingStatus: "SCHEDULED",
      }).ok,
    ).toBe(false);
  });
});

describe("ai extraction", () => {
  it("structures a dictated visit without inventing activities", () => {
    const extracted = extractCheckInDeterministic({
      transcript:
        "Just left Northside Clinic. Met with the office manager Sarah. We talked about our in-home services. I left some educational materials and told her I'd email an updated overview tomorrow. I also need to follow up next Tuesday.",
      now,
      timeZone: "America/Chicago",
    });
    expect(extracted.interactionType).toBe("office_visit");
    expect(extracted.outcome).toBe("completed");
    expect(extracted.contactNames).toEqual(["Sarah"]);
    expect(extracted.contactRoles).toContain("office_manager");
    expect(extracted.completedActivities).toEqual(["left_educational_materials", "met_office_manager"]);
    expect(extracted.completedActivities).not.toContain("scheduled_lunch");
    expect(extracted.suggestedTasks.map((task) => task.title)).toEqual([
      "Email updated overview",
      "Follow up with office",
    ]);
    expect(extracted.suggestedTasks[0]?.dueDate).toBe("2026-10-14");
    expect(extracted.suggestedTasks[1]?.dueDate).toBe("2026-10-20");
  });

  it("drops patient details and rejects invented model output", () => {
    const extracted = extractCheckInDeterministic({
      transcript: "Stopped by the office. Patient John Doe was diagnosed with diabetes.",
      now,
      timeZone: "America/Chicago",
    });
    expect(extracted.summary.toLowerCase()).not.toContain("john");
    expect(extracted.summary.toLowerCase()).not.toContain("diabetes");
    expect(extracted.warnings.join(" ")).toMatch(/patient/i);
    expect(parseModelExtraction({ interactionType: "made_up" })).toBeNull();
    expect(
      parseModelExtraction({
        interactionType: null,
        outcome: null,
        contactNames: [],
        contactRoles: [],
        summary: "",
        completedActivities: [],
        suggestedTasks: [],
        warnings: [],
      }),
    ).not.toBeNull();
  });

  it("resolves next Tuesday from a Tuesday as the following week", () => {
    expect(resolveRelativeDate("next tuesday", now, "America/Chicago")).toBe("2026-10-20");
  });
});

describe("briefing and email", () => {
  it("builds the daily briefing only from supplied counts", () => {
    const text = buildDailyBriefing({
      plannedVisits: 4,
      lunches: 2,
      pendingConfirmations: 1,
      followUpsDue: 3,
      staleAccounts: 8,
      staleDays: 30,
    });
    expect(text).toContain("8 accounts");
    expect(text).toContain("2 upcoming lunches");
    expect(text).toContain("3 follow-ups");
    expect(
      narrativeUsesOnlyAllowedNumbers("You have 8 accounts and 2 lunches.", [8, 2, 30]),
    ).toBe(true);
    expect(narrativeUsesOnlyAllowedNumbers("You have 99 secret accounts.", [8, 2])).toBe(false);
  });

  it("keeps follow-up email grounded in the note and open tasks", () => {
    const draft = draftFollowUpEmail({
      repName: "Alex Davis",
      contactName: "Sarah Mitchell",
      officeName: "Northside Clinic",
      summary: "Discussed services and promised updated materials.",
      nextStepTitles: ["Send educational materials"],
    });
    expect(draft.body).toContain("Sarah");
    expect(draft.body).toContain("Discussed services");
    expect(draft.body).toContain("Send educational materials");
    expect(draft.body.toLowerCase()).not.toContain("referral volume");
    const brief = buildAccountBrief({
      lastVisit: null,
      openTasks: [],
    });
    expect(brief.text).toMatch(/no visits/i);
  });
});

describe("routing", () => {
  it("explains recommendations from tasks and visit age without inventing drive time", () => {
    const stops = recommendStops({
      accounts: [
        {
          id: "a",
          name: "Northside Clinic",
          city: "Frisco",
          location: { lat: 33.15, lng: -96.82 },
          lastVisitAt: new Date("2026-08-01T00:00:00.000Z"),
        },
      ],
      tasks: [
        {
          accountId: "a",
          title: "Send overview",
          dueDate: new Date("2026-10-12T00:00:00.000Z"),
          priority: "HIGH",
          status: "OPEN",
        },
      ],
      lunches: [
        {
          accountId: "other",
          city: "Frisco",
          startsAt: new Date("2026-10-22T17:00:00.000Z"),
        },
      ],
      now,
      origin: { lat: 33.1, lng: -96.8 },
      staleDays: 30,
      limit: 5,
    });
    expect(stops[0]?.reasons.join(" ")).toContain("High-priority");
    expect(stops[0]?.reasons.join(" ")).toContain("Frisco");
    expect(stops[0]?.reasons.join(" ").toLowerCase()).not.toContain("minute drive");
    expect(stops[0]?.straightLineMiles).not.toBeNull();
  });
});

describe("account identity", () => {
  it("treats punctuation and case as the same office and rejects unknown timezones", () => {
    const left = accountIdentityKey({ name: "Northside Clinic", street: "123 Medical Drive", zip: "75034" });
    const right = accountIdentityKey({ name: "northside clinic", street: "123 medical drive.", zip: "75034" });
    expect(left).toBe(right);
    expect(accountIdentityKey({ name: "Northside Clinic", street: "123 Medical Drive", zip: "75035" })).not.toBe(left);
    expect(isProfileTimezone("America/Chicago")).toBe(true);
    expect(isProfileTimezone("Mars/Olympus")).toBe(false);
  });
});

describe("tokens and rate limit", () => {
  it("hashes tokens and compares them without keeping the raw value", () => {
    const hash = hashToken("clinic-link-token");
    expect(hash).not.toContain("clinic-link");
    expect(tokenMatches("clinic-link-token", hash)).toBe(true);
    expect(tokenMatches("other-token", hash)).toBe(false);
  });

  it("stops repeated public link attempts", () => {
    resetRateLimits();
    expect(rateLimit("ip", 2, 60_000, 1_000).ok).toBe(true);
    expect(rateLimit("ip", 2, 60_000, 1_001).ok).toBe(true);
    expect(rateLimit("ip", 2, 60_000, 1_002).ok).toBe(false);
  });
});
