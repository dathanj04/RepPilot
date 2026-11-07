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
  return Boolean(googleMapsServerKey());
}
