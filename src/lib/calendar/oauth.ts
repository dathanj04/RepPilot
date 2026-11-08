import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { sessionPassword } from "../session-options";

export function googleCalendarConfigured() {
  const id = process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
  const secret = process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "";
  return id.length >= 10 && secret.length >= 10;
}

export function microsoftCalendarConfigured() {
  const id = process.env.MICROSOFT_CLIENT_ID?.trim() ?? "";
  const secret = process.env.MICROSOFT_CLIENT_SECRET?.trim() ?? "";
  return id.length >= 10 && secret.length >= 10;
}

type OAuthState = { userId: string; organizationId: string; provider: "google" | "microsoft"; nonce: string; exp: number };

function secret() {
  return sessionPassword();
}

export function signOAuthState(input: Omit<OAuthState, "nonce" | "exp"> & { ttlMs?: number }) {
  const payload: OAuthState = {
    ...input,
    nonce: randomBytes(8).toString("hex"),
    exp: Date.now() + (input.ttlMs ?? 10 * 60_000),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function readOAuthState(state: string): OAuthState | null {
  const [body, mac] = state.split(".");
  if (!body || !mac) return null;
  const expected = createHmac("sha256", secret()).update(body).digest("base64url");
  const left = Buffer.from(mac);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as OAuthState;
    if (payload.exp < Date.now()) return null;
    if (payload.provider !== "google" && payload.provider !== "microsoft") return null;
    return payload;
  } catch {
    return null;
  }
}

export function googleAuthUrl(state: string, redirectUri: string) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "https://www.googleapis.com/auth/calendar.freebusy https://www.googleapis.com/auth/calendar.events");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return url.toString();
}

export function microsoftAuthUrl(state: string, redirectUri: string) {
  const tenant = process.env.MICROSOFT_TENANT_ID?.trim() || "common";
  const url = new URL(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`);
  url.searchParams.set("client_id", process.env.MICROSOFT_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", "offline_access Calendars.ReadWrite User.Read");
  url.searchParams.set("state", state);
  return url.toString();
}
