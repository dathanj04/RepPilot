import Link from "next/link";
import type { ReactNode } from "react";
import { LEGAL_OPERATOR_NAME, SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/legal";

export function LegalLinks() {
  return <nav aria-label="Privacy and support" className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#66758B]">
    <Link className="underline underline-offset-4" href="/privacy">Privacy policy</Link>
    <Link className="underline underline-offset-4" href="/support">Support</Link>
    <Link className="underline underline-offset-4" href="/delete-account">Delete account</Link>
  </nav>;
}

export function PublicPage({ title, children }: { title: string; children: ReactNode }) {
  return <main className="mx-auto min-h-dvh max-w-3xl px-6 py-10 md:py-16">
    <Link href="/login" className="text-sm font-semibold tracking-wide text-[#087f5b]">RepPilot AI</Link>
    <h1 className="mt-6 text-3xl font-semibold tracking-tight text-[#10263E]">{title}</h1>
    <div className="mt-6 space-y-6 text-sm leading-7 text-[#14243A]">{children}</div>
    <footer className="mt-12 space-y-4 border-t border-slate-200 pt-6">
      <LegalLinks />
      <p className="text-xs leading-6 text-[#66758B]">{LEGAL_OPERATOR_NAME}<br /><a className="underline" href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a></p>
    </footer>
  </main>;
}
