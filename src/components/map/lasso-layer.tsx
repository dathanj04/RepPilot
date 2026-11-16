"use client";

import { useEffect, useRef, useState } from "react";
import { useMap } from "react-leaflet";
import type { MapPoint } from "@/lib/maps/lasso";

export function LassoLayer({ onComplete, onCancel }: { onComplete: (polygon: MapPoint[]) => void; onCancel: () => void }) {
  const map = useMap();
  const points = useRef<[number, number][]>([]);
  const pointer = useRef<number | null>(null);
  const [path, setPath] = useState("");
  useEffect(() => {
    const handlers = [map.dragging, map.scrollWheelZoom, map.doubleClickZoom, map.touchZoom, map.boxZoom, map.keyboard];
    const enabled = handlers.map(handler => handler.enabled());
    handlers.forEach(handler => handler.disable());
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") onCancel(); };
    window.addEventListener("keydown", escape);
    return () => { handlers.forEach((handler,index) => { if (enabled[index]) handler.enable(); }); window.removeEventListener("keydown", escape); };
  }, [map, onCancel]);
  const local = (event: React.PointerEvent<SVGSVGElement>): [number, number] => {
    const rect = event.currentTarget.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
  };
  return <svg aria-label="Draw around saved account dots to create a route" className="absolute inset-0 z-[1000] h-full w-full cursor-crosshair" style={{ touchAction: "none" }}
    onPointerDown={event => {
      if (!event.isPrimary || event.button !== 0) return;
      event.preventDefault(); event.stopPropagation();
      pointer.current = event.pointerId;
      event.currentTarget.setPointerCapture(event.pointerId);
      points.current = [local(event)]; setPath("");
    }}
    onPointerMove={event => {
      if (pointer.current !== event.pointerId) return;
      const p = local(event), last = points.current.at(-1)!;
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 4 || points.current.length >= 1000) return;
      points.current.push(p);
      setPath(points.current.map((v,index) => `${index ? "L" : "M"}${v[0]},${v[1]}`).join(" ") + " Z");
    }}
    onPointerUp={event => {
      if (pointer.current !== event.pointerId) return;
      pointer.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
      const polygon = points.current.map(p => { const ll = map.containerPointToLatLng(p); return { lat: ll.lat, lng: ll.lng }; });
      onComplete(polygon);
    }}
    onPointerCancel={() => { pointer.current = null; onCancel(); }}>
    <path d={path} fill="#19B78A" fillOpacity={0.2} stroke="#087f5b" strokeWidth={3} strokeDasharray="6 4" />
  </svg>;
}
