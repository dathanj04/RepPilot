import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encryptString } from "@/lib/domain/crypto";
import { appUrl } from "@/lib/permissions";
import { readOAuthState } from "@/lib/calendar/oauth";
import { exchangeGoogleCode } from "@/lib/calendar/google";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  const url = new URL(request.url);
  const state = readOAuthState(url.searchParams.get("state") || "");
  const code = url.searchParams.get("code") || "";
  if (!state || state.userId !== user.id || state.organizationId !== user.organizationId || state.provider !== "google" || !code) {
    redirect("/calendar?notice=Google Calendar authorization did not complete.");
  }
  const credentials = await exchangeGoogleCode(code, `${appUrl()}/api/calendar/google/callback`);
  if (!credentials) redirect("/calendar?notice=Google Calendar did not return a token.");
  await prisma.calendarConnection.upsert({
    where: { userId_provider: { userId: user.id, provider: "google" } },
    create: {
      organizationId: user.organizationId,
      userId: user.id,
      provider: "google",
      status: "connected",
      credentialCiphertext: encryptString(JSON.stringify(credentials)),
    },
    update: {
      organizationId: user.organizationId,
      status: "connected",
      credentialCiphertext: encryptString(JSON.stringify(credentials)),
    },
  });
  redirect("/calendar?notice=Google Calendar connected. Busy time is read when you approve a meeting. Event titles from Google are not shown to offices.");
}
