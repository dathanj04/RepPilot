import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findAccurateLocation, locationAccuracy, locationError } from "./location";
let success: PositionCallback, failure: PositionErrorCallback;
const clear = vi.fn();
const geo = { clearWatch: clear, watchPosition: vi.fn((ok: PositionCallback, error: PositionErrorCallback) => { success=ok; failure=error; return 42; }) } as unknown as Geolocation;
const fix=(accuracy:number,lat=33, timestamp=Date.now()) => ({ coords:{ latitude:lat,longitude:-96,accuracy },timestamp } as GeolocationPosition);
beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); });
afterEach(() => vi.useRealTimers());
describe("fresh accurate device location", () => {
 it("requests uncached high accuracy and stops after a precise fix", () => { const update=vi.fn(),done=vi.fn();findAccurateLocation(geo,update,done);success(fix(20));expect(geo.watchPosition).toHaveBeenCalledWith(expect.any(Function),expect.any(Function),{enableHighAccuracy:true,maximumAge:0,timeout:20000});expect(update).toHaveBeenCalledWith({lat:33,lng:-96,accuracy:20});expect(clear).toHaveBeenCalledWith(42);expect(done).toHaveBeenCalledTimes(1); });
 it("refines a coarse fix without replacing it with worse accuracy", () => { const update=vi.fn();findAccurateLocation(geo,update,vi.fn());success(fix(5000));success(fix(7000));success(fix(100));expect(update).toHaveBeenCalledTimes(2);vi.advanceTimersByTime(25000);expect(clear).toHaveBeenCalledWith(42); });
 it("rejects stale and invalid coordinates", () => {const update=vi.fn();findAccurateLocation(geo,update,vi.fn());success(fix(10,999));success(fix(10,33,Date.now()-60000));expect(update).not.toHaveBeenCalled();});
 it("distinguishes denial from timeout and unavailable location", () => {const done=vi.fn();findAccurateLocation(geo,vi.fn(),done);failure({code:1} as GeolocationPositionError);expect(done).toHaveBeenCalledWith(locationError(1));expect(locationError(3)).toContain("timed out");expect(locationError(2)).not.toContain("blocked");});
 it("cancels the watch on unmount without further updates", () => {const update=vi.fn(),done=vi.fn();const cancel=findAccurateLocation(geo,update,done);cancel();success(fix(20));vi.advanceTimersByTime(30000);expect(clear).toHaveBeenCalledWith(42);expect(update).not.toHaveBeenCalled();expect(done).not.toHaveBeenCalled();});
 it("labels imprecise positions honestly", () => {expect(locationAccuracy(8000)).toContain("Approximate location");expect(locationAccuracy(15)).toContain("15 m");});
});
