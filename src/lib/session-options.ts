import type { SessionOptions } from "iron-session";

export type SessionData = {
  userId: string;
  organizationId: string;
  roleKey: string;
};

export const sessionOptions: SessionOptions = {
  cookieName: "reppilot_session",
  password: process.env.SESSION_PASSWORD || "development-only-password-must-be-32",
  ttl: 60 * 60 * 24 * 14,
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  },
};
