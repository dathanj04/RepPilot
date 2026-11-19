import { describe, expect, it, vi } from "vitest";
vi.mock("../src/lib/workspace-access", () => ({
  workspaceAccess: vi.fn().mockResolvedValue(true),
}));
import { processDueReminders } from "../src/lib/services/reminders";

describe("missing-recipient reminder handling", () => {
  it("marks the reminder NEEDS_ATTENTION and alerts its rep without sending an email", async () => {
    const reminder = {
      id: "reminder-1",
      status: "SCHEDULED",
      kind: "SEVEN_DAY",
      idempotencyKey: "reminder:booking-1:SEVEN_DAY:2026-11-26",
      booking: {
        id: "booking-1",
        organizationId: "org-1",
        representativeId: "rep-1",
        status: "CONFIRMED",
        confirmedAt: null,
        account: { name: "Demo Clinic", email: null },
        representative: { name: "Test Rep", email: "rep@example.test" },
        organization: { name: "Demo Org" },
      },
    };
    const updateMany = vi.fn()
      .mockResolvedValueOnce({ count: 0 }) // stale-reset pass
      .mockResolvedValueOnce({ count: 1 }) // claim pass
      .mockResolvedValueOnce({ count: 1 }); // mark needs attention
    const notificationCreate = vi.fn().mockResolvedValue({ id: "alert-1" });
    const db = {
      lunchReminder: {
        updateMany,
        findMany: vi.fn().mockResolvedValue([reminder]),
      },
      notification: { create: notificationCreate },
      $transaction: vi.fn(async (callback: (transaction: unknown) => Promise<void>) =>
        callback({ lunchReminder: { updateMany }, notification: { create: notificationCreate } })),
    };
    const send = vi.fn();
    const results = await processDueReminders(db as never, new Date("2026-11-19T18:00:00Z"), {
      appUrl: "https://reppilot.app",
      send,
      render: vi.fn() as never,
    });
    expect(results).toEqual([{ id: "reminder-1", status: "needs_attention" }]);
    expect(send).not.toHaveBeenCalled();
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "reminder-1", status: "SENDING" },
      data: { status: "NEEDS_ATTENTION", sentAt: null },
    });
    expect(notificationCreate).toHaveBeenCalledTimes(1);
    expect(notificationCreate.mock.calls[0][0].data).toMatchObject({
      organizationId: "org-1",
      userId: "rep-1",
      kind: "reminder_action_required",
      href: "/lunches/booking-1",
    });
  });
});
