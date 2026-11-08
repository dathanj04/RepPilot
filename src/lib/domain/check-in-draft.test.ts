import { describe, expect, it } from "vitest";
import { draftStorageKey, readCheckInDraft } from "./check-in-draft";

describe("check-in recovery", () => {
  it("restores participants, follow-up date and visit details as well as the summary", () => {
    const draft = { summary: "Discussed office resources", type: "office_visit", outcome: "completed", roles: ["office_manager"], contactId: "contact", otherName: "Fictional person", activities: ["left_materials"], steps: ["follow_up"], followUpDate: "2026-11-12", questions: "Availability?", challenges: "Scheduling", resourcesRequested: "Brochures", discussedTheme: true };
    expect(readCheckInDraft(JSON.stringify(draft))).toEqual(draft);
  });
  it.each([null, "invalid JSON", '{"summary":"partial"}', '{"summary":123}'])("ignores missing, damaged and old draft data: %s", (raw) => {
    expect(readCheckInDraft(raw)).toBeNull();
  });
  it("does not share a draft key across users or organizations", () => {
    const key = draftStorageKey("org-a", "user-a", "practice");
    expect(key).not.toBe(draftStorageKey("org-b", "user-a", "practice"));
    expect(key).not.toBe(draftStorageKey("org-a", "user-b", "practice"));
  });
});
