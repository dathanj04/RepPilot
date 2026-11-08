"use client";

import { useState, useTransition } from "react";
import { clinicRespondAction } from "@/lib/actions";

function Feedback({ message, error }: { message: string | null; error: string | null }) {
  if (message) return <p className="rounded-xl bg-[#E7F8F3] px-3 py-3 text-sm">{message}</p>;
  if (error) return <p className="rounded-xl bg-[#FDECEC] px-3 py-3 text-sm text-[#D94B4B]">{error}</p>;
  return null;
}

export function InvitationResponse({
  token,
  slots,
}: {
  token: string;
  slots: { id: string; label: string }[];
}) {
  const [slotId, setSlotId] = useState(slots[0]?.id ?? "");
  const [name, setName] = useState("");
  const [catering, setCatering] = useState(false);
  const [attendees, setAttendees] = useState("8");
  const [dietary, setDietary] = useState("");
  const [delivery, setDelivery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (message) return <Feedback message={message} error={null} />;

  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        start(async () => {
          const response = await clinicRespondAction({
            token,
            intent: "accept",
            slotId,
            name,
            requestCatering: catering,
            attendees: catering ? Number(attendees) || undefined : undefined,
            dietary,
            deliveryInstructions: delivery,
          });
          if ("error" in response && response.error) setError(response.error);
          else if ("message" in response) setMessage(response.message ?? "Request sent. It is not confirmed until your representative approves it.");
        });
      }}
    >
      <fieldset className="grid gap-2">
        <legend className="sr-only">Offered times</legend>
        {slots.map((slot) => (
          <label key={slot.id} className="flex min-h-14 items-center gap-3 rounded-2xl bg-white px-4 ring-1 ring-slate-200">
            <input type="radio" name="slot" checked={slotId === slot.id} onChange={() => setSlotId(slot.id)} />
            <span className="text-sm font-medium">{slot.label}</span>
          </label>
        ))}
      </fieldset>
      <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name (optional)" className="h-12 rounded-xl border border-slate-200 bg-white px-3" />
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={catering} onChange={(event) => setCatering(event.target.checked)} />
        Request sponsored catering with this time. Catering is not ordered until your representative and a reviewer both approve it.
      </label>
      {catering ? (
        <div className="grid gap-2">
          <input value={attendees} onChange={(event) => setAttendees(event.target.value)} inputMode="numeric" aria-label="Estimated attendees" placeholder="Estimated attendees" className="h-12 rounded-xl border border-slate-200 bg-white px-3" />
          <input value={dietary} onChange={(event) => setDietary(event.target.value)} aria-label="Dietary notes" placeholder="Dietary notes, if you want to share them" className="h-12 rounded-xl border border-slate-200 bg-white px-3" />
          <input value={delivery} onChange={(event) => setDelivery(event.target.value)} aria-label="Delivery instructions" placeholder="Delivery instructions" className="h-12 rounded-xl border border-slate-200 bg-white px-3" />
        </div>
      ) : null}
      <button disabled={pending || !slotId} className="h-12 rounded-xl bg-[#19B78A] font-semibold text-[#06281f] disabled:opacity-50" type="submit">
        {pending ? "Sending…" : "Request this time"}
      </button>
      <Feedback message={null} error={error} />
    </form>
  );
}

export function ConfirmationResponse({
  token,
  defaultAttendees,
}: {
  token: string;
  defaultAttendees: number;
}) {
  const [name, setName] = useState("");
  const [attendees, setAttendees] = useState(String(defaultAttendees));
  const [change, setChange] = useState("");
  const [delivery, setDelivery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run(intent: "confirm" | "change") {
    setError(null);
    start(async () => {
      const response = await clinicRespondAction({
        token,
        intent,
        name,
        attendees: Number(attendees) || undefined,
        message: change,
        deliveryInstructions: delivery,
      });
      if ("error" in response && response.error) setError(response.error);
      else if ("message" in response) setMessage(response.message ?? "Thank you. The lunch is confirmed.");
    });
  }

  if (message) return <Feedback message={message} error={null} />;

  return (
    <div className="grid gap-3">
      <label className="grid gap-1 text-sm">
        Expected attendees
        <input value={attendees} onChange={(event) => setAttendees(event.target.value)} inputMode="numeric" className="h-12 rounded-xl border border-slate-200 bg-white px-3" />
      </label>
      <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name (optional)" className="h-12 rounded-xl border border-slate-200 bg-white px-3" />
      <input value={delivery} onChange={(event) => setDelivery(event.target.value)} aria-label="Delivery instructions" placeholder="Delivery instructions to share with your representative" className="h-12 rounded-xl border border-slate-200 bg-white px-3" />
      <button disabled={pending} className="h-12 rounded-xl bg-[#19B78A] font-semibold text-[#06281f] disabled:opacity-50" type="button" onClick={() => run("confirm")}>
        {pending ? "Saving…" : "Confirm lunch"}
      </button>
      <textarea value={change} onChange={(event) => setChange(event.target.value)} placeholder="Need a different date or headcount? Tell your representative." className="rounded-xl border border-slate-200 bg-white p-3 text-sm" rows={3} />
      <button disabled={pending || change.trim().length < 2} className="h-12 rounded-xl bg-white text-sm font-medium ring-1 ring-slate-200 disabled:opacity-50" type="button" onClick={() => run("change")}>
        Request a change
      </button>
      <Feedback message={null} error={error} />
    </div>
  );
}

export function OfficeRequest({ token }: { token: string }) {
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (result) return <Feedback message={result} error={null} />;

  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        start(async () => {
          const response = await clinicRespondAction({ token, intent: "request", message, name });
          if ("error" in response && response.error) setError(response.error);
          else if ("message" in response) setResult(response.message ?? null);
        });
      }}
    >
      <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name (optional)" className="h-12 rounded-xl border border-slate-200 bg-white px-3" />
      <textarea value={message} onChange={(event) => setMessage(event.target.value)} required minLength={2} placeholder="Request another educational visit, updated materials, or a callback." className="rounded-xl border border-slate-200 bg-white p-3 text-sm" rows={4} />
      <button disabled={pending} className="h-12 rounded-xl bg-[#10263E] font-medium text-white disabled:opacity-50" type="submit">
        {pending ? "Sending…" : "Send request"}
      </button>
      <p className="text-xs text-[#66758B]">This page cannot book a lunch. Your representative chooses the times that can be offered.</p>
      <Feedback message={null} error={error} />
    </form>
  );
}
