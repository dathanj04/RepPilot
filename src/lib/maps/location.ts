export type LocationFix = { lat: number; lng: number; accuracy: number };
export function locationError(code: number) {
  if (code === 1) return "Location is blocked. Allow location for reppilot.app in your browser and device settings, then try again.";
  if (code === 3) return "Finding your location timed out. Try again with device location enabled; a phone outdoors may get a better fix.";
  return "Your device could not determine its location. Check device location services and try again.";
}
export function locationAccuracy(accuracy: number) {
  const distance = accuracy >= 1000 ? `${(accuracy / 1000).toFixed(1)} km` : `${Math.ceil(accuracy)} m`;
  return `${accuracy > 200 ? "Approximate location" : "Location found"} · within about ${distance}${accuracy > 200 ? ". Enable precise location for a better fix." : ""}`;
}
/** Only runs after a user gesture; stops after a good fix, timeout or cancellation. */
export function findAccurateLocation(geo: Geolocation, onFix: (fix: LocationFix) => void, onDone: (error?: string) => void) {
  let stopped = false;
  let watch: number | undefined;
  let best: LocationFix | null = null;
  const finish = (error?: string) => {
    if (stopped) return;
    stopped = true;
    clearTimeout(timer);
    if (watch !== undefined) geo.clearWatch(watch);
    onDone(error);
  };
  const timer = setTimeout(() => finish(best ? undefined : locationError(3)), 25000);
  try {
    watch = geo.watchPosition(position => {
      if (stopped) return;
      const { latitude: lat, longitude: lng, accuracy } = position.coords;
      if (![lat, lng, accuracy, position.timestamp].every(Number.isFinite) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || accuracy < 0 || Date.now() - position.timestamp > 30000 || position.timestamp > Date.now() + 5000) return;
      if (best && accuracy >= best.accuracy) return;
      best = { lat, lng, accuracy };
      onFix(best);
      if (accuracy <= 50) finish();
    }, error => {
      if (error.code === 1 || !best) finish(locationError(error.code));
      else finish();
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
    // Also handles synchronous callbacks from unusual browser implementations.
    if (stopped && watch !== undefined) geo.clearWatch(watch);
  } catch { finish(locationError(2)); }
  return () => { if (stopped) return; stopped = true; clearTimeout(timer); if (watch !== undefined) geo.clearWatch(watch); };
}
