"use client";

import { useState } from "react";
import { createSchedulingInvitationAction } from "@/lib/meetings/actions";

export function SchedulingInvitationForm({
  accounts,
  allowedHours,
}: {
  accounts: { id: string; name: string }[];
  allowedHours: number[];
}) {
  const [result, setResult] = useState<{ url?: string; error?: string } | null>(null);
  const hours = allowedHours.length > 0 ? allowedHours : [24];
  return (
    <form
      className="grid max-w-xl gap-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const response = await createSchedulingInvitationAction(new FormData(event.currentTarget));
        if (!response.ok) setResult({ error: "error" in response ? response.error : "The invitation was not created." });
        else setResult({ url: response.url });
      }}
    >
      <label className="text-sm">Office, if this link is for one account
        <select name="accountId" className="mt-1 h-11 w-full rounded-xl border px-3">
          <option value="">Any office that receives the link</option>
          {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
        </select>
      </label>
      <label className="text-sm">Link lifetime
        <select name="lifetimeHours" defaultValue={hours.includes(24) ? "24" : String(hours[0])} className="mt-1 h-11 w-full rounded-xl border px-3">
          {hours.map((value) => <option key={value} value={value}>{value === 168 ? "7 days" : `${value} hours`}</option>)}
        </select>
      </label>
      <p className="text-sm font-medium">Times the office may request</p>
      {[0, 1, 2].map((index) => (
        <div key={index} className="grid grid-cols-2 gap-2">
          <input type="date" name="slotDate" aria-label={`Date ${index + 1}`} className="h-11 rounded-xl border px-3" />
          <input type="time" name="slotTime" aria-label={`Time ${index + 1}`} defaultValue="09:00" className="h-11 rounded-xl border px-3" />
        </div>
      ))}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="publicContact" defaultChecked />
        Show my name and email if the link expires
      </label>
      <button className="h-12 rounded-xl bg-[#10263E] font-medium text-white" type="submit">Create invitation</button>
      {result?.error ? <p className="rounded-xl bg-[#FDECEC] px-3 py-2 text-sm text-[#D94B4B]">{result.error}</p> : null}
      {result?.url ? (
        <p className="rounded-xl bg-[#E7F8F3] px-3 py-2 text-sm break-all">
          Send this single-use link: <a className="font-medium underline" href={result.url}>{result.url}</a>
        </p>
      ) : null}
    </form>
  );
}
