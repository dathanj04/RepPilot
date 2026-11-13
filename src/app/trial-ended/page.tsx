import Link from "next/link";
import { connection } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/lib/actions";
import { SUPPORT_MAILTO, SUPPORT_EMAIL } from "@/lib/legal";
import { PublicPage } from "@/components/legal/public-page";

export const metadata = { title: "Your free trial" };
export const instant = false;

export default async function TrialPage() {
  await connection();
  const user = await getCurrentUser({ allowExpiredTrial: true });
  const expired = user.trialDaysLeft === 0;
  return <PublicPage title={expired ? "Your free trial has ended" : "Your RepPilot trial"}>
    <p>{user.organizationName}</p>
    <p>{expired ? "Your 14 days of free workspace access are complete. Contact us to arrange continued access. You have not been charged." : user.trialEndsAt ? `Your free access ends ${new Date(user.trialEndsAt).toISOString().replace("T", " at ").slice(0, 23)} UTC. No credit card is required and there is no automatic charge.` : "Your organization has an active subscription."}</p>
    <p>Ending your trial does not delete your account or organization records. You can still contact support, export your spending report, or request account deletion.</p>
    <div className="flex flex-wrap gap-3"><Link href="/billing" className="inline-flex min-h-12 items-center rounded-xl border px-5">Billing & subscription</Link>
      <a href={`${SUPPORT_MAILTO}?subject=RepPilot%20continued%20access`} className="inline-flex min-h-12 items-center rounded-xl bg-[#087f5b] px-5 font-semibold text-white">Contact {SUPPORT_EMAIL}</a>
      {!expired ? <Link href="/today" className="inline-flex min-h-12 items-center rounded-xl border px-5">Back to workspace</Link> : null}
    </div>
    <div className="flex flex-wrap gap-4 text-sm"><a href="/api/reports/spending" className="underline">Export spending report</a><Link href="/delete-account/confirm" className="underline">Request account deletion</Link></div>
    <form action={logoutAction}><button className="min-h-11 underline" type="submit">Sign out</button></form>
  </PublicPage>;
}
