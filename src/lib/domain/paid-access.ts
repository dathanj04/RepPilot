// Current sale prices. Legacy Business prices remain valid entitlements only.
export type PlanTier="individual"|"business";
export const CATALOG_VERSION="20261116-v2";
export const BILLING_PLANS = {
 monthly:{price:"price_1UcZG5AJxC2GoXaReqGuyGpO",label:"Business monthly",amount:"$48 / month",tier:"business",interval:"month",cents:4800},
 annual:{price:"price_1UcZG9AJxC2GoXaRLNovhZQD",label:"Business annual",amount:"$480 / year",tier:"business",interval:"year",cents:48000},
 individual_monthly:{price:"price_1UcZGHAJxC2GoXaRGEfCcPME",label:"Individual monthly",amount:"$29 / month",tier:"individual",interval:"month",cents:2900},
 individual_annual:{price:"price_1UcZGLAJxC2GoXaR2LLffADi",label:"Individual annual",amount:"$290 / year",tier:"individual",interval:"year",cents:29000},
} as const;
const LEGACY_BUSINESS=["price_1UZwGIAJxC2GoXaR1BvbNtJc","price_1UZwGSAJxC2GoXaRfAzM06QY"];
export function tierForPriceId(id:string):PlanTier|null{
 return Object.values(BILLING_PLANS).find(p=>p.price===id)?.tier??(LEGACY_BUSINESS.includes(id)?"business":null);
}
export function planKeyForPriceId(id:string):string|undefined{
 return Object.entries(BILLING_PLANS).find(([,p])=>p.price===id)?.[0]??(id===LEGACY_BUSINESS[0]?"monthly":id===LEGACY_BUSINESS[1]?"annual":undefined);
}
export const BUSINESS_UPGRADE="To access, please upgrade to Business account.";
// Production auth resolves this value from a verified trial or live Stripe price.
export function hasBusinessFeatures(user:{planTier?:PlanTier|null}){return user.planTier!=="individual";}
export type StripeSubscription = {
  id: string; customer: string; status: string; livemode: boolean;
  metadata?: Record<string, string>; pause_collection?: unknown;
  trial_end?: number|null; cancel_at_period_end?: boolean; default_payment_method?: string|null;
  latest_invoice?: { status?: string; paid?: boolean } | string | null;
  items: { data: Array<{ current_period_end?: number; price: { id: string }; quantity?: number }> };
};
export function isPaidSubscription(s: StripeSubscription, customer: string, organizationId: string, now = Date.now()) {
  const invoice = s.latest_invoice;
  return s.livemode === true && s.customer === customer && s.metadata?.organizationId === organizationId &&
    s.status === "active" && !s.pause_collection && typeof invoice === "object" && invoice !== null &&
    invoice.status === "paid" && s.items.data.length === 1 && s.items.data.every(item =>
      tierForPriceId(item.price.id)!==null &&
      (item.current_period_end ?? 0) * 1000 > now && (item.quantity ?? 0) >= 1);
}
