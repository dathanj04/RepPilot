import Link from "next/link";
import { connection } from "next/server";
import { PublicPage } from "@/components/legal/public-page";
import { DELETION_MAILTO, DELETION_OPERATOR_EMAIL, DELETION_PROCESSING_DAYS, SUPPORT_EMAIL } from "@/lib/legal";

export const instant = false;
export const metadata = { title: "Delete your account" };

export default async function DeleteAccountPage({ searchParams }: { searchParams: Promise<{ completed?: string }> }) {
  await connection();
  const { completed } = await searchParams;
  return <PublicPage title="Delete your RepPilot account">
    {completed === "1" ? <div role="status" className="space-y-2 rounded-xl bg-emerald-50 p-5 text-emerald-950">
      <h2 className="text-lg font-semibold">Account deletion completed</h2>
      <p>Your sign-in, profile, calendar connections, notifications, and AI records have been removed. You have been signed out. Practice, visit, meeting, and spending records stay with your organization under the name Deleted user.</p>
      <p>{DELETION_OPERATOR_EMAIL} finishes backup copies and data held by email or calendar providers within {DELETION_PROCESSING_DAYS} days, where those providers allow it.</p>
    </div> : null}
    <p>You can delete your RepPilot account and associated personal data from a browser, even if you have uninstalled the app.</p>
    <Link href="/delete-account/confirm" className="inline-flex min-h-12 items-center rounded-xl bg-[#10263E] px-5 font-semibold text-white">Sign in and delete your account</Link>
    <p>Sign in with your RepPilot account and confirm your password on the next screen. In the app, the same option is under Settings → Delete account. You do not need to call or email support when you can sign in.</p>
    <section className="space-y-2"><h2 className="text-xl font-semibold">If you cannot sign in</h2><p>Email <a className="underline" href={DELETION_MAILTO}>{SUPPORT_EMAIL}</a> with the subject “RepPilot account deletion request.” Include your account email and organization name. Do not send your password. {DELETION_OPERATOR_EMAIL} verifies ownership, then erases the account.</p></section>
    <section className="space-y-2"><h2 className="text-xl font-semibold">What is removed</h2><p>Confirming your password removes your sign-in, name, phone, job title, calendar credentials, notifications, and AI records. Organization business records you entered can remain for the other people in that organization, with your name replaced by Deleted user. Other members’ accounts are not deleted.</p><p>Backup copies and messages already accepted by an email or calendar provider are cleared within {DELETION_PROCESSING_DAYS} days where that provider allows it. Deleting RepPilot does not cancel an external subscription or remove events that were already created on an external calendar.</p></section>
  </PublicPage>;
}
