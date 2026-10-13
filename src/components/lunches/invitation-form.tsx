"use client";

import { useState } from "react";
import { createInvitationAction } from "@/lib/actions";
import { CATERING_PROVIDERS } from "@/lib/domain/catalog";

export function InvitationForm({
  accounts,
  defaultAccountId,
}: {
  accounts: { id: string; name: string; email: string; contact: string }[];
  defaultAccountId?: string;
  action?: typeof createInvitationAction;
}) {
  const [result, setResult] = useState<{ url?: string; emailStatus?: string; error?: string } | null>(null);
  const [accountId, setAccountId] = useState(defaultAccountId || accounts[0]?.id || "");
  const selected = accounts.find((account) => account.id === accountId);
  return (
    <form
      className="grid gap-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const response = await createInvitationAction(new FormData(event.currentTarget));
        if (!response.ok) setResult({ error: "error" in response ? response.error : "Invitation was not created." });
        else setResult({ url: response.url, emailStatus: response.emailStatus });
      }}
    >
      <label className="text-sm">Office
        <select name="accountId" value={accountId} onChange={(event) => setAccountId(event.target.value)} className="mt-1 h-11 w-full rounded-xl border px-3">
          {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
        </select>
      </label>
      <label className="text-sm">Educational purpose
        <textarea name="purpose" required defaultValue="Educational program overview for office staff." className="mt-1 w-full rounded-xl border p-3" rows={3} />
      </label>
      <label className="text-sm">Recipient name
        <input name="recipientName" defaultValue={selected?.contact} className="mt-1 h-11 w-full rounded-xl border px-3" />
      </label>
      <label className="text-sm">Recipient email
        <input name="recipientEmail" defaultValue={selected?.email} className="mt-1 h-11 w-full rounded-xl border px-3" />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-sm">Expected attendees<input name="expectedAttendees" type="number" min={1} defaultValue={8} className="mt-1 h-11 w-full rounded-xl border px-3" /></label>
        <label className="text-sm">Estimated budget ($)<input name="budget" type="number" min={0} step="0.01" className="mt-1 h-11 w-full rounded-xl border px-3" /></label>
      </div>
      <section className="rounded-2xl bg-[#F5F7FA] p-4 ring-1 ring-slate-200">
        <h2 className="font-semibold text-[#10263E]">Catering options</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {CATERING_PROVIDERS.filter((provider) => provider.live).map((provider) => (
            <a
              key={provider.id}
              href={provider.url}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-14 flex-col items-center justify-center rounded-xl bg-[#10263E] px-4 py-3 text-center text-white"
            >
              <span className="text-sm font-semibold">{provider.label}</span>
              <span className="mt-1 text-xs text-white/70">External ordering site</span>
            </a>
          ))}
        </div>
        <p className="mt-3 text-xs leading-5 text-[#66758B]">Ordering opens the provider’s website in a new tab. RepPilot does not place or pay for the order automatically.</p>
        <p className="mt-2 text-xs leading-5 text-[#66758B]">You can schedule the lunch first and record order details later from the lunch details page.</p>
      </section>
      <label className="text-sm">Link expires in
        <select name="expiryHours" defaultValue="48" className="mt-1 h-11 w-full rounded-xl border px-3">
          <option value="24">24 hours</option>
          <option value="48">48 hours</option>
          <option value="168">7 days</option>
        </select>
      </label>
      <p className="text-sm font-medium">Offered times</p>
      {[0, 1, 2].map((index) => (
        <div key={index} className="grid grid-cols-2 gap-2">
          <input type="date" name="slotDate" className="h-11 rounded-xl border px-3" />
          <input type="time" name="slotTime" defaultValue="12:00" className="h-11 rounded-xl border px-3" />
        </div>
      ))}
      <label className="text-sm">Meal preferences<input name="mealPreferences" className="mt-1 h-11 w-full rounded-xl border px-3" /></label>
      <label className="text-sm">Delivery instructions<input name="deliveryInstructions" className="mt-1 h-11 w-full rounded-xl border px-3" /></label>
      {result?.error ? <p className="text-sm text-[#D94B4B]">{result.error}</p> : null}
      {result?.url ? (
        <div className="rounded-xl bg-[#E7F8F3] p-3 text-sm">
          <p>{result.emailStatus === "sent" ? "Invitation email was sent." : "Email provider is not connected. The invitation was saved and the link is ready to copy."}</p>
          <a className="mt-2 block break-all underline" href={result.url}>{result.url}</a>
        </div>
      ) : null}
      <button className="h-12 rounded-xl bg-[#19B78A] font-semibold text-[#06281f]" type="submit">Create private invitation</button>
    </form>
  );
}
