function configured(name: string) {
  return Boolean(process.env[name]?.trim());
}

/** Names only. Never include the secret value. */
export function integrationStatus() {
  return {
    googleCalendar: configured("GOOGLE_CLIENT_ID") && configured("GOOGLE_CLIENT_SECRET"),
    microsoftCalendar: configured("MICROSOFT_CLIENT_ID") && configured("MICROSOFT_CLIENT_SECRET"),
    email: configured("RESEND_API_KEY") && configured("EMAIL_FROM"),
    mapsServer: configured("NEXT_PUBLIC_TOMTOM_API_KEY") || configured("GOOGLE_MAPS_API_KEY"),
    mapsBrowser: configured("NEXT_PUBLIC_TOMTOM_API_KEY") || configured("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"),
    gemini: configured("GEMINI_API_KEY"),
    generativeAi: process.env.AI_PROVIDER==="gemini"?configured("GEMINI_API_KEY"):process.env.AI_PROVIDER==="openai"?configured("OPENAI_API_KEY"):configured("OPENAI_API_KEY")||configured("GEMINI_API_KEY"),
    crm: false,
    monitoring: configured("SENTRY_DSN") || configured("ALERT_WEBHOOK_URL") || (configured("OPS_ALERT_EMAIL") && configured("RESEND_API_KEY") && configured("EMAIL_FROM")),
    scheduler: configured("SCHEDULER_SECRET") || configured("CRON_SECRET"),
    billing: configured("STRIPE_SECRET_KEY") && configured("STRIPE_WEBHOOK_SECRET"),
  } as const;
}
