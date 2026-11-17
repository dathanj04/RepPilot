"use client";

import { useState } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/brand";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  const [showLogin, setShowLogin] = useState(false);

  return (
    <main className="login-page flex min-h-dvh flex-col bg-white text-[#13243a]">
      <div className="flex flex-1 flex-col px-7 pb-5 pt-[max(3.5rem,env(safe-area-inset-top))] sm:px-10">
        <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col">
          {showLogin ? (
            <section className="flex flex-1 flex-col" aria-label="Sign in to RepPilot">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowLogin(false)}
                  className="-ml-2 min-h-11 rounded-xl px-2 text-sm font-semibold text-[#245c56] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  ← Back
                </button>
                <Link href="/support" className="inline-flex min-h-11 items-center text-sm text-slate-500">Help</Link>
              </div>
              <div className="mb-9 mt-7 flex items-center justify-center gap-3">
                <BrandMark className="size-12 rounded-2xl" />
                <span className="text-2xl font-bold tracking-[-0.05em]">RepPilot</span>
              </div>
              <h1 className="text-[30px] font-bold tracking-[-0.035em]">Welcome back</h1>
              <p className="mb-8 mt-2 text-sm leading-6 text-[#68788d]">
                Sign in to your field sales workspace.
              </p>
              <LoginForm />
              <Link href="/password-reset" className="mt-3 inline-flex min-h-11 items-center justify-center text-sm font-medium text-[#245c56] underline underline-offset-4">
                Forgot password?
              </Link>
            </section>
          ) : (
            <section className="flex flex-1 flex-col" aria-label="Welcome to RepPilot">
              <div className="flex flex-1 flex-col items-center justify-center pb-10 pt-3">
                <BrandMark className="size-28 rounded-[28px] shadow-[0_14px_36px_-18px_rgba(16,38,62,0.25)] sm:size-32" />
                <h1 className="mt-7 text-[42px] font-bold leading-tight tracking-[-0.065em] sm:text-5xl">
                  RepPilot
                </h1>
                <p className="mt-2 text-center text-sm font-medium tracking-wide text-[#748397]">
                  Healthcare field sales, simplified.
                </p>
              </div>
              <div className="space-y-3 pb-4">
                <button
                  type="button"
                  onClick={() => setShowLogin(true)}
                  className="flex min-h-[56px] w-full items-center justify-center rounded-[13px] bg-[#087f5b] px-5 text-[17px] font-semibold text-white transition-colors hover:bg-[#066e4f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#087f5b]"
                >
                  Log in
                </button>
                <Link
                  href="/signup"
                  className="flex min-h-[56px] w-full items-center justify-center rounded-[13px] bg-[#eef2f5] px-5 text-[17px] font-semibold text-[#344b62] transition-colors hover:bg-[#e1e9ee] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#087f5b]"
                >
                  Start free trial
                </Link>
              </div>
            </section>
          )}
          <nav aria-label="Privacy and support" className="mt-auto flex flex-col items-center gap-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-10 text-sm text-[#6f7e8c]">
            <Link href="/privacy" className="inline-flex min-h-9 items-center underline underline-offset-4">Privacy policy</Link>
            <Link href="/terms" className="inline-flex min-h-9 items-center underline underline-offset-4">Terms of use</Link>
            <Link href="/support" className="inline-flex min-h-9 items-center underline underline-offset-4">Help & support</Link>
            <span className="pt-1 text-xs text-[#98a3ae]">RepPilot · Your territory, in motion</span>
          </nav>
        </div>
      </div>
    </main>
  );
}
