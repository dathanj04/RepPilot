"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { matchesZipFilter, validZipFilter } from "@/lib/maps/zip-filter";
import { useRouter } from "next/navigation";
import { LassoLayer } from "./lasso-layer";
import { insideLasso, type MapPoint } from "@/lib/maps/lasso";
import { optimizeRouteAction } from "@/lib/maps/route-actions";
import { ArrowUpRight, MapPin, Route, SlidersHorizontal } from "lucide-react";
import { MapContainer, TileLayer, CircleMarker, Circle, Polygon, Tooltip, Popup, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { MARKER_TONES, type MarkerTone } from "@/lib/domain/catalog";
import { findAccurateLocation, locationAccuracy } from "@/lib/maps/location";
import type { PlaceCandidate } from "@/lib/maps/provider";
import type { SearchArea } from "@/lib/maps/search-area";
import { directionsUrl, formatStraightLine, straightLineMiles } from "@/lib/domain/distance";
import { DiscoveredOfficeForm } from "./discovered-office-form";
import { discoveryKey } from "@/lib/maps/discovery";
import { searchPlacesAction } from "@/lib/maps/actions";

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
  tomtomMapsKey: string;
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

function MapEvents({ onZoom, onArea }: { onZoom: (zoom: number) => void; onArea: (area: SearchArea) => void }) {
  const map = useMap();
  const update = useCallback(() => {
    onZoom(map.getZoom());
    const bounds = map.getBounds();
    onArea({ north: Math.min(90, bounds.getNorth()), south: Math.max(-90, bounds.getSouth()), east: Math.min(180, bounds.getEast()), west: Math.max(-180, bounds.getWest()) });
  }, [map, onZoom, onArea]);
  useMapEvents({ zoomend: update, moveend: update });
  useEffect(() => { update(); }, [update]);
  return null;
}

function Recenter({ center, accuracy }: { center: [number, number] | null; accuracy?: number }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, accuracy == null ? 13 : accuracy > 10000 ? 8 : accuracy > 1000 ? 10 : accuracy > 200 ? 13 : 16);
  }, [center, accuracy, map]);
  return null;
}

