"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MapContainer, TileLayer, CircleMarker, Polygon, Tooltip, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { MARKER_TONES, type MarkerTone } from "@/lib/domain/catalog";
import { directionsUrl, formatStraightLine, straightLineMiles } from "@/lib/domain/distance";
import { addDiscoveredAccountAction, searchPlacesAction } from "@/lib/maps/actions";

export type MapAccount = {
  id: string;
  name: string;
  specialty: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  lat: number | null;
  lng: number | null;
  tone: MarkerTone;
  lastVisit: string | null;
  daysSince: number | null;
  nextFollowUp: string | null;
  contact: string | null;
  status: string;
  territory: string | null;
  owner: string | null;
};

type Props = {
  accounts: MapAccount[];
  boundary: [number, number][] | null;
  googleMapsKey: string;
  center: [number, number];
};

const COLORS: Record<MarkerTone, string> = {
  recent: "#19B78A",
  follow_up: "#F3B544",
  overdue: "#D94B4B",
  steady: "#10263E",
  never: "#94A3B8",
};

function cluster(points: MapAccount[], zoom: number) {
  const located = points.filter((point): point is MapAccount & { lat: number; lng: number } => point.lat != null && point.lng != null);
  if (zoom >= 12) return located.map((point) => ({ id: point.id, lat: point.lat, lng: point.lng, members: [point] }));
  const size = zoom >= 10 ? 0.06 : 0.18;
  const groups = new Map<string, (MapAccount & { lat: number; lng: number })[]>();
  for (const point of located) {
    const key = `${Math.round(point.lat / size)}:${Math.round(point.lng / size)}`;
    groups.set(key, [...(groups.get(key) ?? []), point]);
  }
  return [...groups.entries()].map(([id, members]) => ({
    id,
    lat: members.reduce((sum, item) => sum + item.lat, 0) / members.length,
    lng: members.reduce((sum, item) => sum + item.lng, 0) / members.length,
    members,
  }));
}

function MapEvents({ onZoom }: { onZoom: (zoom: number) => void }) {
  const map = useMapEvents({
    zoomend: () => onZoom(map.getZoom()),
    moveend: () => onZoom(map.getZoom()),
  });
  return null;
}

function Recenter({ center }: { center: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, 13);
  }, [center, map]);
  return null;
}

