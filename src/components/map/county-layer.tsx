"use client";
import { useEffect } from "react";
import { tileLayer } from "leaflet";
import { useMap } from "react-leaflet";
import { countyTileUrl, zipcodeTileUrl } from "@/lib/maps/counties";

export function CountyLayer({onError, zipcode=false}:{onError:()=>void;zipcode?:boolean}) {
 const map=useMap();
 useEffect(()=>{
  const layer=tileLayer('',{attribution:zipcode ? 'ZIP areas: U.S. Census Bureau ZCTAs' : 'County boundaries: U.S. Census Bureau (TIGERweb)',zIndex:zipcode ? 440 : 450,maxZoom:22,minZoom:zipcode ? 8 : 0,maxNativeZoom:18,updateWhenIdle:true,keepBuffer:1,className:zipcode ? 'zipcode-boundary-tiles' : 'county-boundary-tiles'});
  layer.getTileUrl=coords=>zipcode ? zipcodeTileUrl(coords) : countyTileUrl(coords);
  layer.on('tileerror',onError);
  layer.addTo(map);
  return()=>{layer.off('tileerror',onError);layer.remove();};
 },[map,onError,zipcode]);
 return null;
}
