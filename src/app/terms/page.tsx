import Link from "next/link";
import { PublicPage } from "@/components/legal/public-page";
import { LEGAL_OPERATOR_NAME, SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/legal";

export const metadata = { title: "RepPilot terms" };
export default function TermsPage() {
  return <PublicPage title="RepPilot terms">
    <p>RepPilot is operated by {LEGAL_OPERATOR_NAME}. These terms describe access to RepPilot and its subscriptions. Last updated November 13, 2026.</p>
    <h2 className="text-xl font-semibold">Free trial and workspace access</h2>
    <p>Your free trial lasts 14 days from workspace creation. No credit card is required, and the trial does not automatically charge you. After it ends, access to the app, workspace records, exports, and scheduling links requires a current paid subscription confirmed by Stripe. Billing, support, sign-out and account-deletion requests remain available. Ending access does not automatically erase your records.</p>
    <h2 className="text-xl font-semibold">Subscriptions and payments</h2>
    <p>The Business subscription is $58.65 per month or $591.60 per year, plus applicable tax. Review the plan, renewal interval and total in Stripe Checkout before confirming a purchase. A purchased subscription renews automatically at its selected interval until canceled. An unfinished checkout may resume its previously selected plan.</p>
    <p>For an individual workspace, the individual payer manages billing. For a shared workspace, its payer or organization owner manages the shared subscription. Only subscribe on behalf of a workspace you are authorized to pay for.</p>
    <h2 className="text-xl font-semibold">Cancellation and payment problems</h2>
    <p>Use Billing → Manage payment &amp; invoices to cancel future renewal, update payment details, or view invoices. Cancellation through the portal takes effect at the end of the paid period. App access ends when that period ends. Unpaid, past-due, paused or immediately canceled subscriptions do not provide paid app access. Contact support about billing mistakes, refund requests, or if you cannot reach the portal.</p>
    <h2 className="text-xl font-semibold">Your account and data</h2>
    <p>Keep your credentials private, use RepPilot lawfully, and upload only information you are authorized to use and share. See the <Link href="/privacy" className="underline">privacy policy</Link> for data handling and retention, or <Link href="/delete-account" className="underline">request account deletion</Link>.</p>
    <p>Questions or billing support: <a href={SUPPORT_MAILTO} className="underline">{SUPPORT_EMAIL}</a>.</p>
  </PublicPage>;
}
