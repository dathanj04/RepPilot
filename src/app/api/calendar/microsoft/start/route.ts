import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { appUrl } from "@/lib/permissions";
import { microsoftAuthUrl, microsoftCalendarConfigured, signOAuthState } from "@/lib/calendar/oauth";

export async function GET() {
  const user = await getCurrentUser();
  if (!microsoftCalendarConfigured()) redirect("/calendar?notice=Microsoft 365 OAuth is not configured.");
  const state = signOAuthState({ userId: user.id, organizationId: user.organizationId, provider: "microsoft" });
  redirect(microsoftAuthUrl(state, `${appUrl()}/api/calendar/microsoft/callback`));
}
