import { describe, expect, it } from "vitest";
import { placesInArea, validSearchArea } from "./search-area";
import type { PlaceCandidate } from "./provider";
const area = { north: 34, south: 33, east: -96, west: -97 };
const point = (lat:number,lng:number) => ({ lat,lng } as PlaceCandidate);
describe("office search map area", () => {
 it("shows every returned location in the chosen bounds, including edges", () => { const places=[point(33.5,-96.5),point(34,-96),point(32,-96.5),point(33.5,-98)]; expect(placesInArea(places,area)).toEqual(places.slice(0,2)); });
 it("rejects invalid or inverted areas", () => { expect(validSearchArea({...area,north:NaN})).toBe(false); expect(validSearchArea({...area,west:-95})).toBe(false); expect(validSearchArea({...area,north:91})).toBe(false); });
 it("does not discard results when no map bounds were supplied", () => { const places=[point(33,-96)]; expect(placesInArea(places,null)).toEqual(places); });
});
