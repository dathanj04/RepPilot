const COUNTY_EXPORT = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/export";
// Current-vintage county layers at the Census service's supported map scales.
const COUNTY_LAYERS = "1,3,5,7,9,11,13";
export function countyTileUrl({x,y,z}:{x:number;y:number;z:number}) {
  if (![x,y,z].every(Number.isInteger) || z<0 || z>22 || x<0 || y<0 || x>=2**z || y>=2**z) throw new Error("Invalid county tile");
  const edge=20037508.342789244, span=edge*2/2**z;
  const left=-edge+x*span, top=edge-y*span;
  const query=new URLSearchParams({bbox:[left,top-span,left+span,top].join(','),bboxSR:'3857',imageSR:'3857',size:'256,256',dpi:'96',layers:`show:${COUNTY_LAYERS}`,format:'png32',transparent:'true',f:'image'});
  return `${COUNTY_EXPORT}?${query}`;
}
