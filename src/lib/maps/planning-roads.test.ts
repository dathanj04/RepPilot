import {beforeEach,it,expect,vi} from "vitest";
vi.mock("server-only",()=>({}));
vi.mock("@/lib/maps-config",()=>({tomtomMapsKey:()=>"test-key"}));
import { calculateRoadPlan,requestRoad,waypointOrder } from "./planning-roads";
import type {RoutePlanning} from "@/lib/domain/route-planning";
const stop=(i:number)=>({key:String(i),accountId:"a"+i,name:"Office "+i,address:"Address",lat:33+i/100,lng:-96,minutes:30,locked:false,appointment:null as string|null});
const plan=():RoutePlanning=>({version:1,name:"day",departure:"2026-12-20T14:00:00.000Z",workEnd:"2026-12-21T04:00:00.000Z",breakStart:null,breakEnd:null,start:stop(99),end:stop(88),stops:Array.from({length:16},(_,i)=>stop(i))});
const fetcher=vi.fn(async(input:string|URL|Request)=>{
 const url=new URL(String(input)), count=url.pathname.split("/calculateRoute/")[1].split("/json")[0].split(":").length;
 const n=count-2;return new Response(JSON.stringify({routes:[{legs:Array.from({length:count-1},(_,i)=>({summary:{lengthInMeters:1000,travelTimeInSeconds:60},points:[{latitude:33+i/100,longitude:-96},{latitude:33+(i+1)/100,longitude:-96}]}))}],optimizedWaypoints:Array.from({length:n},(_,i)=>({providedIndex:i,optimizedIndex:n-i-1}))}),{status:200});
});
beforeEach(()=>fetcher.mockClear());
it("optimizes 16 offices using the road service and returns road geometry",async()=>{const r=await calculateRoadPlan(plan(),true,fetcher as typeof fetch);expect(r.plan.stops.map(s=>s.key)).toEqual(Array.from({length:16},(_,i)=>String(15-i)));expect(r.road.timings).toHaveLength(16);expect(r.road.legs).toHaveLength(17);expect(r.road.geometry.length).toBeGreaterThan(16);expect(fetcher.mock.calls[0][0]).toContain("computeBestOrder=true");});
it("does not move locked or appointment anchors",async()=>{const p=plan();p.stops[4].locked=true;p.stops[9].locked=true;const r=await calculateRoadPlan(p,true,fetcher as typeof fetch);expect(r.plan.stops[4].key).toBe("4");expect(r.plan.stops[9].key).toBe("9");});
it("preserves manual order when optimization is not requested",async()=>{const p=plan();p.stops.reverse();const r=await calculateRoadPlan(p,false,fetcher as typeof fetch);expect(r.plan.stops.map(s=>s.key)).toEqual(p.stops.map(s=>s.key));expect(fetcher).toHaveBeenCalledTimes(1);});
it("rejects infeasible optimization without mutating the draft",async()=>{const p=plan();p.workEnd="2026-12-20T15:00:00.000Z";const before=JSON.stringify(p);await expect(calculateRoadPlan(p,true,fetcher as typeof fetch)).rejects.toThrow("working hours");expect(JSON.stringify(p)).toBe(before);});
it("reports routing failures instead of inventing straight-line estimates",async()=>{const p=plan();await expect(requestRoad([p.start,p.stops[0]],false,p.departure,vi.fn().mockResolvedValue(new Response("",{status:503})))).rejects.toThrow("could not be routed");});
it("validates provider permutations for the 16-stop route",()=>{expect(()=>waypointOrder({optimizedWaypoints:[{providedIndex:0,optimizedIndex:0}]},18)).toThrow();});
