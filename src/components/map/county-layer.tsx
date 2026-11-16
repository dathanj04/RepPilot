"use client";
import { useEffect } from "react";
import { tileLayer } from "leaflet";
import { useMap } from "react-leaflet";
import { countyTileUrl } from "@/lib/maps/counties";

export function CountyLayer({onError}:{onError:()=>void}) {
 const map=useMap();
 useEffect(()=>{
  const layer=tileLayer('',{attribution:'County boundaries: U.S. Census Bureau (TIGERweb)',zIndex:450,maxZoom:22,maxNativeZoom:18,updateWhenIdle:true,keepBuffer:1,className:'county-boundary-tiles'});
  layer.getTileUrl=coords=>countyTileUrl(coords);
  layer.on('tileerror',onError);
  layer.addTo(map);
  return()=>{layer.off('tileerror',onError);layer.remove();};
 },[map,onError]);
 return null;
}
