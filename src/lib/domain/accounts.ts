export function accountIdentityKey(parts: { name: string; street: string; zip: string }) {
  const fold = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${fold(parts.name)}|${fold(parts.street)}|${fold(parts.zip)}`;
}

export const PROFILE_TIMEZONES = [
  "America/Chicago",
  "America/New_York",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "UTC",
] as const;

export function isProfileTimezone(value: string) {
  return (PROFILE_TIMEZONES as readonly string[]).includes(value);
}
