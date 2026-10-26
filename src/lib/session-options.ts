import type { SessionOptions } from "iron-session";

export type SessionData = {
  userId: string;
  organizationId: string;
  roleKey: string;
};

function sessionPassword() {
  const password = process.env.SESSION_PASSWORD?.trim() ?? "";
  if (password.length >= 32) return password;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_PASSWORD must be at least 32 characters.");
  }
  return "development-only-password-must-be-32";
}

export const sessionOptions: SessionOptions = {
  cookieName: "reppilot_session",
  password: sessionPassword(),
  ttl: 60 * 60 * 24 * 14,
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  },
};
