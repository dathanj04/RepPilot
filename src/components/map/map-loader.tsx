"use client";

import dynamic from "next/dynamic";
import type { MapAccount } from "./territory-map";

const TerritoryMap = dynamic(() => import("./territory-map").then((mod) => mod.TerritoryMap), {
  ssr: false,
  loading: () => <div className="grid h-[70dvh] place-items-center text-sm text-[#66758B]">Loading territory…</div>,
});

export function TerritoryMapLoader(props: {
  accounts: MapAccount[];
  boundary: [number, number][] | null;
  googleMapsKey: string;
  center: [number, number];
}) {
  return <TerritoryMap {...props} />;
}
