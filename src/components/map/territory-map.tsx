"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MapContainer, TileLayer, CircleMarker, Polygon, Tooltip, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { MARKER_TONES, type MarkerTone } from "@/lib/domain/catalog";
import { directionsUrl, formatStraightLine, straightLineMiles } from "@/lib/domain/distance";

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
  const [followUpOnly, setFollowUpOnly] = useState(false);
  const [maxMiles, setMaxMiles] = useState<number | null>(null);
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(10);
  const [focus, setFocus] = useState<[number, number] | null>(null);
  const [locationNote, setLocationNote] = useState<string | null>(null);

  const specialties = [...new Set(accounts.map((account) => account.specialty))];
  const filtered = accounts.filter((account) => {
    const text = `${account.name} ${account.city} ${account.specialty}`.toLowerCase();
    if (query && !text.includes(query.toLowerCase())) return false;
    if (tone !== "all" && account.tone !== tone) return false;
    if (specialty !== "all" && account.specialty !== specialty) return false;
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

  return (
    <div className="relative h-[calc(100dvh-8.5rem)] md:h-[calc(100dvh-3.5rem)]">
      <div className="absolute inset-x-3 top-3 z-20 space-y-2">
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

      {mode === "list" ? (
        <div className="h-full overflow-y-auto px-3 pt-28 pb-4">
          {filtered.length === 0 ? <p className="rounded-2xl bg-white p-4 text-sm">No offices match these filters.</p> : null}
          <ul className="space-y-2">
            {filtered.map((account) => (
              <li key={account.id}>
                <button type="button" className="w-full rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200" onClick={() => { setSelectedId(account.id); setMode("map"); if (account.lat != null && account.lng != null) setFocus([account.lat, account.lng]); }}>
                  <p className="font-medium">{account.name}</p>
                  <p className="text-sm text-[#66758B]">{account.specialty} · {account.city}</p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : googleMapsKey ? (
        <GoogleCanvas accounts={filtered} selectedId={selectedId} onSelect={setSelectedId} apiKey={googleMapsKey} center={focus ?? center} />
      ) : (
        <MapContainer center={center} zoom={10} className="h-full w-full" zoomControl={false}>
          <TileLayer attribution='&copy; OpenStreetMap &copy; CARTO' url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
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
      )}

      <div className="absolute right-3 bottom-3 z-20 flex flex-col gap-2">
        <button type="button" className="h-11 rounded-xl bg-white px-3 text-sm font-medium shadow-sm ring-1 ring-slate-200" onClick={locate}>
          My location
        </button>
      </div>
      {!googleMapsKey ? (
        <p className="absolute bottom-16 left-3 z-20 max-w-[16rem] rounded-xl bg-white/95 px-3 py-2 text-[11px] text-[#66758B] shadow-sm">
          Google Maps key is not configured. This territory uses OpenStreetMap. Distances are straight-line, not driving distance.
          {locationNote ? ` ${locationNote}` : ""}
          {missingLocation ? ` ${missingLocation} offices have no coordinates.` : ""}
        </p>
      ) : null}

      {selected ? (
        <div className="absolute inset-x-0 bottom-0 z-30 rounded-t-3xl bg-white p-4 shadow-2xl ring-1 ring-slate-200">
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
  );
}

function FilterChip({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`h-9 shrink-0 rounded-full px-3 text-xs font-medium ${active ? "bg-[#10263E] text-white" : "bg-white text-[#14243A] ring-1 ring-slate-200"}`}>
      {children}
    </button>
  );
}

function GoogleCanvas({ accounts, apiKey, center, onSelect, selectedId }: { accounts: MapAccount[]; apiKey: string; center: [number, number]; onSelect: (id: string) => void; selectedId: string | null }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const id = "google-maps-sdk";
    if (document.getElementById(id)) return;
    const script = document.createElement("script");
    script.id = id;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.async = true;
    script.onerror = () => setFailed(true);
    document.head.appendChild(script);
  }, [apiKey]);
  if (failed) return <p className="p-6 text-sm">Google Maps failed to load. Remove the key to use the OpenStreetMap fallback.</p>;
  return <GoogleMapInner accounts={accounts} center={center} onSelect={onSelect} selectedId={selectedId} />;
}

function GoogleMapInner({ accounts, center, onSelect, selectedId }: { accounts: MapAccount[]; center: [number, number]; onSelect: (id: string) => void; selectedId: string | null }) {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    const maps = (window as unknown as { google?: { maps: { Map: new (node: HTMLElement, options: object) => { setCenter: (value: object) => void }; Marker: new (options: object) => { addListener: (event: string, handler: () => void) => void } } } }).google;
    if (!node || !maps) return;
    const map = new maps.maps.Map(node, { center: { lat: center[0], lng: center[1] }, zoom: 11, disableDefaultUI: true, zoomControl: true });
    for (const account of accounts) {
      if (account.lat == null || account.lng == null) continue;
      const marker = new maps.maps.Marker({
        position: { lat: account.lat, lng: account.lng },
        map,
        title: account.name,
        label: selectedId === account.id ? "•" : undefined,
      });
      marker.addListener("click", () => onSelect(account.id));
    }
  }, [node, accounts, center, onSelect, selectedId]);
  return <div ref={setNode} className="h-full w-full" />;
}
