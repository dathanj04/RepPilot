"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { saveRouteAction, suggestRouteAction } from "@/lib/actions";
import { multiStopDirectionsUrl } from "@/lib/domain/distance";
import { computeDriveAction } from "@/lib/maps/actions";
import { formatDriveDuration, orderByStraightLine } from "@/lib/maps/provider";

type Office = { id: string; name: string; lat: number | null; lng: number | null };

type Stop = {
  accountId: string;
  name: string;
  reasons: string[];
  straightLineMiles: number | null;
  lat: number | null;
  lng: number | null;
};

type DriveView = {
  summary: string;
  trafficApplied: boolean;
  legs: { from: string; to: string; durationSeconds: number; distanceMeters: number }[];
};

export function RoutePlanner({
  saved,
  offices,
  savedSummary,
}: {
  saved: { name: string; reason: string; id: string }[];
  offices: Office[];
  savedSummary: string | null;
}) {
  const [stops, setStops] = useState<Stop[]>([]);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [drive, setDrive] = useState<DriveView | null>(null);
  const [pending, start] = useTransition();

  function clearDrive() {
    setDrive(null);
    setWarnings([]);
  }

  function suggest() {
    setMessage("");
    clearDrive();
    start(async () => {
      const origin = await currentLocation();
      const result = await suggestRouteAction(origin);
      setStops(
        result.recommendations.map((item) => {
          const office = offices.find((candidate) => candidate.id === item.accountId);
          return {
            accountId: item.accountId,
            name: item.name,
            reasons: item.reasons,
            straightLineMiles: item.straightLineMiles,
            lat: office?.lat ?? null,
            lng: office?.lng ?? null,
          };
        }),
      );
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
      setMessage("error" in result ? result.error ?? "The route was not saved." : "Route saved.");
    });
  }

  function checkDrive() {
    setMessage("");
    start(async () => {
      const origin = await currentLocation();
      const result = await computeDriveAction({
        origin,
        accountIds: stops.map((stop) => stop.accountId),
      });
      setWarnings(result.warnings);
      setMessage(result.message);
      setDrive(result.plan);
    });
  }

  function orderStraightLine() {
    clearDrive();
    start(async () => {
      const origin = await currentLocation();
      const order = orderByStraightLine(
        origin,
        stops.map((stop) => ({
          id: stop.accountId,
          location: stop.lat != null && stop.lng != null ? { lat: stop.lat, lng: stop.lng } : null,
        })),
      );
      setStops((current) => order.map((id) => current.find((stop) => stop.accountId === id)!).filter(Boolean));
      setMessage("Order follows straight-line distance from your location. This is not a traffic-aware route.");
    });
  }

  const navigation = multiStopDirectionsUrl(
    stops.flatMap((stop) => (stop.lat != null && stop.lng != null ? [{ lat: stop.lat, lng: stop.lng }] : [])),
  );
  const locatedCount = stops.filter((stop) => stop.lat != null && stop.lng != null).length;

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
          clearDrive();
          setStops((current) => [...current, { accountId: office.id, name: office.name, reasons: ["Added manually"], straightLineMiles: null, lat: office.lat, lng: office.lng }]);
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
      {warnings.map((warning) => (
        <p key={warning} className="rounded-xl bg-[#FFF6E8] px-3 py-2 text-sm text-[#10263E] ring-1 ring-[#F3B544]">{warning}</p>
      ))}
      {drive ? (
        <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <h2 className="text-sm font-semibold">Google Routes</h2>
          <p className="mt-1 text-sm">{drive.summary}. {drive.trafficApplied ? "Current traffic changed this duration." : "Current traffic did not change the no-traffic duration."}</p>
          <ul className="mt-2 space-y-1 text-sm text-[#66758B]">
            {drive.legs.map((leg) => (
              <li key={`${leg.from}-${leg.to}`}>{leg.from} to {leg.to}: {formatDriveDuration(leg.durationSeconds)}</li>
            ))}
          </ul>
        </section>
      ) : null}
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
                    <p className="text-xs text-[#66758B]">{stop.lat == null ? "Location is not on file, so distance is omitted." : "Added manually. Straight-line miles appear after a suggestion."}</p>
                  )}
                  <ul className="mt-2 list-disc pl-4 text-sm">
                    {stop.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                  </ul>
                </div>
                <div className="grid gap-1">
                  <button type="button" className="h-8 rounded-lg px-2 text-xs font-medium ring-1 ring-slate-200 disabled:opacity-40" onClick={() => move(index, -1)} disabled={index === 0}>Up</button>
                  <button type="button" className="h-8 rounded-lg px-2 text-xs font-medium ring-1 ring-slate-200 disabled:opacity-40" onClick={() => move(index, 1)} disabled={index === stops.length - 1}>Down</button>
                  <button type="button" className="h-8 rounded-lg px-2 text-xs font-medium text-[#D94B4B] ring-1 ring-slate-200" onClick={() => { clearDrive(); setStops((current) => current.filter((item) => item.accountId !== stop.accountId)); }}>Remove</button>
                </div>
              </div>
              <Link className="mt-2 inline-flex h-9 items-center text-sm font-medium text-[#10263E]" href={`/accounts/${stop.accountId}`}>Open account</Link>
            </li>
          ))}
        </ol>
      ) : null}
      {stops.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <button className="h-12 rounded-xl bg-white text-sm font-medium ring-1 ring-slate-200" type="button" disabled={pending} onClick={orderStraightLine}>
            Order by straight-line
          </button>
          <button className="h-12 rounded-xl bg-white text-sm font-medium ring-1 ring-slate-200" type="button" disabled={pending} onClick={checkDrive}>
            Check drive time
          </button>
          {navigation && locatedCount === stops.length ? (
            <a className="grid h-12 place-items-center rounded-xl bg-[#10263E] text-sm font-medium text-white" href={navigation} target="_blank" rel="noreferrer">
              Open in Google Maps
            </a>
          ) : (
            <p className="grid h-12 place-items-center rounded-xl bg-slate-100 px-3 text-center text-xs text-[#66758B]">Navigation needs coordinates for every stop.</p>
          )}
          <button className="h-12 rounded-xl bg-[#19B78A] font-semibold text-[#06281f]" type="button" disabled={pending} onClick={save}>
            Save route
          </button>
        </div>
      ) : null}
      {saved.length > 0 ? (
        <section>
          <h2 className="text-sm font-semibold">Last saved route</h2>
          {savedSummary ? <p className="mt-1 text-sm text-[#66758B]">{savedSummary}</p> : null}
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
    clearDrive();
    setStops((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      const [item] = next.splice(index, 1);
      if (!item) return current;
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
