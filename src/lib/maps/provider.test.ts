import { describe, expect, it } from "vitest";
import {
  appointmentTravelWarnings,
  formatDriveDuration,
  orderByStraightLine,
  parseGeocodeResponse,
  parsePlacesResponse,
  parseRoutesResponse,
  safeGoogleMessage,
} from "./provider";

describe("geocoding parser", () => {
  it("keeps a rooftop point and skips an approximate city centroid", () => {
    const parsed = parseGeocodeResponse({
      status: "OK",
      results: [
        { geometry: { location_type: "APPROXIMATE", location: { lat: 33, lng: -96 } } },
        { geometry: { location_type: "ROOFTOP", location: { lat: 33.15, lng: -96.82 } } },
      ],
    });
    expect(parsed).toEqual({ status: "ok", location: { lat: 33.15, lng: -96.82 } });
  });

  it("does not invent a point when Google has no precise result", () => {
    expect(parseGeocodeResponse({ status: "ZERO_RESULTS", results: [] })).toEqual({ status: "not_found" });
    expect(parseGeocodeResponse({ status: "OK", results: [{ geometry: { location_type: "APPROXIMATE", location: { lat: 1, lng: 2 } } }] })).toEqual({
      status: "not_found",
    });
  });
});

describe("places parser", () => {
  it("drops a result that has no street address instead of filling one in", () => {
    const places = parsePlacesResponse({
      places: [
        {
          displayName: { text: "North Clinic" },
          location: { latitude: 33.1, longitude: -96.8 },
          addressComponents: [
            { longText: "100", shortText: "100", types: ["street_number"] },
            { longText: "Main Street", shortText: "Main St", types: ["route"] },
            { longText: "Frisco", shortText: "Frisco", types: ["locality"] },
            { longText: "Texas", shortText: "TX", types: ["administrative_area_level_1"] },
            { longText: "75034", shortText: "75034", types: ["postal_code"] },
          ],
        },
        {
          displayName: { text: "Unlocated Office" },
          location: { latitude: 33.2, longitude: -96.7 },
          addressComponents: [{ longText: "Plano", shortText: "Plano", types: ["locality"] }],
        },
      ],
    });
    expect(places).toEqual([
      {
        name: "North Clinic",
        street: "100 Main Street",
        city: "Frisco",
        state: "TX",
        zip: "75034",
        lat: 33.1,
        lng: -96.8,
      },
    ]);
  });
});

describe("routes parser", () => {
  it("returns drive time only when duration and every leg are present", () => {
    const plan = parseRoutesResponse({
      routes: [
        {
          duration: "900s",
          staticDuration: "840s",
          distanceMeters: 12000,
          legs: [
            { duration: "400s", distanceMeters: 5000 },
            { duration: "500s", distanceMeters: 7000 },
          ],
        },
      ],
    });
    expect(plan?.source).toBe("google_routes");
    expect(plan?.durationSeconds).toBe(900);
    expect(plan?.trafficApplied).toBe(true);
    expect(plan?.legs).toHaveLength(2);
    expect(formatDriveDuration(900)).toBe("15 min drive time");
  });

  it("refuses a route that omits duration", () => {
    expect(parseRoutesResponse({ routes: [{ distanceMeters: 100, legs: [{ distanceMeters: 100 }] }] })).toBeNull();
  });
});

describe("route order and appointment gaps", () => {
  it("orders stops by straight-line distance without calling them optimized drive time", () => {
    const order = orderByStraightLine({ lat: 33.15, lng: -96.82 }, [
      { id: "far", location: { lat: 32.78, lng: -96.8 } },
      { id: "near", location: { lat: 33.16, lng: -96.81 } },
      { id: "missing", location: null },
    ]);
    expect(order).toEqual(["near", "far", "missing"]);
  });

  it("warns from Google drive time when the appointment gap is shorter", () => {
    const warnings = appointmentTravelWarnings({
      stops: [
        { name: "Oak", location: { lat: 33.1, lng: -96.8 }, fixedAt: "2026-11-07T15:00:00.000Z" },
        { name: "Elm", location: { lat: 33.4, lng: -96.7 }, fixedAt: "2026-11-07T15:20:00.000Z" },
      ],
      legs: [{ durationSeconds: 2400, distanceMeters: 40000 }],
      bufferMinutes: 10,
    });
    expect(warnings[0]).toContain("Google drive time");
    expect(warnings[0]).toContain("20 minutes apart");
  });

  it("labels a short gap without Google data as straight-line, not drive time", () => {
    const warnings = appointmentTravelWarnings({
      stops: [
        { name: "Oak", location: { lat: 33.15, lng: -96.82 }, fixedAt: "2026-11-07T15:00:00.000Z" },
        { name: "Elm", location: { lat: 32.4, lng: -96.8 }, fixedAt: "2026-11-07T15:30:00.000Z" },
      ],
      legs: null,
      bufferMinutes: 10,
    });
    expect(warnings[0]).toContain("straight-line");
    expect(warnings[0]).toContain("This is not drive time");
  });
});

describe("google errors", () => {
  it("strips a key-shaped token from a provider message", () => {
    expect(safeGoogleMessage("Bad key AIzaSyEXAMPLEKEY123456")).not.toContain("AIza");
  });
});
