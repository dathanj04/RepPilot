import Link from "next/link";
import { Compass } from "lucide-react";
import type { ReactNode } from "react";
import { LegalLinks } from "@/components/legal/public-page";

export function AuthLayout({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <main className="auth-screen flex min-h-dvh flex-col bg-[#f7f8fa] text-[#14243a]">
    <header className="flex items-center justify-between border-b border-slate-200/80 bg-white px-5 py-5 sm:px-10">
      <Link href="/login" aria-label="RepPilot sign in" className="inline-flex items-center gap-2.5 text-lg font-semibold tracking-tight"><span className="grid size-8 place-items-center rounded-lg bg-[#10263e] text-white"><Compass className="size-[19px]" aria-hidden="true" /></span>RepPilot</Link>
      <Link href="/support" className="inline-flex min-h-11 items-center text-sm text-slate-600 hover:text-slate-950">Help & support</Link>
    </header>
    <section className="flex flex-1 items-start justify-center px-5 py-10 sm:items-center sm:py-16">
      <div className="w-full max-w-[420px]">
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-8 shadow-[0_2px_6px_-3px_rgba(16,38,62,0.12)] sm:px-8">
          <h1 className="text-2xl font-semibold tracking-[-0.025em]">{title}</h1>
          <p className="mb-7 mt-2 text-sm leading-6 text-slate-500">{description}</p>
          {children}
        </div>
        <div className="mt-7 text-center text-xs text-slate-500"><LegalLinks /></div>
      </div>
    </section>
    <footer className="px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center text-xs text-slate-500">RepPilot · Territory management</footer>
  </main>;
}
