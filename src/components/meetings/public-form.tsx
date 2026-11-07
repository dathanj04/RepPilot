"use client";

import { useState, useTransition } from "react";
import { schedulingPublicAction } from "@/lib/meetings/actions";

export function MeetingRequestForm({
  token,
  slots,
  officeName,
}: {
  token: string;
  slots: { id: string; label: string }[];
  officeName: string;
}) {
  const [slotId, setSlotId] = useState(slots[0]?.id ?? "");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [purpose, setPurpose] = useState("Introductory meeting with the care team.");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (message) return <p className="rounded-xl bg-[#E7F8F3] px-3 py-3 text-sm">{message}</p>;

  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        start(async () => {
          const response = await schedulingPublicAction({
            token,
            intent: "request",
            slotId,
            officeName,
            requesterName: name,
            requesterEmail: email,
            purpose,
          });
          if ("error" in response && response.error) setError(response.error);
          else if ("message" in response) setMessage(response.message ?? "Request sent.");
        });
      }}
    >
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">Offered times</legend>
        {slots.map((slot) => (
          <label key={slot.id} className="flex min-h-14 items-center gap-3 rounded-2xl bg-white px-4 ring-1 ring-slate-200">
            <input type="radio" name="slot" checked={slotId === slot.id} onChange={() => setSlotId(slot.id)} />
            <span className="text-sm font-medium">{slot.label}</span>
          </label>
        ))}
      </fieldset>
      <input value={name} onChange={(event) => setName(event.target.value)} required placeholder="Your name" aria-label="Your name" className="h-12 rounded-xl border border-slate-200 bg-white px-3" />
      <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="Work email (optional)" aria-label="Work email" className="h-12 rounded-xl border border-slate-200 bg-white px-3" />
      <textarea value={purpose} onChange={(event) => setPurpose(event.target.value)} required aria-label="Meeting purpose" className="rounded-xl border border-slate-200 bg-white p-3 text-sm" rows={3} />
      <button disabled={pending || !slotId} className="h-12 rounded-xl bg-[#19B78A] font-semibold text-[#06281f] disabled:opacity-50" type="submit">
        {pending ? "Sending…" : "Request this time"}
      </button>
      <p className="text-xs text-[#66758B]">Requesting a time does not confirm the representative&apos;s calendar.</p>
      {error ? <p className="rounded-xl bg-[#FDECEC] px-3 py-3 text-sm text-[#D94B4B]">{error}</p> : null}
    </form>
  );
}

export function ReplacementRequestForm({ token }: { token: string }) {
  const [officeName, setOfficeName] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (message) return <p className="rounded-xl bg-[#E7F8F3] px-3 py-3 text-sm">{message}</p>;
  return (
    <form
      className="mt-4 grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        start(async () => {
          const response = await schedulingPublicAction({ token, intent: "replacement", officeName, note });
          if ("error" in response && response.error) setError(response.error);
          else if ("message" in response) setMessage(response.message ?? "Your representative was notified.");
        });
      }}
    >
      <input value={officeName} onChange={(event) => setOfficeName(event.target.value)} required placeholder="Office name" aria-label="Office name" className="h-12 rounded-xl border border-slate-200 bg-white px-3" />
      <textarea value={note} onChange={(event) => setNote(event.target.value)} required placeholder="What would you like to schedule?" aria-label="Request note" className="rounded-xl border border-slate-200 bg-white p-3 text-sm" rows={3} />
      <button disabled={pending} className="h-12 rounded-xl bg-[#10263E] font-medium text-white" type="submit">{pending ? "Sending…" : "Request a new invitation"}</button>
      {error ? <p className="text-sm text-[#D94B4B]">{error}</p> : null}
    </form>
  );
}

export function AcceptProposalForm({ token }: { token: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (message) return <p className="rounded-xl bg-[#E7F8F3] px-3 py-3 text-sm">{message}</p>;
  return (
    <div className="mt-4 grid gap-3">
      <button
        type="button"
        disabled={pending}
        className="h-12 rounded-xl bg-[#19B78A] font-semibold text-[#06281f]"
        onClick={() => {
          start(async () => {
            const response = await schedulingPublicAction({ token, intent: "accept_proposal" });
            if ("error" in response && response.error) setError(response.error);
            else if ("message" in response) setMessage(response.message ?? "Confirmed.");
          });
        }}
      >
        {pending ? "Checking…" : "Accept proposed time"}
      </button>
      {error ? <p className="text-sm text-[#D94B4B]">{error}</p> : null}
    </div>
  );
}
