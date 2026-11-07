type TokenResponse = { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };

export type CalendarCredentials = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string;
};

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function exchangeGoogleCode(code: string, redirectUri: string): Promise<CalendarCredentials | null> {
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
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

export async function refreshGoogleAccess(credentials: CalendarCredentials): Promise<CalendarCredentials | null> {
  if (!credentials.refreshToken) return null;
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    refresh_token: credentials.refreshToken,
    grant_type: "refresh_token",
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const payload = (await readJson(response)) as TokenResponse | null;
  if (!response.ok || !payload?.access_token) return null;
  return {
    accessToken: payload.access_token,
    refreshToken: credentials.refreshToken,
    expiresAt: new Date(Date.now() + (payload.expires_in ?? 3600) * 1000).toISOString(),
  };
}

export async function googleFreeBusy(accessToken: string, start: Date, end: Date): Promise<{ ok: true; body: unknown } | { ok: false; status: number }> {
  const response = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ timeMin: start.toISOString(), timeMax: end.toISOString(), items: [{ id: "primary" }] }),
    cache: "no-store",
  });
  if (!response.ok) return { ok: false, status: response.status };
  return { ok: true, body: await readJson(response) };
}

export async function createGoogleEvent(
  accessToken: string,
  event: { summary: string; start: Date; end: Date; description: string },
): Promise<{ ok: true; id: string } | { ok: false; status: number }> {
  const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      summary: event.summary,
      description: event.description,
      start: { dateTime: event.start.toISOString() },
      end: { dateTime: event.end.toISOString() },
    }),
    cache: "no-store",
  });
  const body = (await readJson(response)) as { id?: string } | null;
  if (!response.ok || !body?.id) return { ok: false, status: response.status };
  return { ok: true, id: body.id };
}
