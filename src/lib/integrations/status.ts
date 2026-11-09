function configured(name: string) {
  return Boolean(process.env[name]?.trim());
}

/** Names only. Never include the secret value. */
export function integrationStatus() {
  return {
    googleCalendar: configured("GOOGLE_CLIENT_ID") && configured("GOOGLE_CLIENT_SECRET"),
    microsoftCalendar: configured("MICROSOFT_CLIENT_ID") && configured("MICROSOFT_CLIENT_SECRET"),
    email: configured("RESEND_API_KEY") && configured("EMAIL_FROM"),
    mapsServer: configured("GOOGLE_MAPS_API_KEY"),
    mapsBrowser: configured("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"),
    gemini: configured("GEMINI_API_KEY"),
    crm: false,
    billing: false,
  } as const;
}
