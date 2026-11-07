import type { CalendarCredentials } from "./google";

type TokenResponse = { access_token?: string; refresh_token?: string; expires_in?: number };

function tenant() {
  return process.env.MICROSOFT_TENANT_ID?.trim() || "common";
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function exchangeMicrosoftCode(code: string, redirectUri: string): Promise<CalendarCredentials | null> {
  const body = new URLSearchParams({
    code,
    client_id: process.env.MICROSOFT_CLIENT_ID ?? "",
    client_secret: process.env.MICROSOFT_CLIENT_SECRET ?? "",
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    scope: "offline_access Calendars.ReadWrite User.Read",
  });
  const response = await fetch(`https://login.microsoftonline.com/${tenant()}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const payload = (await readJson(response)) as TokenResponse | null;
  if (!response.ok || !payload?.access_token) return null;
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? null,
    expiresAt: new Date(Date.now() + (payload.expires_in ?? 3600) * 1000).toISOString(),
  };
}

export async function refreshMicrosoftAccess(credentials: CalendarCredentials): Promise<CalendarCredentials | null> {
  if (!credentials.refreshToken) return null;
  const body = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID ?? "",
    client_secret: process.env.MICROSOFT_CLIENT_SECRET ?? "",
    refresh_token: credentials.refreshToken,
    grant_type: "refresh_token",
    scope: "offline_access Calendars.ReadWrite User.Read",
  });
  const response = await fetch(`https://login.microsoftonline.com/${tenant()}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const payload = (await readJson(response)) as TokenResponse | null;
  if (!response.ok || !payload?.access_token) return null;
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? credentials.refreshToken,
    expiresAt: new Date(Date.now() + (payload.expires_in ?? 3600) * 1000).toISOString(),
  };
}

export async function microsoftFreeBusy(accessToken: string, email: string, start: Date, end: Date) {
  const response = await fetch("https://graph.microsoft.com/v1.0/me/calendar/getSchedule", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      schedules: [email],
      startTime: { dateTime: start.toISOString(), timeZone: "UTC" },
      endTime: { dateTime: end.toISOString(), timeZone: "UTC" },
      availabilityViewInterval: 15,
    }),
    cache: "no-store",
  });
  if (!response.ok) return { ok: false as const, status: response.status };
  return { ok: true as const, body: await readJson(response) };
}

export async function createMicrosoftEvent(accessToken: string, event: { summary: string; start: Date; end: Date; description: string }) {
  const response = await fetch("https://graph.microsoft.com/v1.0/me/events", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      subject: event.summary,
      body: { contentType: "text", content: event.description },
      start: { dateTime: event.start.toISOString(), timeZone: "UTC" },
      end: { dateTime: event.end.toISOString(), timeZone: "UTC" },
    }),
    cache: "no-store",
  });
  const body = (await readJson(response)) as { id?: string } | null;
  if (!response.ok || !body?.id) return { ok: false as const, status: response.status };
  return { ok: true as const, id: body.id };
}
