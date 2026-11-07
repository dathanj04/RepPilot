import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { appUrl } from "@/lib/permissions";
import { googleAuthUrl, googleCalendarConfigured, signOAuthState } from "@/lib/calendar/oauth";

export async function GET() {
  const user = await getCurrentUser();
  if (!googleCalendarConfigured()) redirect("/calendar?notice=Google Calendar OAuth is not configured.");
  const state = signOAuthState({ userId: user.id, organizationId: user.organizationId, provider: "google" });
  redirect(googleAuthUrl(state, `${appUrl()}/api/calendar/google/callback`));
}
