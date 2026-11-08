import Link from "next/link";
import { PublicPage } from "@/components/legal/public-page";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/legal";

export const metadata = { title: "Support" };
export default function SupportPage() {
  return <PublicPage title="How can we help?">
    <p>For RepPilot sign-in, practice records, visits, scheduling, calendar connections, privacy, or technical help, email <a className="font-semibold underline" href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a>.</p>
    <section className="space-y-2"><h2 className="text-xl font-semibold">Help us find the issue</h2><p>Include your organization name, the screen involved, what you expected, and what happened. Share your device and browser version if relevant. Remove patient information, passwords, authentication links, and payment details from screenshots or messages.</p></section>
    <section className="space-y-2"><h2 className="text-xl font-semibold">Account and privacy requests</h2><p>Read the <Link href="/privacy" className="underline">privacy policy</Link> or <Link href="/delete-account" className="underline">request account deletion</Link>. You can use these pages in a browser without reinstalling RepPilot.</p></section>
    <section className="space-y-2"><h2 className="text-xl font-semibold">Catering and external providers</h2><p>RepPilot records coordination and spending information. It does not place or pay for catering orders or track delivery drivers. Contact the catering provider about an actual order or payment.</p></section>
  </PublicPage>;
}