export function TerritoryMap({ accounts, boundary, googleMapsKey, tomtomMapsKey, center }: Props) {
  const [discoveryQuery, setDiscoveryQuery] = useState("");
  const [savedDiscoveries, setSavedDiscoveries] = useState<Record<string,string>>({});
  const markSaved = useCallback((place: PlaceCandidate, id: string) => { setSavedDiscoveries(prev => ({ ...prev, [discoveryKey(place)]: id })); }, []);
  const [discovered, setDiscovered] = useState<PlaceCandidate[]>([]);
  const [searchArea, setSearchArea] = useState<SearchArea | null>(null);
  const [mode, setMode] = useState<"map" | "list">("map");
  const [query, setQuery] = useState("");
  const [tone, setTone] = useState<MarkerTone | "all">("all");
  const [specialty, setSpecialty] = useState("all");
  const [city, setCity] = useState("all");
  const [zip, setZip] = useState("");
  const [territory, setTerritory] = useState("all");
  const [owner, setOwner] = useState("all");
  const [status, setStatus] = useState("all");
  const router = useRouter();
  const [accountsMinimized, setAccountsMinimized] = useState(false);
  const [lasso, setLasso] = useState(false);
  const [routing, setRouting] = useState(false);
  const [routeNote, setRouteNote] = useState("");
  const cancelLasso = useCallback(() => setLasso(false), []);
  const [followUpOnly, setFollowUpOnly] = useState(false);
  const [maxMiles, setMaxMiles] = useState<number | null>(null);
  const [here, setHere] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const cancelLocation = useRef<(() => void) | null>(null);
  useEffect(() => () => cancelLocation.current?.(), []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const receivePlaces = useCallback((places: PlaceCandidate[], searchQuery = "") => { setDiscoveryQuery(searchQuery); setDiscovered(places); setMode("map"); setSelectedId(null); }, []);
  const [zoom, setZoom] = useState(10);
  const [focus, setFocus] = useState<[number, number] | null>(null);
  const [locationNote, setLocationNote] = useState<string | null>(null);
  const [showTraffic, setShowTraffic] = useState(false);
  const [tomtomFailed, setTomtomFailed] = useState(false);
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
    if (!matchesZipFilter(account.zip, zip)) return false;
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
    cancelLocation.current?.();
    setHere(null);
    setSelectedId(null);
    setLocating(true);
    setLocationNote("Finding a fresh, precise location…");
    setMode("map");
    cancelLocation.current = findAccurateLocation(navigator.geolocation, next => {
      setHere(next);
      setFocus([next.lat, next.lng]);
      setLocationNote(locationAccuracy(next.accuracy));
    }, error => {
      setLocating(false);
      if (error) { setHere(null); setLocationNote(error); }
    });
  }

  const list = (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <div className="shrink-0 space-y-4 border-b border-slate-200/80 p-5">
        <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-semibold tracking-[0.18em] text-[#66758B]">FIELD WORKSPACE</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#10263E]">My territory</h1></div><Link href="/route" aria-label="Open route planner" className="grid size-11 place-items-center rounded-xl bg-[#10263E] text-white"><Route className="size-5" aria-hidden="true" /></Link></div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter saved accounts"
          className="h-11 w-full rounded-xl border border-slate-200 bg-[#F5F7FA] px-3 text-sm"
          aria-label="Filter saved accounts"
        />
        <ZipFilter value={zip} onChange={setZip} options={zips} />
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
        <details className="group rounded-xl border border-slate-200 bg-slate-50/60 p-3"><summary className="flex min-h-8 cursor-pointer items-center gap-2 text-xs font-semibold text-[#10263E]"><SlidersHorizontal className="size-4" aria-hidden="true" /> More filters</summary><div className="mt-3 grid grid-cols-2 gap-3">
          <SelectFilter label="City" value={city} onChange={setCity} options={cities} />

          <SelectFilter label="Territory" value={territory} onChange={setTerritory} options={territories} />
          <SelectFilter label="Owner" value={owner} onChange={setOwner} options={owners} />
          <SelectFilter label="Status" value={status} onChange={setStatus} options={statuses} />
        </div>
        </details>
        <PlacesSearch here={here} area={searchArea} onResults={receivePlaces} saved={savedDiscoveries} onSaved={markSaved} />
      </div>
      <p aria-live="polite" className="border-b border-slate-100 px-5 py-3 text-xs font-medium text-[#66758B]">Saved accounts: {filtered.length} of {accounts.length} practices</p>
      <ul className="shrink-0 space-y-2 bg-slate-50/50 p-3">
        {filtered.length === 0 ? <li className="rounded-2xl bg-[#F5F7FA] p-4 text-sm">No offices match these filters.</li> : null}
        {filtered.map((account) => (
          <li key={account.id}>
            <button
              type="button"
              aria-pressed={selectedId === account.id}
              className={`w-full rounded-2xl p-4 text-left ring-1 transition-colors ${selectedId === account.id ? "bg-[#E7F8F3] ring-[#19B78A]" : "bg-white ring-slate-200 hover:bg-slate-50"}`}
              onClick={() => {
                setSelectedId(account.id);
                setMode("map");
                if (account.lat != null && account.lng != null) setFocus([account.lat, account.lng]);
              }}
            >
              <div className="mb-2 flex items-center gap-2"><MapPin className="size-4 shrink-0" style={{ color: COLORS[account.tone] }} aria-hidden="true" /><p className="flex-1 text-sm font-semibold text-[#10263E]">{account.name}</p><ArrowUpRight className="size-4 text-slate-400" aria-hidden="true" /></div>
              <p className="text-sm text-[#66758B]">{account.specialty} · {account.city}</p>
              <p className="mt-1 text-xs text-[#66758B]">Last visit {account.lastVisit ?? "not yet"}</p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );

  async function finishLasso(polygon: MapPoint[]) {
    setLasso(false);
    const selected = filtered.filter(a => a.lat != null && a.lng != null && insideLasso({ lat: a.lat, lng: a.lng }, polygon));
    if (selected.length < 2 || selected.length > 12) {
      setRouteNote(`Selected ${selected.length} saved accounts. Draw around 2–12 account dots. Save office search results to Accounts first.`);
      return;
    }
    setRouting(true);
    setRouteNote(`Creating a road route for ${selected.length} accounts…`);
    try {
      const result = await optimizeRouteAction(selected.map(a => a.id), true);
      if ("error" in result) setRouteNote(result.error ?? "The route could not be created.");
      else if (result.routeId) router.push(`/route?route=${encodeURIComponent(result.routeId)}`);
    } catch { setRouteNote("The route could not be created. Try again."); }
    finally { setRouting(false); }
  }

  const canvas = lasso || tomtomMapsKey || discovered.length > 0 || googleFailed || !googleMapsKey ? (
    <MapContainer center={center} zoom={10} className="h-full w-full" zoomControl={false}>
      {tomtomMapsKey && !tomtomFailed ? <TileLayer attribution='<a href="https://www.tomtom.com/copyright/">&copy; TomTom</a> &copy; OpenStreetMap' maxZoom={22} url={`https://api.tomtom.com/maps/orbis/display/raster/tile/{z}/{x}/{y}?apiVersion=2&style=street-light&tileSize=256&key=${encodeURIComponent(tomtomMapsKey)}`} eventHandlers={{ tileerror: () => setTomtomFailed(true) }} /> : <TileLayer attribution='&copy; OpenStreetMap' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />}
      {tomtomMapsKey && !tomtomFailed && showTraffic ? <TileLayer attribution="Traffic &copy; TomTom" maxZoom={22} opacity={0.8} url={`https://api.tomtom.com/maps/orbis/traffic/flow/raster/tile/{z}/{x}/{y}?apiVersion=2&style=light&tileSize=256&key=${encodeURIComponent(tomtomMapsKey)}`} /> : null}
      {lasso ? <LassoLayer onComplete={finishLasso} onCancel={cancelLasso} /> : null}
      <MapEvents onZoom={setZoom} onArea={setSearchArea} />
      <Recenter center={focus} accuracy={here && focus?.[0] === here.lat && focus?.[1] === here.lng ? here.accuracy : undefined} />
      {discovered.map((place, index) => <CircleMarker key={`discovered-${place.lat}-${place.lng}-${index}`} center={[place.lat, place.lng]} radius={10} pathOptions={{ color: "white", weight: 2, fillColor: savedDiscoveries[discoveryKey(place)] ? "#087f5b" : "#7c3aed", fillOpacity: 1 }}>
        <Tooltip>{place.name} · Search result</Tooltip>
        <Popup><strong>{place.name}</strong><br />{place.street}<br />{place.city}, {place.state} {place.zip}<br /><DiscoveredOfficeForm place={place} query={discoveryQuery} savedId={savedDiscoveries[discoveryKey(place)]} onSaved={markSaved} /></Popup>
      </CircleMarker>)}
      {boundary ? <Polygon positions={boundary} pathOptions={{ color: "#19B78A", weight: 2, fillOpacity: 0.05 }} /> : null}
      {here ? <Circle center={[here.lat, here.lng]} radius={Math.max(1, here.accuracy)} interactive={false} pathOptions={{ color: "#2563eb", fillColor: "#60a5fa", weight: 1, fillOpacity: 0.12 }} /> : null}
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
    <div className="flex h-full min-h-[32rem] gap-3 bg-[#f4f6f8] p-3 md:p-4">
      <aside className={`hidden shrink-0 overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm md:flex md:flex-col ${accountsMinimized ? "w-14" : "w-[20rem] xl:w-[22rem]"}`}>
        <button type="button" aria-expanded={!accountsMinimized} aria-label={accountsMinimized ? "Expand saved accounts" : "Minimize saved accounts"} className="flex min-h-11 shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 text-sm font-semibold" onClick={() => setAccountsMinimized(value => !value)}>{accountsMinimized ? "→" : <><span>Saved accounts</span><span>←</span></>}</button>
        {!accountsMinimized ? list : null}
      </aside>
      <div className="relative min-w-0 flex-1 overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
      <div className="absolute inset-x-3 top-3 z-20 max-h-[40%] overflow-y-auto space-y-2 rounded-2xl bg-white/95 p-2 shadow-sm md:hidden">
        <button type="button" aria-expanded={!accountsMinimized} className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl px-2 text-sm font-semibold" onClick={() => { setAccountsMinimized(value => !value); setMode("map"); }}><span>Saved accounts & office search</span><span>{accountsMinimized ? "Expand" : "Minimize"}</span></button>
        <div hidden={accountsMinimized} className="space-y-2">
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter saved accounts"
            className="h-11 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm"
            aria-label="Filter saved accounts"
          />
          <button type="button" className="h-11 rounded-xl bg-white px-3 text-sm font-medium shadow-sm ring-1 ring-slate-200" onClick={() => setMode(mode === "map" ? "list" : "map")}>
            {mode === "map" ? "List" : "Map"}
          </button>
        </div>
        <ZipFilter value={zip} onChange={setZip} options={zips} />
        <details data-office-search className="rounded-xl border border-slate-200 bg-white" onToggle={event => { if (event.currentTarget.open) event.currentTarget.scrollTop = 0; }}>
          <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-semibold text-[#10263E]">Find new offices</summary>
          <PlacesSearch here={here} area={searchArea} onResults={receivePlaces} saved={savedDiscoveries} onSaved={markSaved} compact />
        </details>
        {discovered.length > 0 ? <details className="rounded-xl border border-slate-200 bg-white">
          <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-semibold">{discovered.length} offices found · View results</summary>
          <ul className="max-h-40 overflow-y-auto space-y-2 p-2" aria-label="Mobile office results">{discovered.map(place => <li key={discoveryKey(place)} className="rounded-lg border border-slate-200 p-2 text-sm"><p className="font-medium">{place.name}</p><p className="text-xs text-slate-500">{place.street}, {place.city}</p><DiscoveredOfficeForm place={place} query={discoveryQuery} savedId={savedDiscoveries[discoveryKey(place)]} onSaved={markSaved} /></li>)}</ul>
        </details> : null}
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
      </div>

      {mode === "list" && !accountsMinimized ? <div className="relative z-0 h-full bg-white pt-28 md:hidden">{list}</div> : <div className="relative z-0 h-full isolate">{canvas}</div>}

      <div className="absolute right-3 bottom-24 z-20 flex flex-col gap-2 md:bottom-3">
        <button type="button" disabled={routing} aria-pressed={lasso} className="h-11 rounded-xl bg-[#10263E] px-3 text-sm font-medium text-white shadow-sm disabled:opacity-60" onClick={() => { setMode("map"); setLasso(!lasso); setRouteNote(""); }}>
          {routing ? "Creating route…" : lasso ? "Cancel lasso" : "Lasso route"}
        </button>
        {lasso ? <p role="status" className="max-w-[240px] rounded-xl bg-white p-3 text-xs shadow-sm">Draw around 2–12 saved account dots, then release to create and optimize your route. First and last selected stops stay fixed; adjust them in Route Planner.</p> : null}
        {routeNote ? <p role="status" className="max-w-[240px] rounded-xl bg-white p-3 text-xs shadow-sm">{routeNote}</p> : null}
        <button type="button" className="h-11 rounded-xl bg-white px-3 text-sm font-medium shadow-sm ring-1 ring-slate-200" disabled={locating} onClick={locate}>
          {locating ? "Finding location…" : "My location"}
        </button>
        {locationNote ? <p role="status" className="max-w-[240px] rounded-xl bg-white/95 p-3 text-xs text-[#10263E] shadow-sm">{locationNote}</p> : null}
      </div>
      <p className="pointer-events-none absolute top-3 left-3 z-20 hidden max-w-sm rounded-xl bg-white/95 px-3 py-2 text-[11px] text-[#66758B] shadow-sm md:block">
        {tomtomMapsKey ? <button type="button" disabled={tomtomFailed} aria-pressed={showTraffic} onClick={() => setShowTraffic(v => !v)} className="pointer-events-auto mr-3 min-h-11 rounded-lg border px-3 font-medium">Traffic {showTraffic ? "on" : "off"}</button> : null}
        {tomtomFailed ? <span role="status">TomTom tiles could not load. Showing OpenStreetMap. </span> : null}
        {tomtomMapsKey && !tomtomFailed ? "TomTom" : !tomtomMapsKey && discovered.length === 0 && googleMapsKey && !googleFailed ? "Google Maps" : "OpenStreetMap"} · Purple dots: office search results ({discovered.length}) · pin distance is straight-line until Routes returns a drive time
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
            <button type="button" className="min-h-11 rounded-xl px-3 text-sm text-[#66758B] hover:bg-slate-100" onClick={() => setSelectedId(null)} aria-label="Close office card">Close</button>
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

function ZipFilter({value,onChange,options}:{value:string;onChange:(value:string)=>void;options:string[]}) {
 const id=useId();const valid=validZipFilter(value);
 return <div className="rounded-xl bg-slate-50 p-2">
  <label htmlFor={id} className="text-xs font-medium text-[#10263E]">Filter saved accounts by ZIP code</label>
  <div className="mt-1 flex gap-2"><input id={id} list={`${id}-options`} value={value} onChange={event=>onChange(event.target.value)} placeholder="75068, 75034" aria-invalid={!valid} aria-describedby={`${id}-help`} className="h-11 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm"/><button type="button" disabled={!value} onClick={()=>onChange("")} className="min-h-11 rounded-lg border bg-white px-3 text-xs disabled:opacity-40">Clear ZIPs</button></div>
  <datalist id={`${id}-options`}>{options.map(zip=><option key={zip} value={zip}/>)}</datalist>
  <p id={`${id}-help`} className={`mt-1 text-xs ${valid?"text-slate-500":"text-red-700"}`}>{valid?"Enter one or more ZIPs, separated by commas. Applies to saved dots and the account list.":"Use complete five-digit ZIP codes, separated by commas."}</p>
 </div>;
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

function PlacesSearch({ here, area, onResults, saved, onSaved, compact = false }: { compact?: boolean; here: { lat: number; lng: number } | null; area: SearchArea | null; onResults: (places: PlaceCandidate[], query?: string) => void; saved: Record<string,string>; onSaved: (place: PlaceCandidate, id: string) => void }) {
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [places, setPlaces] = useState<Awaited<ReturnType<typeof searchPlacesAction>>["places"]>([]);
  const [pending, setPending] = useState(false);

  async function search() {
    if (pending || query.trim().length < 3) return;
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    setPending(true);
    setMessage(null);
    setPlaces([]);
    onResults([], query);
    try {
      const result = await searchPlacesAction(query, here, area);
      setPlaces(result.places);
      onResults(result.places, query);
      setMessage(result.message);
      if (compact && result.places.length) {
        const panel = document.querySelector<HTMLDetailsElement>("details[data-office-search]");
        if (panel) panel.open = false;
      }
    } catch { setMessage("Office search could not finish. Please try again."); }
    finally { setPending(false); }
  }

  return (
    <div className="rounded-xl bg-[#F5F7FA] p-2">
      <p className="text-xs font-medium text-[#10263E]">Find offices</p>
      <p className="mt-1 text-xs text-[#66758B]">Search the visible map area. Move or zoom the map, then search again. Up to 100 provider results can be shown.</p>
      <div className="mt-2 flex gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Pediatric clinic, Frisco TX"
          aria-label="Places search"
          enterKeyHint="search"
          onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void search(); } }}
          disabled={pending}
          className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-sm"
        />
        <button type="button" className="h-10 rounded-lg bg-[#10263E] px-3 text-xs font-medium text-white disabled:opacity-50" disabled={pending || query.trim().length < 3} onClick={() => void search()}>
          {pending ? "Searching" : "Search"}
        </button>
      </div>
      {message ? <p role="status" className="mt-2 text-xs text-[#66758B]">{message}</p> : null}
      {places.length ? <button type="button" className="mt-2 min-h-11 text-xs underline" onClick={() => { setPlaces([]); onResults([]); setMessage(null); }}>Clear search results</button> : null}
      <ul hidden={compact} aria-label="Discovered offices" className="mt-2 space-y-3">
        {places.map((place) => (
          <li key={`${place.name}-${place.zip}-${place.street}`} className="rounded-lg bg-white p-2 text-sm ring-1 ring-slate-200">
            <p className="font-medium">{place.name}</p>
            <p className="text-xs text-[#66758B]">{place.street}, {place.city}, {place.state} {place.zip}</p>
            <DiscoveredOfficeForm place={place} query={query} savedId={saved[discoveryKey(place)]} onSaved={onSaved} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function FilterChip({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={`min-h-11 shrink-0 rounded-full px-3 text-xs font-medium ${active ? "bg-[#10263E] text-white shadow-sm" : "bg-white text-[#14243A] ring-1 ring-slate-200 hover:bg-slate-50"}`}>
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
