import Link from "next/link";
import {Check, ArrowLeft, ShieldCheck, Sparkles} from "lucide-react";
import {BILLING_PLANS} from "@/lib/domain/paid-access";

type Props={days:number;trialEndsAt:Date|null;timezone:string;paid:boolean;currentTier:string|null;unavailable:boolean;scheduledLabel:string|null};
export function NativeSubscription({days,trialEndsAt,timezone,paid,currentTier,unavailable,scheduledLabel}:Props){
 const trial=days>0;
 const end=trialEndsAt?new Intl.DateTimeFormat("en-US",{dateStyle:"medium",timeZone:timezone}).format(trialEndsAt):null;
 return <div className="mx-auto max-w-3xl space-y-5 pb-6">
  <section className="overflow-hidden rounded-3xl bg-[#10263e] p-5 text-white shadow-sm">
   <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#b5f4dd]"><Sparkles className="size-4"/>{trial?"Your Business trial":paid?"Your workspace plan":"Your workspace"}</div>
   <h2 className="mt-3 text-2xl font-semibold">{trial?`${days} ${days===1?"day":"days"} to explore everything`:paid?"Your subscription is active":"Your trial has ended"}</h2>
   <p className="mt-2 text-sm leading-6 text-slate-200">{trial?`All Business features are included${end?` through ${end}`:""}. Your accounts, routes and saved work stay together.`:paid?"Your existing subscription gives you access to your workspace.":"Your saved workspace is retained. Support and account settings remain available."}</p>
   {scheduledLabel?<p className="mt-3 rounded-xl bg-white/10 p-3 text-sm">{scheduledLabel}</p>:trial?<p className="mt-3 text-xs text-[#b5f4dd]">No card required for your 14-day trial.</p>:null}
  </section>
  <div><h2 className="text-lg font-semibold text-[#10263e]">Compare plans</h2><p className="mt-1 text-sm text-slate-500">Choose the tools that fit the way you work.</p></div>
  <section aria-label="Subscription plans" className="grid gap-4 sm:grid-cols-2">
   {(["individual","business"] as const).map(tier=>{
    const monthly=Object.values(BILLING_PLANS).find(p=>p.tier===tier&&p.interval==="month")!;
    const annual=Object.values(BILLING_PLANS).find(p=>p.tier===tier&&p.interval==="year")!;
    const business=tier==="business";
    const features=["Account maps & route planning","Visit check-ins & notes","Tasks & follow-ups","Internal calendar & visit preparation",...(business?["Lunch & Learns","Meeting requests","Reports & spending"]:[])];
    return <article key={tier} className={`rounded-3xl border bg-white p-5 ${business?"border-emerald-500 ring-1 ring-emerald-500":"border-slate-200"}`}>
     <div className="flex items-center justify-between gap-2"><h3 className="text-xl font-semibold text-[#10263e]">{business?"Business":"Individual"}</h3>{trial&&business?<span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">Included in trial</span>:paid&&currentTier===tier?<span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">Current plan</span>:null}</div>
     <p className="mt-2 text-sm text-slate-500">{business?"Your complete outreach workspace.":"Core tools for your daily territory."}</p>
     <p className="mt-5 text-3xl font-semibold tracking-tight text-[#10263e]">${monthly.cents/100}<span className="ml-1 text-sm font-normal text-slate-500">/ month</span></p>
     <p className="mt-2 text-sm text-slate-600">Or {annual.amount} <span className="font-medium text-emerald-700">· Save 2 months</span></p>
     <p className="mt-1 text-xs text-slate-400">USD · Plus applicable tax</p>
     <ul className="mt-5 space-y-3 text-sm text-slate-600">{features.map(feature=><li key={feature} className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0 text-emerald-600"/>{feature}</li>)}</ul>
     {!business?<p className="mt-4 border-t border-slate-100 pt-3 text-xs leading-5 text-slate-500">Lunch & Learns, meeting requests and reports are included with Business.</p>:null}
    </article>;
   })}
  </section>
  {unavailable?<p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm">We couldn’t refresh your subscription status. Your original trial dates and saved work are unchanged.</p>:null}
  <div className="flex items-start gap-2 rounded-2xl bg-slate-100 p-4 text-xs leading-5 text-slate-600"><ShieldCheck className="mt-0.5 size-4 shrink-0"/><p>Plan comparison only. Payments aren’t processed in this mobile companion. Viewing a plan does not authorize a charge or change your subscription.</p></div>
  {trial||paid?<Link href="/map" className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#10263e] px-4 text-sm font-semibold text-white"><ArrowLeft className="size-4"/>Back to workspace</Link>:null}
  <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm"><Link href="/support" className="min-h-11 py-3 font-medium underline underline-offset-4">Help & support</Link><Link href="/delete-account/confirm" className="min-h-11 py-3 text-slate-500 underline underline-offset-4">Account deletion</Link></div>
 </div>;
}