export function TerritoryMap({ accounts, boundary, googleMapsKey, center }: Props) {
  const [mode, setMode] = useState<"map" | "list">("map");
  const [query, setQuery] = useState("");
  const [tone, setTone] = useState<MarkerTone | "all">("all");
  const [specialty, setSpecialty] = useState("all");
  const [city, setCity] = useState("all");
  const [zip, setZip] = useState("all");
  const [territory, setTerritory] = useState("all");
  const [owner, setOwner] = useState("all");
  const [status, setStatus] = useState("all");
  const [followUpOnly, setFollowUpOnly] = useState(false);
  const [maxMiles, setMaxMiles] = useState<number | null>(null);
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(10);
  const [focus, setFocus] = useState<[number, number] | null>(null);
  const [locationNote, setLocationNote] = useState<string | null>(null);
  const [googleFailed, setGoogleFailed] = useState(false);
  const failGoogle = useCallback(() => setGoogleFailed(true), []);

  const specialties = [...new Set(accounts.map((account) => account.specialty))];
  const cities = [...new Set(accounts.map((account) => account.city))].sort();
  const zips = [...new Set(accounts.map((account) => account.zip))].sort();
  const territories = [...new Set(accounts.map((account) => account.territory).filter((value): value is string => Boolean(value)))].sort();
  const owners = [...new Set(accounts.map((account) => account.owner).filter((value): value is string => Boolean(value)))].sort();
  const statuses = [...new Set(accounts.map((account) => account.status))].sort();
  const filtered = accounts.filter((account) => {
    const text = `${account.name} ${account.city} ${account.zip} ${account.specialty}`.toLowerCase();
    if (query && !text.includes(query.toLowerCase())) return false;
    if (tone !== "all" && account.tone !== tone) return false;
    if (specialty !== "all" && account.specialty !== specialty) return false;
    if (city !== "all" && account.city !== city) return false;
    if (zip !== "all" && account.zip !== zip) return false;
    if (territory !== "all" && account.territory !== territory) return false;
    if (owner !== "all" && account.owner !== owner) return false;
    if (status !== "all" && account.status !== status) return false;
    if (followUpOnly && account.tone !== "follow_up" && account.tone !== "overdue") return false;
    if (maxMiles != null && here && account.lat != null && account.lng != null) {
      if (straightLineMiles(here, { lat: account.lat, lng: account.lng }) > maxMiles) return false;
    }
    return true;
  });
  const groups = useMemo(() => cluster(filtered, zoom), [filtered, zoom]);
  const selected = filtered.find((account) => account.id === selectedId) ?? null;
  const missingLocation = filtered.filter((account) => account.lat == null).length;

  function locate() {
    if (!navigator.geolocation) {
      setLocationNote("Location permission is unavailable in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = { lat: position.coords.latitude, lng: position.coords.longitude };
        setHere(next);
        setFocus([next.lat, next.lng]);
        setLocationNote(null);
      },
      () => setLocationNote("Location permission was denied. Distances stay hidden."),
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }

  const list = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-2 border-b border-slate-200 p-3">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search offices"
          className="h-11 w-full rounded-xl border border-slate-200 bg-[#F5F7FA] px-3 text-sm"
          aria-label="Search offices"
        />
        <div className="flex flex-wrap gap-2">
          <FilterChip active={tone === "all"} onClick={() => setTone("all")}>All</FilterChip>
          {MARKER_TONES.map((item) => (
            <FilterChip key={item.id} active={tone === item.id} onClick={() => setTone(item.id)}>
              <span className="mr-1 inline-block size-2 rounded-full" style={{ background: item.color }} />
              {item.label}
            </FilterChip>
          ))}
          <FilterChip active={followUpOnly} onClick={() => setFollowUpOnly((value) => !value)}>Follow-up due</FilterChip>
          {specialties.map((item) => (
            <FilterChip key={item} active={specialty === item} onClick={() => setSpecialty(specialty === item ? "all" : item)}>{item}</FilterChip>
          ))}
          {[5, 15, 30].map((miles) => (
            <FilterChip key={miles} active={maxMiles === miles} onClick={() => setMaxMiles(maxMiles === miles ? null : miles)}>
              Within {miles} mi
            </FilterChip>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <SelectFilter label="City" value={city} onChange={setCity} options={cities} />
          <SelectFilter label="ZIP" value={zip} onChange={setZip} options={zips} />
          <SelectFilter label="Territory" value={territory} onChange={setTerritory} options={territories} />
          <SelectFilter label="Owner" value={owner} onChange={setOwner} options={owners} />
          <SelectFilter label="Status" value={status} onChange={setStatus} options={statuses} />
        </div>
        <PlacesSearch here={here} />
      </div>
      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {filtered.length === 0 ? <li className="rounded-2xl bg-[#F5F7FA] p-4 text-sm">No offices match these filters.</li> : null}
        {filtered.map((account) => (
          <li key={account.id}>
            <button
              type="button"
              className={`w-full rounded-2xl p-3 text-left ring-1 ${selectedId === account.id ? "bg-[#E7F8F3] ring-[#19B78A]" : "bg-white ring-slate-200"}`}
              onClick={() => {
                setSelectedId(account.id);
                setMode("map");
                if (account.lat != null && account.lng != null) setFocus([account.lat, account.lng]);
              }}
            >
              <p className="font-medium text-[#10263E]">{account.name}</p>
              <p className="text-sm text-[#66758B]">{account.specialty} · {account.city}</p>
              <p className="mt-1 text-xs text-[#66758B]">Last visit {account.lastVisit ?? "not yet"}</p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );

  const canvas = googleFailed || !googleMapsKey ? (
    <MapContainer center={center} zoom={10} className="h-full w-full" zoomControl={false}>
      <TileLayer attribution='&copy; OpenStreetMap' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <MapEvents onZoom={setZoom} />
      <Recenter center={focus} />
      {boundary ? <Polygon positions={boundary} pathOptions={{ color: "#19B78A", weight: 2, fillOpacity: 0.05 }} /> : null}
      {here ? <CircleMarker center={[here.lat, here.lng]} radius={8} pathOptions={{ color: "#10263E", fillColor: "#19B78A", fillOpacity: 1 }} /> : null}
      {groups.map((group) =>
        group.members.length > 1 ? (
          <CircleMarker
            key={group.id}
            center={[group.lat, group.lng]}
            radius={18}
            pathOptions={{ color: "#10263E", fillColor: "#10263E", fillOpacity: 0.9 }}
            eventHandlers={{ click: () => { setZoom(13); setFocus([group.lat, group.lng]); } }}
          >
            <Tooltip permanent direction="center" className="!border-0 !bg-transparent !shadow-none !text-white">{group.members.length}</Tooltip>
          </CircleMarker>
        ) : (
          <CircleMarker
            key={group.id}
            center={[group.lat, group.lng]}
            radius={selectedId === group.members[0]?.id ? 12 : 9}
            pathOptions={{ color: "#fff", weight: 2, fillColor: COLORS[group.members[0]!.tone], fillOpacity: 1 }}
            eventHandlers={{ click: () => setSelectedId(group.members[0]!.id) }}
          />
        ),
      )}
    </MapContainer>
  ) : (
    <GoogleCanvas accounts={filtered} selectedId={selectedId} onSelect={setSelectedId} apiKey={googleMapsKey} center={focus ?? center} onFail={failGoogle} />
  );

  return (
    <div className="flex h-full min-h-[32rem]">
      <aside className="hidden w-[22rem] shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col">{list}</aside>
      <div className="relative min-w-0 flex-1">
      <div className="absolute inset-x-3 top-3 z-20 space-y-2 rounded-2xl bg-white/95 p-2 shadow-sm md:hidden">
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search offices"
            className="h-11 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm"
            aria-label="Search offices"
          />
          <button type="button" className="h-11 rounded-xl bg-white px-3 text-sm font-medium shadow-sm ring-1 ring-slate-200" onClick={() => setMode(mode === "map" ? "list" : "map")}>
            {mode === "map" ? "List" : "Map"}
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <FilterChip active={tone === "all"} onClick={() => setTone("all")}>All</FilterChip>
          {MARKER_TONES.map((item) => (
            <FilterChip key={item.id} active={tone === item.id} onClick={() => setTone(item.id)}>
              <span className="mr-1 inline-block size-2 rounded-full" style={{ background: item.color }} />
              {item.label}
            </FilterChip>
          ))}
          <FilterChip active={followUpOnly} onClick={() => setFollowUpOnly((value) => !value)}>Follow-up due</FilterChip>
          {specialties.map((item) => (
            <FilterChip key={item} active={specialty === item} onClick={() => setSpecialty(specialty === item ? "all" : item)}>{item}</FilterChip>
          ))}
          {[5, 15, 30].map((miles) => (
            <FilterChip key={miles} active={maxMiles === miles} onClick={() => setMaxMiles(maxMiles === miles ? null : miles)}>
              Within {miles} mi
            </FilterChip>
          ))}
        </div>
      </div>

      {mode === "list" ? <div className="relative z-0 h-full bg-white pt-28 md:hidden">{list}</div> : <div className="relative z-0 h-full isolate">{canvas}</div>}

      <div className="absolute right-3 bottom-24 z-20 flex flex-col gap-2 md:bottom-3">
        <button type="button" className="h-11 rounded-xl bg-white px-3 text-sm font-medium shadow-sm ring-1 ring-slate-200" onClick={locate}>
          My location
        </button>
      </div>
      <p className="pointer-events-none absolute top-3 left-3 z-20 hidden max-w-sm rounded-xl bg-white/95 px-3 py-2 text-[11px] text-[#66758B] shadow-sm md:block">
        {googleMapsKey && !googleFailed ? "Google Maps" : "OpenStreetMap"} · pin distance is straight-line until Routes returns a drive time
        {locationNote ? ` · ${locationNote}` : ""}
        {missingLocation ? ` · ${missingLocation} offices have no coordinates` : ""}
      </p>

      {selected ? (
        <div className="absolute inset-x-0 bottom-0 z-50 max-h-[70dvh] overflow-y-auto rounded-t-3xl bg-white p-4 pb-6 shadow-2xl ring-1 ring-slate-200 md:inset-x-auto md:right-4 md:bottom-4 md:max-h-[80dvh] md:w-[22rem] md:rounded-3xl">
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200" />
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{selected.name}</h2>
              <p className="text-sm text-[#66758B]">{selected.street}, {selected.city}, {selected.state} {selected.zip}</p>
              <p className="text-sm">{selected.specialty}</p>
            </div>
            <button type="button" className="text-sm text-[#66758B]" onClick={() => setSelectedId(null)} aria-label="Close office card">Close</button>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div><dt className="text-[#66758B]">Last check-in</dt><dd>{selected.lastVisit ?? "Not yet visited"}</dd></div>
            <div><dt className="text-[#66758B]">Days since visit</dt><dd>{selected.daysSince ?? "—"}</dd></div>
            <div><dt className="text-[#66758B]">Next follow-up</dt><dd>{selected.nextFollowUp ?? "None scheduled"}</dd></div>
            <div><dt className="text-[#66758B]">Primary contact</dt><dd>{selected.contact ?? "Not on file"}</dd></div>
            <div className="col-span-2"><dt className="text-[#66758B]">Distance</dt><dd>{here && selected.lat != null && selected.lng != null ? formatStraightLine(straightLineMiles(here, { lat: selected.lat, lng: selected.lng })) : "Share location to see straight-line distance"}</dd></div>
          </dl>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link href={`/accounts/${selected.id}/check-in`} className="col-span-2 grid h-12 place-items-center rounded-xl bg-[#19B78A] font-semibold text-[#06281f]">Check In</Link>
            {selected.lat != null && selected.lng != null ? (
              <a className="grid h-11 place-items-center rounded-xl bg-[#10263E] text-sm font-medium text-white" href={directionsUrl({ lat: selected.lat, lng: selected.lng })} target="_blank" rel="noreferrer">Directions</a>
            ) : <span className="grid h-11 place-items-center rounded-xl bg-slate-100 text-sm">No coordinates</span>}
            <Link href={`/accounts/${selected.id}`} className="grid h-11 place-items-center rounded-xl ring-1 ring-slate-200 text-sm font-medium">View Account</Link>
            <Link href={`/lunches/new?account=${selected.id}`} className="col-span-2 grid h-11 place-items-center rounded-xl ring-1 ring-slate-200 text-sm font-medium">Schedule Lunch</Link>
          </div>
        </div>
      ) : null}
      </div>
    </div>
  );
}

function SelectFilter({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <label className="text-xs text-[#66758B]">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} aria-label={label} className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm text-[#14243A]">
        <option value="all">All</option>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function PlacesSearch({ here }: { here: { lat: number; lng: number } | null }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [places, setPlaces] = useState<Awaited<ReturnType<typeof searchPlacesAction>>["places"]>([]);
  const [pending, setPending] = useState(false);

  async function search() {
    setPending(true);
    setMessage(null);
    const result = await searchPlacesAction(query, here);
    setPlaces(result.places);
    setMessage(result.message);
    setPending(false);
  }

  return (
    <div className="rounded-xl bg-[#F5F7FA] p-2">
      <p className="text-xs font-medium text-[#10263E]">Find offices with Google Places</p>
      <div className="mt-2 flex gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Pediatric clinic, Frisco TX"
          aria-label="Places search"
          className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-sm"
        />
        <button type="button" className="h-10 rounded-lg bg-[#10263E] px-3 text-xs font-medium text-white disabled:opacity-50" disabled={pending} onClick={() => void search()}>
          {pending ? "Searching" : "Search"}
        </button>
      </div>
      {message ? <p className="mt-2 text-xs text-[#66758B]">{message}</p> : null}
      <ul className="mt-2 space-y-2">
        {places.map((place) => (
          <li key={`${place.name}-${place.zip}-${place.street}`} className="rounded-lg bg-white p-2 text-sm ring-1 ring-slate-200">
            <p className="font-medium">{place.name}</p>
            <p className="text-xs text-[#66758B]">{place.street}, {place.city}, {place.state} {place.zip}</p>
            <form
              className="mt-2 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                setPending(true);
                void addDiscoveredAccountAction(formData).then((result) => {
                  setPending(false);
                  if ("error" in result && result.error) {
                    setMessage(result.error);
                    return;
                  }
                  router.push(`/accounts/${result.accountId}`);
                  router.refresh();
                });
              }}
            >
              <input type="hidden" name="name" value={place.name} />
              <input type="hidden" name="street" value={place.street} />
              <input type="hidden" name="city" value={place.city} />
              <input type="hidden" name="state" value={place.state} />
              <input type="hidden" name="zip" value={place.zip} />
              <input type="hidden" name="latitude" value={place.lat} />
              <input type="hidden" name="longitude" value={place.lng} />
              <input name="specialty" required aria-label={`Specialty for ${place.name}`} placeholder="Specialty" className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 px-2 text-xs" />
              <button type="submit" className="h-9 rounded-lg bg-[#19B78A] px-2 text-xs font-semibold text-[#06281f]">Add</button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FilterChip({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`h-9 shrink-0 rounded-full px-3 text-xs font-medium ${active ? "bg-[#10263E] text-white" : "bg-white text-[#14243A] ring-1 ring-slate-200"}`}>
      {children}
    </button>
  );
}

function GoogleCanvas({ accounts, apiKey, center, onSelect, selectedId, onFail }: { accounts: MapAccount[]; apiKey: string; center: [number, number]; onSelect: (id: string) => void; selectedId: string | null; onFail: () => void }) {
  const [ready, setReady] = useState(() => typeof document !== "undefined" && Boolean(document.getElementById("google-maps-sdk")));
  useEffect(() => {
    const win = window as unknown as { gm_authFailure?: () => void };
    win.gm_authFailure = () => onFail();
    const id = "google-maps-sdk";
    if (document.getElementById(id)) return;
    const script = document.createElement("script");
    script.id = id;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
    script.async = true;
    script.onerror = () => onFail();
    script.onload = () => setReady(true);
    document.head.appendChild(script);
  }, [apiKey, onFail]);
  if (!ready) return <div className="grid h-full place-items-center bg-[#F5F7FA] text-sm text-[#66758B]">Loading Google Maps…</div>;
  return <GoogleMapInner accounts={accounts} center={center} onSelect={onSelect} selectedId={selectedId} />;
}

type GoogleMapsNamespace = {
  maps: {
    Map: new (node: HTMLElement, options: object) => { setCenter: (value: object) => void };
    Marker: new (options: object) => { setMap: (map: null) => void; addListener: (event: string, handler: () => void) => void };
    Size: new (width: number, height: number) => object;
  };
};

function GoogleMapInner({ accounts, center, onSelect, selectedId }: { accounts: MapAccount[]; center: [number, number]; onSelect: (id: string) => void; selectedId: string | null }) {
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<InstanceType<GoogleMapsNamespace["maps"]["Map"]> | null>(null);
  const markersRef = useRef<Array<{ setMap: (map: null) => void }>>([]);
  useEffect(() => {
    const maps = (window as unknown as { google?: GoogleMapsNamespace }).google;
    const node = nodeRef.current;
    if (!node || !maps) return;
    if (!mapRef.current) {
      mapRef.current = new maps.maps.Map(node, { center: { lat: center[0], lng: center[1] }, zoom: 11, disableDefaultUI: true, zoomControl: true, mapTypeControl: false });
    }
    mapRef.current.setCenter({ lat: center[0], lng: center[1] });
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];
    for (const account of accounts) {
      if (account.lat == null || account.lng == null) continue;
      const marker = new maps.maps.Marker({
        position: { lat: account.lat, lng: account.lng },
        map: mapRef.current,
        title: `${account.name} · ${account.specialty}`,
        icon: {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><circle cx="14" cy="14" r="${selectedId === account.id ? 10 : 8}" fill="${COLORS[account.tone]}" stroke="white" stroke-width="2"/></svg>`)}`,
          scaledSize: new maps.maps.Size(28, 28),
        },
      });
      marker.addListener("click", () => onSelect(account.id));
      markersRef.current.push(marker);
    }
  }, [accounts, center, onSelect, selectedId]);
  return <div ref={nodeRef} className="h-full w-full" />;
}
