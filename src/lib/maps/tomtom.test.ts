import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { parseTomtomPlaces, parseTomtomDrive, computeDrive, searchPlaces, geocodeAddress } from "./tomtom";
const office = { type: "poi", title: "Example Pediatrics", position: { coordinates: [-96.8, 33.1] }, address: { houseNumber: "123", street: "Example St", municipality: "Frisco", countrySubdivisionCodeIso: "US-TX", countryCodeIso2: "US", postalCode: "75034" } };
afterEach(() => vi.unstubAllEnvs());
describe("TomTom integration", () => {
 it("preserves coordinate order and a provider-returned complete address", () => { expect(parseTomtomPlaces({ results: [office] })).toEqual([{ name: "Example Pediatrics", street: "123 Example St", city: "Frisco", state: "TX", zip: "75034", lat: 33.1, lng: -96.8 }]); });
 it("never invents missing office addresses or coordinates", () => { expect(parseTomtomPlaces({ results: [{ ...office, address: {} }, { ...office, position: { coordinates: [-96.8, 999] } }, { ...office, type: "area" }] })).toEqual([]); });
 it("accepts measured road distances and traffic delay", () => { expect(parseTomtomDrive({ routes: [{ summary: { lengthInMeters: 1200, travelTimeInSeconds: 120, trafficDelayInSeconds: 10 }, legs: [{ summary: { lengthInMeters: 1200, travelTimeInSeconds: 120 } }] }] })).toMatchObject({ source: "tomtom_routes", durationSeconds: 120, trafficApplied: true }); });
 it("rejects missing and invalid road durations", () => { expect(parseTomtomDrive({ routes: [{ summary: { lengthInMeters: 10 }, legs: [] }] })).toBeNull(); expect(parseTomtomDrive(null)).toBeNull(); });
 it("makes no call without a configured key", async () => { vi.stubEnv("NEXT_PUBLIC_TOMTOM_API_KEY", ""); const fetch = vi.fn(); expect(await searchPlaces({ query: "pediatrics", bias: null }, fetch)).toEqual({ status: "not_configured" }); expect(fetch).not.toHaveBeenCalled(); });
 it("does not forward raw upstream errors or credential text", async () => { vi.stubEnv("NEXT_PUBLIC_TOMTOM_API_KEY", "a-public-test-key-of-valid-length"); const fetch = vi.fn().mockResolvedValue({ ok: false, status: 403, json: () => ({ key: "sensitive" }) }); const result = await geocodeAddress("Example address", fetch); expect(result).toMatchObject({ status: "error" }); expect(JSON.stringify(result)).not.toContain("sensitive"); expect(fetch.mock.calls[0][1].headers.Referer).toBe("https://reppilot.app/"); expect(fetch.mock.calls[0][1].cache).toBe("no-store"); });
 it("keeps routing coordinates in lat/lng order and enables live traffic", async () => { vi.stubEnv("NEXT_PUBLIC_TOMTOM_API_KEY", "a-public-test-key-of-valid-length"); const fetch=vi.fn().mockResolvedValue({ ok: true, json: async () => ({ routes: [{ summary: { lengthInMeters: 10, travelTimeInSeconds: 2 }, legs: [{ summary: { lengthInMeters: 10, travelTimeInSeconds: 2 } }] }] }) }); const result=await computeDrive([{lat:33,lng:-96},{lat:34,lng:-97}],fetch); expect(result.status).toBe("ok"); expect(fetch.mock.calls[0][0]).toContain("33,-96:34,-97/json?traffic=live"); expect(fetch.mock.calls[0][0]).not.toContain("a-public-test-key"); });
 it("blocks invalid coordinates before consuming quota", async () => { const fetch=vi.fn(); expect((await computeDrive([{lat:999,lng:0},{lat:0,lng:0}],fetch)).status).toBe("error"); expect(fetch).not.toHaveBeenCalled(); });
});

it("sends a broad pediatric specialty query and viewport constraint to TomTom before ranking", async () => {
 vi.stubEnv("NEXT_PUBLIC_TOMTOM_API_KEY", "a-public-test-key-of-valid-length");
 const fetch = vi.fn().mockResolvedValue({ok:true,json:async()=>({results:[]})});
 await searchPlaces({query:"Pediatrician",bias:{lat:33,lng:-96},area:{west:-97,east:-95,south:32,north:34}},fetch);
 const body = JSON.parse(fetch.mock.calls[0][1].body);
 expect(body.query).toBe("pediatrics"); expect(body.maxResults).toBe(100);
 expect(body.filters.geometry).toEqual({type:"rectangle",coordinates:[-97,32,-95,34]});
 expect(body.filters.countryCodesIso2).toEqual(["US"]);
 vi.unstubAllEnvs();
});


it("optimizes roads through the v1 endpoint and validates the returned permutation", async () => {
 const { optimizeDrive } = await import("./tomtom");
 vi.stubEnv("NEXT_PUBLIC_TOMTOM_API_KEY", "a-public-test-key-of-valid-length");
 const summary = {lengthInMeters:1000,travelTimeInSeconds:100};
 const fetch = vi.fn().mockResolvedValue({ok:true,json:async()=>({optimizedWaypoints:[{providedIndex:0,optimizedIndex:1},{providedIndex:1,optimizedIndex:0}],routes:[{summary,legs:[{summary},{summary},{summary}]}]})});
 const points = [{lat:33,lng:-96},{lat:33.1,lng:-96},{lat:33.2,lng:-96},{lat:33.3,lng:-96}];
 expect(await optimizeDrive(points,fetch)).toMatchObject({status:"ok",value:{order:[0,2,1,3]}});
 const url = new URL(fetch.mock.calls[0][0]);
 expect(url.pathname).toContain("/routing/1/calculateRoute/"); expect(url.searchParams.get("computeBestOrder")).toBe("true"); expect(url.searchParams.get("traffic")).toBe("true");
 expect(fetch.mock.calls[0][1].cache).toBe("no-store");
 vi.unstubAllEnvs();
});
