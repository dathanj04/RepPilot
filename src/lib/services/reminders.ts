import type { Db } from "../db";
import { reminderAction, type ReminderKind } from "../domain/reminders";
import { logEvent } from "../logger";
import { issueConfirmationLink } from "./lunches";

export type OutboundEmail = {
  organizationId: string;
  to: string | null;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
  userId?: string;
  notification?: { title: string; body: string; href?: string; kind: string };
};

export async function processDueReminders(
  db: Db,
  now: Date,
  deps: {
    appUrl: string;
    send: (email: OutboundEmail) => Promise<unknown>;
    render: (input: {
      kind: ReminderKind;
      officeName: string;
      repName: string;
      organizationName: string;
      startsAt: Date;
      endsAt: Date;
      timeZone: string;
      attendees: number;
      confirmUrl?: string;
    }) => { subject: string; html: string; text: string };
  },
) {
  const staleBefore = new Date(now.getTime() - 15 * 60 * 1000);
  await db.lunchReminder.updateMany({
    where: { status: "SENDING", updatedAt: { lt: staleBefore } },
    data: { status: "SCHEDULED" },
  });

  const due = await db.lunchReminder.findMany({
    where: { status: "SCHEDULED", scheduledFor: { lte: now } },
    include: {
      booking: {
        include: { account: true, representative: true, organization: true },
      },
    },
    orderBy: { scheduledFor: "asc" },
    take: 50,
  });

  const results: { id: string; status: string }[] = [];
  for (const reminder of due) {
    const claimed = await db.lunchReminder.updateMany({
      where: { id: reminder.id, status: "SCHEDULED" },
      data: { status: "SENDING" },
    });
    if (claimed.count !== 1) {
      results.push({ id: reminder.id, status: "skipped_duplicate" });
      continue;
    }

    const booking = reminder.booking;
    const action = reminderAction({
      kind: reminder.kind as ReminderKind,
      bookingStatus: booking.status,
      confirmedAt: booking.confirmedAt,
    });
    if (action === "skip") {
      await db.lunchReminder.update({
        where: { id: reminder.id },
        data: { status: "SKIPPED", sentAt: now },
      });
      results.push({ id: reminder.id, status: "skipped" });
      continue;
    }

    try {
      let confirmUrl: string | undefined;
      if (reminder.kind === "FORTY_EIGHT_HOUR" || reminder.kind === "TWENTY_FOUR_HOUR" || reminder.kind === "DELIVERY_DAY") {
        const token = await issueConfirmationLink(db, booking.id, now);
        if (token) confirmUrl = `${deps.appUrl}/l/c/${token}`;
      }
      const rendered = deps.render({
        kind: reminder.kind as ReminderKind,
        officeName: booking.account.name,
        repName: booking.representative.name,
        organizationName: booking.organization.name,
        startsAt: booking.slotStartsAt,
        endsAt: booking.slotEndsAt,
        timeZone: booking.timezone,
        attendees: booking.confirmedAttendees ?? booking.expectedAttendees,
        confirmUrl,
      });
      const to =
        reminder.kind === "NONRESPONSE_24H"
          ? booking.representative.email
          : booking.account.email;
      const officeReminder =
        reminder.kind === "SEVEN_DAY"
          ? { kind: "reminder_sent", title: "Seven-day reminder sent" }
          : reminder.kind === "TWENTY_FOUR_HOUR"
            ? { kind: "reminder_sent", title: "24-hour reminder sent" }
            : reminder.kind === "DELIVERY_DAY"
              ? { kind: "reminder_sent", title: "Delivery-day reminder sent" }
              : { kind: "confirmation_requested", title: "48-hour confirmation requested" };
      const delivery = await deps.send({
        organizationId: booking.organizationId,
        to: to ?? null,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        idempotencyKey: reminder.idempotencyKey,
        userId: booking.representativeId,
        notification:
          reminder.kind === "NONRESPONSE_24H"
            ? {
                kind: "lunch_unconfirmed",
                title: "Lunch still unconfirmed",
                body: `${booking.account.name} has not confirmed. The lunch was not canceled.`,
                href: `/lunches/${booking.id}`,
              }
            : {
                kind: officeReminder.kind,
                title: officeReminder.title,
                body: `${booking.account.name} · ${rendered.subject}`,
                href: `/lunches/${booking.id}`,
              },
      });
      const deliveryStatus = delivery && typeof delivery === "object" && "status" in delivery ? String(delivery.status) : "";
      if (deliveryStatus === "failed") throw new Error("Email delivery failed");
      if (deliveryStatus === "sending") {
        results.push({ id: reminder.id, status: "in_progress" });
        continue;
      }
      await db.lunchReminder.update({
        where: { id: reminder.id },
        data: { status: "SENT", sentAt: now },
      });
      results.push({ id: reminder.id, status: "sent" });
    } catch (error) {
      logEvent("error", "reminder.failed", {
        reminderId: reminder.id,
        message: error instanceof Error ? error.message : "unknown",
      });
      await db.lunchReminder.update({
        where: { id: reminder.id },
        data: { status: "SCHEDULED" },
      });
      results.push({ id: reminder.id, status: "failed" });
    }
  }
  return results;
}
