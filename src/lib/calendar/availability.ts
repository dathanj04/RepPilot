import type { Db } from "@/lib/db";
import { decryptString, encryptString } from "@/lib/domain/crypto";
import { parseGoogleFreeBusy, parseMicrosoftSchedule, type BusyInterval } from "@/lib/domain/meetings";
import type { CalendarCredentials } from "./google";
import { createGoogleEvent, googleFreeBusy, refreshGoogleAccess } from "./google";
import { createMicrosoftEvent, microsoftFreeBusy, refreshMicrosoftAccess } from "./microsoft";

export type ExternalBusy =
  | { status: "not_connected" }
  | { status: "ok"; provider: "google" | "microsoft"; busy: BusyInterval[] }
  | { status: "unavailable"; provider: "google" | "microsoft"; message: string };

function readCredentials(ciphertext: string | null): CalendarCredentials | null {
  if (!ciphertext) return null;
  try {
    const parsed = JSON.parse(decryptString(ciphertext)) as CalendarCredentials;
    if (!parsed.accessToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function usableCredentials(db: Db, connectionId: string, provider: "google" | "microsoft", credentials: CalendarCredentials) {
  if (new Date(credentials.expiresAt).getTime() > Date.now() + 60_000) return credentials;
  const refreshed = provider === "google" ? await refreshGoogleAccess(credentials) : await refreshMicrosoftAccess(credentials);
  if (!refreshed) {
    await db.calendarConnection.update({ where: { id: connectionId }, data: { status: "reconnect_required" } });
    return null;
  }
  await db.calendarConnection.update({
    where: { id: connectionId },
    data: { credentialCiphertext: encryptString(JSON.stringify(refreshed)), status: "connected" },
  });
  return refreshed;
}

export async function externalBusy(db: Db, userId: string, start: Date, end: Date): Promise<ExternalBusy> {
  const connections = await db.calendarConnection.findMany({
    where: { userId, status: "connected" },
  });
  const connection = connections.find((item) => item.provider === "google") ?? connections.find((item) => item.provider === "microsoft");
  if (!connection || (connection.provider !== "google" && connection.provider !== "microsoft")) return { status: "not_connected" };
  const stored = readCredentials(connection.credentialCiphertext);
  if (!stored) {
    await db.calendarConnection.update({ where: { id: connection.id }, data: { status: "reconnect_required" } });
    return { status: "unavailable", provider: connection.provider, message: "The calendar connection needs to be authorized again." };
  }
  const credentials = await usableCredentials(db, connection.id, connection.provider, stored);
  if (!credentials) return { status: "unavailable", provider: connection.provider, message: "The calendar connection needs to be authorized again." };
  if (connection.provider === "google") {
    const result = await googleFreeBusy(credentials.accessToken, start, end);
    if (!result.ok) return { status: "unavailable", provider: "google", message: "Google Calendar could not be rechecked. The request stays pending." };
    return { status: "ok", provider: "google", busy: parseGoogleFreeBusy(result.body) };
  }
  const email = connection.externalAccountEmail;
  if (!email) return { status: "unavailable", provider: "microsoft", message: "Microsoft 365 is connected without an account email, so availability was not checked." };
  const result = await microsoftFreeBusy(credentials.accessToken, email, start, end);
  if (!result.ok) return { status: "unavailable", provider: "microsoft", message: "Microsoft 365 could not be rechecked. The request stays pending." };
  return { status: "ok", provider: "microsoft", busy: parseMicrosoftSchedule(result.body) };
}

export async function createExternalEvent(
  db: Db,
  userId: string,
  event: { summary: string; start: Date; end: Date; description: string },
): Promise<{ provider: "internal" | "google" | "microsoft"; syncState: "not_connected" | "synced" | "failed"; externalEventId: string | null }> {
  const connections = await db.calendarConnection.findMany({ where: { userId, status: "connected" } });
  const connection = connections.find((item) => item.provider === "google") ?? connections.find((item) => item.provider === "microsoft");
  if (!connection || (connection.provider !== "google" && connection.provider !== "microsoft")) {
    return { provider: "internal", syncState: "not_connected", externalEventId: null };
  }
  const stored = readCredentials(connection.credentialCiphertext);
  const credentials = stored ? await usableCredentials(db, connection.id, connection.provider, stored) : null;
  if (!credentials) return { provider: connection.provider, syncState: "failed", externalEventId: null };
  const created = connection.provider === "google" ? await createGoogleEvent(credentials.accessToken, event) : await createMicrosoftEvent(credentials.accessToken, event);
  if (!created.ok) return { provider: connection.provider, syncState: "failed", externalEventId: null };
  return { provider: connection.provider, syncState: "synced", externalEventId: created.id };
}
