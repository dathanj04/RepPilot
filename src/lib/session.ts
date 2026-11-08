import { getIronSession } from "iron-session";
import { cookies, headers } from "next/headers";
import { sessionOptions, type SessionData } from "./session-options";
import { bearerSeal, isPreviewRequest, previewCookieName, sealSession, unsealSession } from "./session-seal";

export async function getSession() {
  const store = await cookies();
  const session = await getIronSession<SessionData>(store, sessionOptions);
  if (!session.userId) {
    const headerStore = await headers();
    if (!isPreviewRequest((name) => headerStore.get(name))) return session;
    const data = await unsealSession(bearerSeal(headerStore.get("authorization")));
    if (data) {
      session.userId = data.userId;
      session.organizationId = data.organizationId;
      session.roleKey = data.roleKey;
      session.credentialVersion = data.credentialVersion;
    }
  }
  return session;
}

// Cursor's preview ingress removes the Cookie header before the request
// reaches Next.js. The httpOnly session cookie still works on a direct
// connection. On a preview host we also expose the same sealed value to the
// page so its service worker can send it in Authorization, which the ingress
// forwards.
export async function publishPreviewSession(data: SessionData) {
  const headerStore = await headers();
  const preview = isPreviewRequest((name) => headerStore.get(name));
  if (!preview) return;
  const store = await cookies();
  store.set(previewCookieName, await sealSession(data), {
    httpOnly: false,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60,
  });
}

export async function clearPreviewSession() {
  const store = await cookies();
  store.set(previewCookieName, "", {
    httpOnly: false,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export type { SessionData };
