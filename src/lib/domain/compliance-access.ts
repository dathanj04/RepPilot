/** `basic` is the legacy plan stored for existing Business workspaces. */
export function complianceFeatureAvailable(plan: string | null | undefined, trialDaysLeft: number | null) {
  if (trialDaysLeft != null && trialDaysLeft > 0) return true;
  return ["basic", "business", "enterprise", "team"].includes((plan || "").toLowerCase());
}
export const COMPLIANCE_UPGRADE = "To access, please upgrade to Business account.";
