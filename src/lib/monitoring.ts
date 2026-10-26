import { logEvent } from "./logger";

export function parseSentryDsn(dsn: string): { storeUrl: string; publicKey: string } | null {
  try {
    const url = new URL(dsn);
    const publicKey = decodeURIComponent(url.username);
    const projectId = url.pathname.replace(/^\/+/, "");
    if (!publicKey || !projectId || projectId.includes("/")) return null;
    return { publicKey, storeUrl: `${url.protocol}//${url.host}/api/${projectId}/store/` };
  } catch {
    return null;
  }
}

type Fields = Record<string, string | number | boolean | null | undefined>;

export async function reportError(error: unknown, fields: Fields = {}) {
  const message = error instanceof Error ? error.message : "unknown error";
  logEvent("error", "app.error", { message, ...fields });
  await Promise.all([
    sendSentry(message, error instanceof Error ? error.stack : undefined, fields),
    sendAlert("app.error", message, fields),
  ]);
}

export async function reportOperationalAlert(event: string, detail: string, fields: Fields = {}) {
  logEvent("error", event, { detail, ...fields });
  await sendAlert(event, detail, fields);
}

async function sendSentry(message: string, stack: string | undefined, fields: Fields) {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  const target = parseSentryDsn(dsn);
  if (!target) return;
  const eventId = crypto.randomUUID().replaceAll("-", "");
  const payload = {
    event_id: eventId,
    timestamp: new Date().toISOString(),
    platform: "node",
    level: "error",
    message,
    exception: { values: [{ type: "Error", value: message, stacktrace: stack ? { frames: [] } : undefined }] },
    tags: Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, String(value ?? "")])),
    extra: { stack },
  };
  await postJson(target.storeUrl, payload, {
    "Content-Type": "application/json",
    "X-Sentry-Auth": `Sentry sentry_version=7, sentry_client=reppilot/0.1, sentry_key=${target.publicKey}`,
  });
}

async function sendAlert(event: string, detail: string, fields: Fields) {
  const webhook = process.env.ALERT_WEBHOOK_URL;
  if (!webhook) return;
  await postJson(webhook, { service: "reppilot", event, detail, fields, at: new Date().toISOString() }, {
    "Content-Type": "application/json",
  });
}

async function postJson(url: string, body: unknown, headers: Record<string, string>) {
  try {
    await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(3000),
    });
  } catch (error) {
    logEvent("error", "monitor.delivery_failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
  }
}
