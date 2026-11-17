"use client";
import { useState } from "react";

export function TrialCheckout({ enabled }: { enabled: boolean }) {
  const [pending, setPending] = useState<"individual" | "business" | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function start(plan: "individual" | "business") {
    setError(null);
    setPending(plan);
    try {
      const result = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await result.json() as { url?: string; error?: string };
      if (!result.ok || !data.url) throw new Error(data.error || "Checkout unavailable");
      window.location.assign(data.url);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not start checkout");
      setPending(null);
    }
  }
  return (
    <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <h2 className="font-semibold">Start your 14-day free trial</h2>
      <p className="mt-1 text-sm text-[#66758B]">
        Add a card securely with Stripe on your phone or computer. No subscription charge today.
        Your selected monthly plan begins after 14 days unless canceled before the trial ends.
        The full price and first payment date will appear in Stripe before you confirm.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        {(["individual", "business"] as const).map(plan => (
          <button key={plan} type="button" disabled={!enabled || pending !== null}
            onClick={() => start(plan)}
            className="min-h-12 flex-1 rounded-xl bg-[#10263E] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
            {pending === plan ? "Opening Stripe…" : `Choose ${plan === "individual" ? "Individual" : "Business"} trial`}
          </button>
        ))}
      </div>
      {!enabled ? <p className="mt-2 text-sm text-amber-700">Billing is not configured yet. No card can be collected.</p> : null}
      {error ? <p role="alert" className="mt-2 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
