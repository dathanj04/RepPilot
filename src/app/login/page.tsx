import { Compass, ArrowUpRight, MapPin, Sparkles } from "lucide-react";
import { LegalLinks } from "@/components/legal/public-page";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="login-page min-h-dvh lg:grid lg:grid-cols-2">
      <section className="login-intro relative isolate flex flex-col justify-between overflow-hidden bg-[#10263e] px-6 pb-12 pt-[max(1.75rem,env(safe-area-inset-top))] text-white sm:px-10 lg:min-h-dvh lg:px-16 lg:py-12">
        <div aria-hidden="true" className="pointer-events-none absolute -right-28 -top-32 -z-10 size-96 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-[#b5f4dd] text-[#10263e]"><Compass className="size-6" aria-hidden="true" /></span>
          <span className="text-2xl font-semibold tracking-tight">RepPilot<span className="ml-2 rounded-md border border-white/20 px-1.5 py-0.5 align-middle text-[10px] font-medium tracking-widest text-[#b5f4dd]">AI</span></span>
        </div>
        <div className="max-w-lg pb-2 pt-10 lg:py-16">
          <p className="mb-4 flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-[#b5f4dd]"><Sparkles className="size-3.5" aria-hidden="true" /> YOUR DAY. IN FOCUS.</p>
          <h1 className="text-[clamp(2rem,8vw,2.75rem)] font-semibold leading-[1.12] tracking-[-0.045em] lg:text-6xl">More relationships.<br /><span className="text-[#b5f4dd]">Less busywork.</span></h1>
          <p className="mt-4 max-w-sm text-sm leading-6 text-slate-300 lg:text-base">Your practices, visits, and next conversations. All in one place, wherever the day takes you.</p>
          <div className="mt-6 flex items-center gap-2 text-xs text-white/75"><MapPin className="size-4 text-[#b5f4dd]" aria-hidden="true" /> Built for life in the field <ArrowUpRight className="size-3.5" aria-hidden="true" /></div>
        </div>
        <p className="hidden max-w-sm text-xs leading-5 text-slate-400 lg:block">Reps control relationships. Clinics control convenience. RepPilot handles coordination.</p>
      </section>
      <section className="login-panel relative z-10 mx-3 -mt-5 rounded-t-[2rem] bg-white px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-8 shadow-[0_-8px_40px_-20px_rgba(16,38,62,0.25)] sm:mx-6 sm:px-10 lg:m-0 lg:flex lg:items-center lg:justify-center lg:rounded-none lg:px-12 lg:py-16 lg:shadow-none">
        <div className="mx-auto w-full max-w-md">
          <p className="mb-2 text-[10px] font-semibold tracking-[0.18em] text-[#087f5b]">WELCOME BACK</p>
          <h2 className="text-[1.75rem] font-semibold tracking-[-0.035em] text-[#10263e]">Ready for a great day?</h2>
          <p className="mb-7 mt-2 text-sm leading-6 text-slate-500">Sign in to your field workspace.</p>
          <LoginForm />
          <div className="mt-8 border-t border-slate-100 pt-5 text-center"><LegalLinks /></div>
        </div>
      </section>
    </main>
  );
}
