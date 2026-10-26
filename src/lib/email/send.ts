import { prisma } from "../db";
import { logEvent } from "../logger";
import { reportOperationalAlert } from "../monitoring";
import type { OutboundEmail } from "../services/reminders";

const STALE_SEND_MS = 2 * 60 * 1000;

function hostedEnvironment() {
  const env = process.env.APP_ENV || process.env.VERCEL_ENV || "";
  return env === "production" || env === "staging" || env === "preview";
}

export async function deliverEmail(email: OutboundEmail) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey && hostedEnvironment()) {
    throw new Error("RESEND_API_KEY is required when APP_ENV or VERCEL_ENV is staging, preview, or production.");
  }

  const existing = await prisma.notificationDelivery.findUnique({
    where: { idempotencyKey: email.idempotencyKey },
  });
  if (existing?.status === "sent") return existing;
  if (existing?.status === "logged_demo" && !apiKey) return existing;
  if (existing?.status === "sending" && Date.now() - existing.updatedAt.getTime() < STALE_SEND_MS) {
    return existing;
  }

  const deliveryId = await claimDelivery(email, existing?.id);
  if (!deliveryId) {
    return prisma.notificationDelivery.findUniqueOrThrow({ where: { idempotencyKey: email.idempotencyKey } });
  }

  let status: "sent" | "logged_demo" | "failed" = "logged_demo";
  let providerMessageId: string | null = null;
  let error: string | null = null;
  if (apiKey && email.to) {
    try {
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
        signal: AbortSignal.timeout(10000),
      });
      if (response.ok) {
        const body = (await response.json()) as { id?: string };
        status = "sent";
        providerMessageId = body.id ?? null;
      } else {
        status = "failed";
        error = `Email provider returned ${response.status}`;
      }
    } catch (cause) {
      status = "failed";
      error = cause instanceof Error ? cause.message : "Email provider request failed";
    }
  } else if (!email.to) {
    status = "logged_demo";
    error = "No recipient email on file. The message was saved but not delivered.";
  } else {
    status = "logged_demo";
    error = "RESEND_API_KEY is not set. The message was saved but not delivered.";
  }

  const delivery = await prisma.notificationDelivery.update({
    where: { id: deliveryId },
    data: {
      status,
      providerMessageId,
      error,
      sentAt: new Date(),
      htmlBody: email.html,
      textBody: email.text,
      toAddress: email.to,
      subject: email.subject,
    },
  });

  if (status === "failed") {
    await reportOperationalAlert("email.failed", error || "delivery failed", {
      organizationId: email.organizationId,
      idempotencyKey: email.idempotencyKey,
    });
  }

  if (email.notification && email.userId && status !== "failed") {
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

async function claimDelivery(email: OutboundEmail, existingId?: string) {
  if (!existingId) {
    try {
      const created = await prisma.notificationDelivery.create({
        data: {
          organizationId: email.organizationId,
          channel: "email",
          toAddress: email.to,
          subject: email.subject,
          htmlBody: email.html,
          textBody: email.text,
          status: "sending",
          idempotencyKey: email.idempotencyKey,
        },
      });
      return created.id;
    } catch {
      const raced = await prisma.notificationDelivery.findUnique({ where: { idempotencyKey: email.idempotencyKey } });
      if (!raced || raced.status === "sent" || raced.status === "sending") return null;
      existingId = raced.id;
    }
  }
  const claimed = await prisma.notificationDelivery.updateMany({
    where: { id: existingId, status: { in: ["failed", "logged_demo", "sending"] } },
    data: { status: "sending", error: null },
  });
  return claimed.count === 1 ? existingId : null;
}
