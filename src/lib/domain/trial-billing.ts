/**
 * Trial presentation rules only. Stripe is the source of truth for billing.
 * This module does not create subscriptions, store card numbers, or charge cards.
 */
export const TRIAL_LENGTH_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export type TrialBillingState =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "unknown";

export type TrialSummary = {
  state: TrialBillingState;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  daysRemaining: number | null;
  cardOnFile: boolean;
  chargeMessage: string;
};

/** Dates from Stripe are UTC seconds, not JavaScript milliseconds. */
export function stripeEpochSecondsToIso(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isSafeInteger(seconds) || seconds < 0) return null;
  const date = new Date(seconds * 1000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Used for showing a *proposed* trial end before Stripe creates a subscription.
 * Once Stripe has created it, always use subscription.trial_end instead.
 */
export function proposedTrialEnd(startedAt: Date): Date {
  if (Number.isNaN(startedAt.getTime())) throw new Error("Invalid trial start");
  return new Date(startedAt.getTime() + TRIAL_LENGTH_DAYS * DAY_MS);
}

export function summarizeStripeTrial(input: {
  status: string;
  trialStart: number | null | undefined;
  trialEnd: number | null | undefined;
  hasDefaultPaymentMethod: boolean;
  now?: Date;
}): TrialSummary {
  const now = input.now ?? new Date();
  if (Number.isNaN(now.getTime())) throw new Error("Invalid current time");
  const states: TrialBillingState[] = ["trialing", "active", "past_due", "canceled", "incomplete"];
  const state: TrialBillingState = states.includes(input.status as TrialBillingState)
    ? input.status as TrialBillingState
    : "unknown";
  const started = stripeEpochSecondsToIso(input.trialStart);
  const ends = stripeEpochSecondsToIso(input.trialEnd);
  const endsMs = ends === null ? null : Date.parse(ends);
  const remaining = state === "trialing" && endsMs !== null
    ? Math.max(0, Math.ceil((endsMs - now.getTime()) / DAY_MS))
    : null;

  let chargeMessage: string;
  if (state === "trialing" && ends) {
    chargeMessage = input.hasDefaultPaymentMethod
      ? "Card saved securely with Stripe. No subscription payment is due before the trial ends. Stripe determines the actual first charge."
      : "Add a card securely through Stripe. No subscription payment is due before the trial ends.";
  } else if (state === "active") {
    chargeMessage = "Subscription active. Consult Stripe for the next invoice date and amount.";
  } else if (state === "past_due") {
    chargeMessage = "Payment past due. Update the payment method through Stripe.";
  } else if (state === "canceled") {
    chargeMessage = "Subscription canceled. Confirm the access end date in Stripe.";
  } else {
    chargeMessage = "Billing status needs verification in Stripe.";
  }

  return {
    state,
    trialStartedAt: started,
    trialEndsAt: ends,
    daysRemaining: remaining,
    cardOnFile: input.hasDefaultPaymentMethod,
    chargeMessage,
  };
}
