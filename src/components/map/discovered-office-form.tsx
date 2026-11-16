"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addDiscoveredAccountAction } from "@/lib/maps/actions";
import type { PlaceCandidate } from "@/lib/maps/provider";
import { suggestedSpecialty } from "@/lib/maps/discovery";

export function DiscoveredOfficeForm({ place, query, savedId, onSaved }: { place: PlaceCandidate; query: string; savedId?: string; onSaved: (place: PlaceCandidate, id: string) => void }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (savedId) return <p role="status" className="mt-2 text-sm font-medium text-emerald-800">Added to your accounts · <Link className="underline" href={`/accounts/${savedId}`}>View account</Link></p>;
  return <form className="mt-3 space-y-2" onSubmit={async event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending(true); setError(null);
    try {
      const result = await addDiscoveredAccountAction(data);
      if (result.error) { setError(result.error); return; }
      if (result.accountId) { onSaved(place, result.accountId); router.refresh(); }
      else setError(result.error || "This office could not be added.");
    } catch { setError("Could not add this office. Please try again."); }
    finally { setPending(false); }
  }}>
    {Object.entries({ name: place.name, street: place.street, city: place.city, state: place.state, zip: place.zip, latitude: place.lat, longitude: place.lng }).map(([key,value]) => <input key={key} type="hidden" name={key} value={value} />)}
    <label className="block text-xs text-slate-600">Specialty<input name="specialty" defaultValue={suggestedSpecialty(query, place.name)} required maxLength={120} aria-label={`Specialty for ${place.name}`} className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-2 text-sm" /></label>
    <button type="submit" disabled={pending} className="min-h-11 w-full rounded-lg bg-[#087f5b] px-3 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Adding…" : "Add to my accounts"}</button>
    {error ? <p role="alert" className="text-xs text-red-700">{error}</p> : null}
  </form>;
}
