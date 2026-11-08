import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, type SessionData } from "./session-options";

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions());
}

// Remove the legacy JavaScript-readable preview credential on login/logout.
export async function clearPreviewSession() {
  const store = await cookies();
  store.set("reppilot_preview", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export type { SessionData };
