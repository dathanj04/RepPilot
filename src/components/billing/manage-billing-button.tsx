"use client";
import { useState } from "react";

export function ManageBillingButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function openPortal() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      const data = await response.json() as { url?: string; error?: string };
      if (!response.ok || !data.url) throw new Error(data.error || "Billing portal unavailable");
      window.location.assign(data.url);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Billing portal unavailable");
      setPending(false);
    }
  }
  return <>
    <button type="button" onClick={openPortal} disabled={pending}
      className="mt-3 min-h-12 rounded-xl bg-[#10263E] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
      {pending ? "Opening billing…" : "Manage payment method or cancel subscription"}
    </button>
    {error ? <p role="alert" className="mt-2 text-sm text-red-700">{error}</p> : null}
  </>;
}
