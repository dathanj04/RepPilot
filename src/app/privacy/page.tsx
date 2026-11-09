import Link from "next/link";
import { PublicPage } from "@/components/legal/public-page";
import { LEGAL_OPERATOR_NAME, SUPPORT_EMAIL, SUPPORT_MAILTO, DELETION_PROCESSING_DAYS } from "@/lib/legal";

export const metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return <PublicPage title="Privacy policy">
    <p>Updated November 8, 2026. RepPilot AI is operated by {LEGAL_OPERATOR_NAME}. Contact <a className="underline" href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a> about privacy, access, corrections, or deletion.</p>
    <section className="space-y-2"><h2 className="text-xl font-semibold">Information used by RepPilot</h2>
      <p>Account information includes your name, email, password hash, optional phone and job title, timezone, organization membership, and role. RepPilot also stores business records you or your organization enter: practice and business-contact details, visit notes, follow-ups, routes, appointments, lunch requests, meal-policy reviews, spending records, and uploaded receipts.</p>
      <p>Sessions, access logs, security audit records, and email-delivery metadata support sign-in, troubleshooting, and abuse prevention. Outgoing email bodies are not retained in delivery records by the current sender; older copies require the data-redaction migration to be applied.</p>
    </section>
    <section className="space-y-2"><h2 className="text-xl font-semibold">Location, speech, and local drafts</h2>
      <p>If you choose to share device location, it is used for territory maps, nearby practices, and route calculations. Visit coordinates can be stored when included with a check-in. You can decline location access and enter or select practices manually.</p>
      <p>Dictation uses speech recognition supported by your browser or device. Its provider may process audio outside RepPilot. You can type instead. Notes may be kept as a draft in browser storage until saved or removed; do not use a shared device for confidential drafts. Clearing browser storage removes local drafts but does not delete your RepPilot account.</p>
    </section>
    <section className="space-y-2"><h2 className="text-xl font-semibold">Service providers and optional integrations</h2>
      <p>Hosting and database providers process data needed to run the service. When configured, Resend receives recipients and message content to deliver operational email. Google Maps services or OpenStreetMap receive requests needed to display maps; configured Google Places, geocoding, and routing services receive search, address, or route information.</p>
      <p>If configured, Google Gemini receives text used to prepare briefings or conversation suggestions. AI output can be inaccurate and should be reviewed. Do not include patient information. Error-monitoring providers or configured operational webhooks may receive diagnostic messages.</p>
      <p>If you connect Google Calendar or Microsoft 365, RepPilot stores encrypted authorization tokens and uses the authorized calendar access for scheduling, availability checks, and event creation. You can disconnect in Calendar and revoke access in the provider account. Existing external calendar events are not automatically removed by disconnecting.</p>
      <p>Practice information is visible to authorized organization members according to the service’s access rules. Scheduling links share the relevant offered times and meeting details with recipients. Opening an external catering, navigation, or calendar website is subject to that provider’s practices. Salesforce and HubSpot referral connections and payment processing are not active features in this version.</p>
    </section>
    <section className="space-y-2"><h2 className="text-xl font-semibold">Retention and deletion</h2>
      <p>Account and organization records are kept while they are needed to provide the service. You can initiate account deletion in Settings or through the <Link href="/delete-account" className="underline">account-deletion page</Link>, including after uninstalling the app. Submitting a request does not mean deletion is already complete.</p>
      <p>Confirming your password removes your sign-in, profile, calendar connections, notifications, and AI records, and signs you out. Practice, visit, meeting, lunch, and spending records your organization keeps remain available to that organization. Your name on those records is replaced with Deleted user. Other members’ accounts are not deleted.</p>
      <p>Backup copies, and messages or events already held by an email or calendar provider, are cleared within {DELETION_PROCESSING_DAYS} days where that provider allows it. {SUPPORT_EMAIL} is the operator for that remaining cleanup. Contact support for the backup-retention schedule.</p>
    </section>
    <section className="space-y-2"><h2 className="text-xl font-semibold">Your choices and account security</h2>
      <p>You can edit your profile, change your password, decline optional device permissions, type instead of using speech, and disconnect calendar access. Contact support to request access to or correction of data you cannot change yourself. Use a unique password and do not share your sign-in details.</p>
      <p>RepPilot is a business outreach and scheduling tool. It is not intended for storing patient names, diagnoses, medical records, or other protected health information. Do not upload those details in notes or receipts. A warning or keyword check cannot guarantee that content contains no patient information.</p>
    </section>
    <section className="space-y-2"><h2 className="text-xl font-semibold">Changes and questions</h2><p>Changes to data practices will be reflected on this page with an updated date. Privacy questions and requests can be sent to <a className="underline" href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a>.</p></section>
  </PublicPage>;
}
