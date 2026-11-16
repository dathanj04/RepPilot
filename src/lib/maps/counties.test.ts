import {expect,it} from "vitest";
import {countyTileUrl,zipcodeTileUrl} from "./counties";
it("requests transparent county boundaries from the fixed Census endpoint",()=>{
 const url=new URL(countyTileUrl({x:0,y:0,z:0}));
 expect(url.hostname).toBe('tigerweb.geo.census.gov');
 expect(url.searchParams.get('layers')).toBe('show:1,3,5,7,9,11,13');
 expect(url.searchParams.get('transparent')).toBe('true');
 expect(url.searchParams.get('bboxSR')).toBe('3857');
 const bbox=url.searchParams.get('bbox')!.split(',').map(Number);
 expect(bbox[0]).toBeCloseTo(-20037508.342789244);expect(bbox[3]).toBeCloseTo(20037508.342789244);
});
it("keeps north/south tile bounds in correct Mercator order",()=>{
 const url=new URL(countyTileUrl({x:0,y:0,z:1}));
 const bbox=url.searchParams.get('bbox')!.split(',').map(Number);
 expect(bbox[1]).toBe(0);expect(bbox[2]).toBe(0);expect(bbox[0]).toBeLessThan(bbox[2]);expect(bbox[1]).toBeLessThan(bbox[3]);
});
it("rejects invalid tile coordinates",()=>{for(const tile of [{x:-1,y:0,z:1},{x:2,y:0,z:1},{x:0,y:0,z:23},{x:0,y:NaN,z:2}])expect(()=>countyTileUrl(tile)).toThrow();});

it("requests only ZIP-area outlines with the same map extent as counties",()=>{
 const tile={x:235,y:412,z:10};const zip=new URL(zipcodeTileUrl(tile));const county=new URL(countyTileUrl(tile));
 expect(zip.pathname).toContain('PUMA_TAD_TAZ_UGA_ZCTA');expect(zip.searchParams.get('layers')).toBe('show:1');expect(zip.searchParams.get('bbox')).toBe(county.searchParams.get('bbox'));expect(zip.searchParams.get('transparent')).toBe('true');
});
