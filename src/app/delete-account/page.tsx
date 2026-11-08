import Link from "next/link";
import { PublicPage } from "@/components/legal/public-page";
import { SUPPORT_EMAIL, DELETION_MAILTO } from "@/lib/legal";

export const metadata = { title: "Delete your account" };
export default function DeleteAccountPage() {
  return <PublicPage title="Delete your RepPilot account">
    <p>You can initiate deletion of your RepPilot account and associated personal data from a browser, even if you have uninstalled the app.</p>
    <Link href="/delete-account/confirm" className="inline-flex min-h-12 items-center rounded-xl bg-[#10263E] px-5 font-semibold text-white">Sign in and request deletion</Link>
    <p>Sign in with your RepPilot account and confirm your password on the next screen. In the app, the same option is under Settings → Delete account. You do not need to call or email support when you can sign in.</p>
    <section className="space-y-2"><h2 className="text-xl font-semibold">If you cannot sign in</h2><p>Email <a className="underline" href={DELETION_MAILTO}>{SUPPORT_EMAIL}</a> with the subject “RepPilot account deletion request.” Include your account email and organization name. Do not send your password. We will verify account ownership before deleting data.</p></section>
    <section className="space-y-2"><h2 className="text-xl font-semibold">What happens next</h2><p>The request is recorded for processing. It is not an instant deletion or account freeze. Review covers your account, associated personal data and content, connected-provider credentials, shared records, and provider-held copies. Other members’ accounts and data are not deleted simply because you request deletion.</p><p>We will explain any justified retention, the applicable completion timeframe, and confirm completion. Backup copies remain subject to their backup-retention schedule. Contact support for the current processing timeframe. Deleting RepPilot does not by itself cancel a subscription with an external provider or remove external calendar events.</p></section>
  </PublicPage>;
}
