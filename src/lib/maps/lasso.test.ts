import { describe, it, expect } from "vitest";
import { insideLasso, optimizedPointOrder } from "./lasso";
const box = [{lat:0,lng:0},{lat:0,lng:2},{lat:2,lng:2},{lat:2,lng:0}];
describe("lasso selection", () => {
  it("selects interior and boundary dots in either drawing direction", () => {
    for (const polygon of [box,[...box].reverse()]) {
      expect(insideLasso({lat:1,lng:1},polygon)).toBe(true);
      expect(insideLasso({lat:0,lng:1},polygon)).toBe(true);
      expect(insideLasso({lat:3,lng:1},polygon)).toBe(false);
    }
  });
  it("rejects clicks and open lines with fewer than three points", () => {
    expect(insideLasso({lat:0,lng:0},[])).toBe(false);
    expect(insideLasso({lat:0,lng:0},box.slice(0,2))).toBe(false);
  });
});
describe("TomTom optimized sequence", () => {
  it("maps a non-self-inverse permutation verified against live road-leg endpoints", () => {
    expect(optimizedPointOrder({optimizedWaypoints:[{providedIndex:0,optimizedIndex:2},{providedIndex:1,optimizedIndex:0},{providedIndex:2,optimizedIndex:1}]},5)).toEqual([0,3,1,2,4]);
  });
  it("rejects incomplete, duplicate, out-of-range and fractional indices", () => {
    for (const list of [[],[{providedIndex:0,optimizedIndex:0},{providedIndex:1,optimizedIndex:0}],[{providedIndex:0,optimizedIndex:0},{providedIndex:1,optimizedIndex:3}],[{providedIndex:0,optimizedIndex:0},{providedIndex:1,optimizedIndex:0.5}]]) expect(optimizedPointOrder({optimizedWaypoints:list},4)).toBeNull();
    expect(optimizedPointOrder(null,3)).toBeNull();
    expect(optimizedPointOrder(null,2)).toEqual([0,1]);
  });
});
