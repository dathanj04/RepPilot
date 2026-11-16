const COUNTY_EXPORT = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/export";
// Current-vintage county layers at the Census service's supported map scales.
const COUNTY_LAYERS = "1,3,5,7,9,11,13";
function boundaryTileUrl({x,y,z}:{x:number;y:number;z:number}, zipcode=false) {
  if (![x,y,z].every(Number.isInteger) || z<0 || z>22 || x<0 || y<0 || x>=2**z || y>=2**z) throw new Error("Invalid county tile");
  const edge=20037508.342789244, span=edge*2/2**z;
  const left=-edge+x*span, top=edge-y*span;
  const query=new URLSearchParams({bbox:[left,top-span,left+span,top].join(','),bboxSR:'3857',imageSR:'3857',size:'256,256',dpi:'96',layers:`show:${zipcode ? "1" : COUNTY_LAYERS}`,format:'png32',transparent:'true',f:'image'});
  return `${zipcode ? "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/PUMA_TAD_TAZ_UGA_ZCTA/MapServer/export" : COUNTY_EXPORT}?${query}`;
}

export function countyTileUrl(coords:{x:number;y:number;z:number}) { return boundaryTileUrl(coords); }
export function zipcodeTileUrl(coords:{x:number;y:number;z:number}) { return boundaryTileUrl(coords,true); }
