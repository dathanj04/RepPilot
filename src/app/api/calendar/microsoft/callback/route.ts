import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encryptString } from "@/lib/domain/crypto";
import { appUrl } from "@/lib/permissions";
import { readOAuthState } from "@/lib/calendar/oauth";
import { exchangeMicrosoftCode } from "@/lib/calendar/microsoft";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  const url = new URL(request.url);
  const state = readOAuthState(url.searchParams.get("state") || "");
  const code = url.searchParams.get("code") || "";
  if (!state || state.userId !== user.id || state.organizationId !== user.organizationId || state.provider !== "microsoft" || !code) {
    redirect("/calendar?notice=Microsoft 365 authorization did not complete.");
  }
  const credentials = await exchangeMicrosoftCode(code, `${appUrl()}/api/calendar/microsoft/callback`);
  if (!credentials) redirect("/calendar?notice=Microsoft 365 did not return a token.");
  const profile = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${credentials.accessToken}` },
    cache: "no-store",
  });
  const me = profile.ok ? ((await profile.json()) as { mail?: string; userPrincipalName?: string }) : {};
  await prisma.calendarConnection.upsert({
    where: { userId_provider: { userId: user.id, provider: "microsoft" } },
    create: {
      organizationId: user.organizationId,
      userId: user.id,
      provider: "microsoft",
      status: "connected",
      externalAccountEmail: me.mail || me.userPrincipalName || null,
      credentialCiphertext: encryptString(JSON.stringify(credentials)),
    },
    update: {
      organizationId: user.organizationId,
      status: "connected",
      externalAccountEmail: me.mail || me.userPrincipalName || null,
      credentialCiphertext: encryptString(JSON.stringify(credentials)),
    },
  });
  redirect("/calendar?notice=Microsoft 365 connected. Busy time is read when you approve a meeting. Event titles are not shown to offices.");
}
