import { sealData, unsealData } from "iron-session";
import { sessionOptions, type SessionData } from "./session-options";

export const previewCookieName = "reppilot_preview";

export function isCursorPreviewHost(value: string | null | undefined) {
  if (!value) return false;
  const first = value.split(",")[0]?.trim().toLowerCase() ?? "";
  const host = first.replace(/^[a-z][a-z0-9+.-]*:\/\//, "").split("/")[0]?.split(":")[0] ?? "";
  return host.endsWith(".agent.cvm.dev") || host.endsWith(".cursorvm.com");
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
    if (!data.userId || !data.organizationId || !data.roleKey) return null;
    return { userId: data.userId, organizationId: data.organizationId, roleKey: data.roleKey };
  } catch {
    return null;
  }
}
