import { sealData, unsealData } from "iron-session";
import { sessionOptions, type SessionData } from "./session-options";

export const previewCookieName = "reppilot_preview";

function hostnameOf(value: string | null | undefined) {
  if (!value) return "";
  const first = value.split(",")[0]?.trim().toLowerCase() ?? "";
  return first.replace(/^[a-z][a-z0-9+.-]*:\/\//, "").split("/")[0]?.split(":")[0] ?? "";
}

export function isCursorPreviewHost(value: string | null | undefined) {
  const host = hostnameOf(value);
  if (!host) return false;
  return host.endsWith(".agent.cvm.dev") || host.endsWith(".cursorvm.com");
}

// Every host the client presents must be a Cursor preview host. A production
// Host paired with a spoofed x-forwarded-host does not enable the workaround.
export function isPreviewRequest(get: (name: string) => string | null | undefined) {
  const presented = ["host", "x-forwarded-host", "origin"]
    .map((name) => get(name))
    .filter((value): value is string => Boolean(value?.trim()));
  if (presented.length === 0) return false;
  return presented.every((value) => isCursorPreviewHost(value));
}

export function bearerSeal(authorization: string | null | undefined) {
  if (!authorization || !authorization.toLowerCase().startsWith("bearer ")) return undefined;
  const token = authorization.slice(authorization.indexOf(" ") + 1).trim();
  return token || undefined;
}

export function sealSession(data: SessionData) {
  return sealData(data, { password: sessionOptions.password, ttl: sessionOptions.ttl });
}

export async function unsealSession(seal: string | undefined | null): Promise<SessionData | null> {
  if (!seal) return null;
  try {
    const data = await unsealData<SessionData>(seal, { password: sessionOptions.password });
    if (!data.userId || !data.organizationId || !data.roleKey || !data.credentialVersion) return null;
    return {
      userId: data.userId,
      organizationId: data.organizationId,
      roleKey: data.roleKey,
      credentialVersion: data.credentialVersion,
    };
  } catch {
    return null;
  }
}
