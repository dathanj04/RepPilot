/** Translate a specialty label into the provider's broader practice-name wording. */
export function discoveryQuery(query: string) {
  return query.trim().replace(/^pa?ediatricians?(?=$|\s+(?:near|in)\b)/i, "pediatrics");
}
export function discoveryKey(place: { name: string; street: string; zip: string }) {
  return [place.name, place.street, place.zip].map(s => s.trim().toLowerCase()).join("|");
}
export function suggestedSpecialty(query: string, name: string) {
  if (!/p[ae]?ediatr/i.test(query)) return "";
  if (/dent|smile/i.test(name)) return "Pediatric Dentistry";
  if (/therap/i.test(name)) return "Pediatric Therapy";
  return "Pediatrics";
}
