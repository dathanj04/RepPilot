"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { saveRouteAction, suggestRouteAction } from "@/lib/actions";

type Stop = {
  accountId: string;
  name: string;
  reasons: string[];
  straightLineMiles: number | null;
};

export function RoutePlanner({ saved, offices }: { saved: { name: string; reason: string; id: string }[]; offices: { id: string; name: string }[] }) {
  const [stops, setStops] = useState<Stop[]>([]);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();

  function suggest() {
    setMessage("");
    start(async () => {
      const origin = await currentLocation();
      const result = await suggestRouteAction(origin);
      setStops(result.recommendations);
      setNote(result.note);
      if (result.recommendations.length === 0) setMessage("No offices need a stop from the current records.");
    });
  }

  function save() {
    start(async () => {
      const result = await saveRouteAction({
        accountIds: stops.map((stop) => stop.accountId),
        reasons: Object.fromEntries(stops.map((stop) => [stop.accountId, stop.reasons.join(". ")])),
      });
      setMessage("error" in result ? result.error ?? "The route was not saved." : "Route saved. Driving time is still not estimated.");
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <button className="h-12 rounded-xl bg-[#10263E] font-medium text-white" type="button" disabled={pending} onClick={suggest}>
          {pending ? "Working…" : "Suggest stops from my records"}
        </button>
        <form className="flex gap-2" onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const accountId = String(data.get("accountId") || "");
          const office = offices.find((item) => item.id === accountId);
          if (!office || stops.some((stop) => stop.accountId === office.id)) return;
          setStops((current) => [...current, { accountId: office.id, name: office.name, reasons: ["Added manually"], straightLineMiles: null }]);
          event.currentTarget.reset();
        }}>
          <select name="accountId" aria-label="Add an office" className="h-12 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3" required>
            <option value="">Add an office</option>
            {offices.map((office) => <option key={office.id} value={office.id}>{office.name}</option>)}
          </select>
          <button className="h-12 rounded-xl bg-white px-4 text-sm font-medium ring-1 ring-slate-200" type="submit">Add</button>
        </form>
      </div>
      {note ? <p className="text-sm text-[#66758B]">{note}</p> : null}
      {message ? <p className="rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-slate-200">{message}</p> : null}
      {stops.length > 0 ? (
        <ol className="space-y-2">
          {stops.map((stop, index) => (
            <li key={stop.accountId} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{index + 1}. {stop.name}</p>
                  {stop.straightLineMiles != null ? (
                    <p className="text-xs text-[#66758B]">{stop.straightLineMiles.toFixed(1)} miles straight-line. This is not driving distance.</p>
                  ) : (
                    <p className="text-xs text-[#66758B]">Location is not on file, so distance is omitted.</p>
                  )}
                  <ul className="mt-2 list-disc pl-4 text-sm">
                    {stop.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                  </ul>
                </div>
                <div className="grid gap-1">
                  <button type="button" className="h-8 rounded-lg px-2 text-xs font-medium ring-1 ring-slate-200 disabled:opacity-40" onClick={() => move(index, -1)} disabled={index === 0}>Up</button>
                  <button type="button" className="h-8 rounded-lg px-2 text-xs font-medium ring-1 ring-slate-200 disabled:opacity-40" onClick={() => move(index, 1)} disabled={index === stops.length - 1}>Down</button>
                  <button type="button" className="h-8 rounded-lg px-2 text-xs font-medium text-[#D94B4B] ring-1 ring-slate-200" onClick={() => setStops((current) => current.filter((item) => item.accountId !== stop.accountId))}>Remove</button>
                </div>
              </div>
              <Link className="mt-2 inline-flex h-9 items-center text-sm font-medium text-[#10263E]" href={`/accounts/${stop.accountId}`}>Open account</Link>
            </li>
          ))}
        </ol>
      ) : null}
      {stops.length > 0 ? (
        <button className="h-12 w-full rounded-xl bg-[#19B78A] font-semibold text-[#06281f]" type="button" disabled={pending} onClick={save}>
          Save route
        </button>
      ) : null}
      {saved.length > 0 ? (
        <section>
          <h2 className="text-sm font-semibold">Last saved route</h2>
          <ol className="mt-2 space-y-2">
            {saved.map((stop, index) => (
              <li key={stop.id} className="rounded-xl bg-white p-3 text-sm ring-1 ring-slate-200">
                <p className="font-medium">{index + 1}. {stop.name}</p>
                <p className="text-[#66758B]">{stop.reason}</p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );

  function move(index: number, direction: -1 | 1) {
    setStops((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  }
}

function currentLocation() {
  return new Promise<{ lat: number; lng: number } | null>((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 4000 },
    );
  });
}
