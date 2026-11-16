const PLACEHOLDERS = new Set([
  "",
  "your-key",
  "changeme",
  "todo",
  "api key required",
  "replace-me",
]);

/** Browser Maps JavaScript key. Placeholder values are treated as unset so Google never paints its error tile. */
export function googleMapsBrowserKey() {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";
  if (key.length < 20 || PLACEHOLDERS.has(key.toLowerCase())) return "";
  return key;
}

/** Server key for Geocoding, Places, and Routes. Never send this value to the browser. */
export function googleMapsServerKey() {
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim() ?? "";
  if (key.length < 20 || PLACEHOLDERS.has(key.toLowerCase())) return "";
  return key;
}

export function googleRoutesConfigured() {
  return Boolean(tomtomMapsKey() || googleMapsServerKey());
}

/** Browser map key is public by design; server calls use a fixed app referrer. */
export function tomtomMapsKey() {
  const key = process.env.NEXT_PUBLIC_TOMTOM_API_KEY?.trim() ?? "";
  return key.length >= 20 && !PLACEHOLDERS.has(key.toLowerCase()) ? key : "";
}
export function mapsServiceConfigured() { return Boolean(tomtomMapsKey() || googleMapsServerKey()); }
export function mapsProviderLabel() { return tomtomMapsKey() ? "TomTom" : "Google"; }
