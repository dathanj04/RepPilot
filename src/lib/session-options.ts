import { createHash } from "node:crypto";
import type { SessionOptions } from "iron-session";

export type SessionData = {
  userId: string;
  organizationId: string;
  roleKey: string;
  credentialVersion: string;
};

export function sessionPassword() {
  const password = process.env.SESSION_PASSWORD?.trim() ?? "";
  if (password.length < 32) {
    throw new Error("SESSION_PASSWORD must be at least 32 characters.");
  }
  return password;
}

export function credentialVersion(passwordHash: string) {
  return createHash("sha256").update(passwordHash).digest("hex").slice(0, 16);
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
