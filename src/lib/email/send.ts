import { prisma } from "../db";
import { logEvent } from "../logger";
import type { OutboundEmail } from "../services/reminders";

export async function deliverEmail(email: OutboundEmail) {
  const existing = await prisma.notificationDelivery.findUnique({
    where: { idempotencyKey: email.idempotencyKey },
  });
  if (existing && (existing.status === "sent" || existing.status === "logged_demo")) {
    return existing;
  }

  let status: "sent" | "logged_demo" | "failed" = "logged_demo";
  let providerMessageId: string | null = null;
  let error: string | null = null;
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey && email.to) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": email.idempotencyKey,
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "RepPilot <notifications@example.com>",
        to: [email.to],
        subject: email.subject,
        html: email.html,
        text: email.text,
      }),
    });
    if (response.ok) {
      const body = (await response.json()) as { id?: string };
      status = "sent";
      providerMessageId = body.id ?? null;
    } else {
      status = "failed";
      error = `Email provider returned ${response.status}`;
    }
  } else if (!email.to) {
    status = "logged_demo";
    error = "No recipient email on file. The message was saved but not delivered.";
  }

  const delivery = await prisma.notificationDelivery.upsert({
    where: { idempotencyKey: email.idempotencyKey },
    update: { status, providerMessageId, error, sentAt: new Date(), htmlBody: email.html, textBody: email.text },
    create: {
      organizationId: email.organizationId,
      channel: "email",
      toAddress: email.to,
      subject: email.subject,
      htmlBody: email.html,
      textBody: email.text,
      status,
      idempotencyKey: email.idempotencyKey,
      providerMessageId,
      error,
      sentAt: new Date(),
    },
  });

  if (email.notification && email.userId) {
    await prisma.notification.create({
      data: {
        organizationId: email.organizationId,
        userId: email.userId,
        kind: email.notification.kind,
        title: email.notification.title,
        body: status === "sent" ? email.notification.body : `${email.notification.body} Email provider is not connected, so the message was logged in RepPilot.`,
        href: email.notification.href,
      },
    });
  }
  logEvent("info", "email.delivery", {
    organizationId: email.organizationId,
    status,
    idempotencyKey: email.idempotencyKey,
  });
  return delivery;
}
