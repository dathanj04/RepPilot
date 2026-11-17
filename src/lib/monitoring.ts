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

/** Deliberately exclude raw URLs, exception text, stack traces, email and tokens. */
export function safeMonitoringFields(fields: Fields): Fields {
  const route=typeof fields.route==="string"&&/^\/[a-zA-Z0-9_\/\[\]().-]{0,180}$/.test(fields.route)?fields.route:"unknown";
  return {route,method:["GET","POST","PUT","DELETE","PATCH","HEAD","OPTIONS"].includes(String(fields.method))?fields.method:undefined,
    routeType:["render","route","action","middleware"].includes(String(fields.routeType))?fields.routeType:undefined};
}
async function recordIncident(kind:string, fields:Fields){
  try {
    const {prisma}=await import("./db");
    const {createHash}=await import("node:crypto");
    const route=String(fields.route??"unknown");
    const fingerprint=createHash("sha256").update(kind+":"+route).digest("hex");
    await prisma.operationalEvent.upsert({where:{fingerprint},create:{fingerprint,kind,route},update:{occurrences:{increment:1},lastSeenAt:new Date()}});
  } catch {logEvent("error","monitor.persistence_failed",{kind});}
}
export async function reportError(_error: unknown, fields: Fields = {}) {
  const safe=safeMonitoringFields(fields),message="Unhandled application error";
  logEvent("error", "app.error", safe);
  await Promise.all([recordIncident("app.error",safe),sendSentry(message,undefined,safe),sendAlert("app.error",message,safe)]);
}
export async function reportOperationalAlert(event: string, _detail: string, fields: Fields = {}) {
  const kind=["email.failed","reminder.failed","ops.test"].includes(event)?event:"operation.failed",safe=safeMonitoringFields(fields);
  logEvent("error",kind,safe);
  await Promise.all([recordIncident(kind,safe),sendAlert(kind,"Operational failure; inspect the authenticated owner console.",safe)]);
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
  await sendOwnerEmail(event, fields);
  if (!webhook) return;
  await postJson(webhook, { service: "reppilot", event, detail, fields, at: new Date().toISOString() }, {
    "Content-Type": "application/json",
  });
}

async function postJson(url: string, body: unknown, headers: Record<string, string>) {
  try {
    const response=await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(3000),
    });
    if(!response.ok)logEvent("error","monitor.delivery_failed",{status:response.status});
  } catch {
    logEvent("error", "monitor.delivery_failed");
  }
}

async function sendOwnerEmail(event: string, fields: Fields) {
  const recipient=process.env.OPS_ALERT_EMAIL;
  const key=process.env.RESEND_API_KEY;
  const from=process.env.EMAIL_FROM;
  if(!recipient||!key||!from)return;
  // Direct provider call avoids recursion through deliverEmail's own failure alerts.
  // Stable body and key limit each failure/route to one email per 15-minute window.
  const {createHash}=await import("node:crypto");
  const bucket=Math.floor(Date.now()/900000);
  const id=createHash("sha256").update(event+":"+String(fields.route)+":"+bucket).digest("hex");
  await postJson("https://api.resend.com/emails",{
    from,to:[recipient],subject:"RepPilot operational alert",
    text:`RepPilot reported ${event}. Route: ${String(fields.route)}. Review the authenticated owner Operations console. No customer content is included in this alert.`
  },{"Content-Type":"application/json",Authorization:`Bearer ${key}`,"Idempotency-Key":"ops-"+id});
}
