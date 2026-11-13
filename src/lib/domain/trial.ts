export const TRIAL_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export function newTrial(now = new Date()) {
  return { trialStartedAt: now, trialEndsAt: new Date(now.getTime() + TRIAL_DAYS * DAY_MS) };
}

export function trialAccess(subscription: { status: string; trialStartedAt: Date | null; trialEndsAt: Date | null } | null, now = new Date()): { allowed: boolean; daysLeft: number | null; endsAt: string | null } {
  const start = subscription?.trialStartedAt?.getTime();
  const end = subscription?.trialEndsAt?.getTime();
  const valid = subscription?.status === "trialing" && start != null && end != null && Number.isFinite(start) && Number.isFinite(end) && start <= now.getTime() && end > start;
  const allowed = Boolean(valid && now.getTime() < end!);
  return { allowed, daysLeft: allowed ? Math.ceil((end! - now.getTime()) / DAY_MS) : 0, endsAt: subscription?.trialEndsAt?.toISOString() ?? null };
}
