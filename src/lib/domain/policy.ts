export type PolicyFinding = {
  code: string;
  severity: "block" | "warn" | "info";
  overridable: boolean;
  message: string;
};

export type PolicyConfig = {
  configured: boolean;
  perPersonCapCents: number;
  exceptionsPermitted: boolean;
  educationalPurposeRequired: boolean;
  version: string;
};

export type PolicyInput = {
  policy: PolicyConfig | null;
  educationalPurposeDocumented: boolean;
  isEntertainment: boolean;
  referralLinked: boolean;
  orderTotalCents: number;
  eligibleAttendees: number;
};

export type PolicyDecision = {
  result: "PASS" | "WARN" | "BLOCK" | "NOT_CONFIGURED";
  findings: PolicyFinding[];
  perPersonCents: number | null;
  capDeltaCents: number | null;
  disclaimer: string;
};

export const POLICY_DISCLAIMER =
  "This is a fictional company-policy cap—not a federal legal meal allowance.";

export const LEGALITY_FOOTER =
  "Within configured policy does not guarantee legality. Compliance review is required.";

export const EXCEPTION_LIMIT =
  "Exceptions are available only where the configured policy permits. Approval cannot override a legal prohibition.";

export function perPersonCents(
  totalCents: number,
  attendees: number,
): number | null {
  if (!Number.isFinite(totalCents) || attendees <= 0) return null;
  return Math.round(totalCents / attendees);
}

export function evaluateMealPolicy(input: PolicyInput): PolicyDecision {
  const findings: PolicyFinding[] = [];
  const perPerson = perPersonCents(input.orderTotalCents, input.eligibleAttendees);

  if (input.isEntertainment) {
    findings.push({
      code: "entertainment",
      severity: "block",
      overridable: false,
      message: "Entertainment is disabled in this product.",
    });
  }

  if (input.referralLinked) {
    findings.push({
      code: "referral_linked",
      severity: "block",
      overridable: false,
      message: "Referral-linked meal eligibility is not permitted.",
    });
  }

  if (!input.policy || !input.policy.configured) {
    findings.push({
      code: "policy_missing",
      severity: "block",
      overridable: false,
      message:
        "No approved meal policy is configured. This workflow stays blocked until an administrator adds one.",
    });
    return {
      result: "NOT_CONFIGURED",
      findings,
      perPersonCents: perPerson,
      capDeltaCents: null,
      disclaimer: POLICY_DISCLAIMER,
    };
  }

  if (input.policy.educationalPurposeRequired && !input.educationalPurposeDocumented) {
    findings.push({
      code: "educational_purpose",
      severity: "block",
      overridable: false,
      message: "Educational purpose must be documented before this meal can proceed.",
    });
  } else if (input.educationalPurposeDocumented) {
    findings.push({
      code: "educational_purpose",
      severity: "info",
      overridable: false,
      message: "Educational purpose — Documented",
    });
  }

  if (input.eligibleAttendees <= 0) {
    findings.push({
      code: "attendees",
      severity: "block",
      overridable: false,
      message: "Eligible attendee count must be at least 1.",
    });
  }

  let capDelta: number | null = null;
  if (perPerson != null && input.eligibleAttendees > 0) {
    capDelta = perPerson - input.policy.perPersonCapCents;
    if (capDelta > 0) {
      const dollars = (capDelta / 100).toFixed(0);
      findings.push({
        code: "over_cap",
        severity: "block",
        overridable: input.policy.exceptionsPermitted,
        message: `Over internal policy cap by $${dollars} per attendee.`,
      });
    }
  }

  const blocking = findings.filter((finding) => finding.severity === "block");
  const result = blocking.length > 0 ? "BLOCK" : "PASS";
  return {
    result,
    findings,
    perPersonCents: perPerson,
    capDeltaCents: capDelta,
    disclaimer: POLICY_DISCLAIMER,
  };
}

export function canRecordOrder(input: {
  decision: PolicyDecision;
  exceptionStatus: "none" | "pending" | "approved" | "denied" | "prohibited";
}): { allowed: boolean; reason: string } {
  const prohibited = input.decision.findings.some(
    (finding) => finding.severity === "block" && !finding.overridable,
  );
  if (prohibited || input.decision.result === "NOT_CONFIGURED") {
    return {
      allowed: false,
      reason:
        input.exceptionStatus === "prohibited" || prohibited
          ? "This hold cannot be cleared by an exception. Approval cannot override a prohibition."
          : "An approved meal policy is required before this order can be recorded.",
    };
  }
  if (input.decision.result === "PASS") {
    return { allowed: true, reason: "Within the configured internal policy." };
  }
  const onlyOverridable = input.decision.findings
    .filter((finding) => finding.severity === "block")
    .every((finding) => finding.overridable);
  if (onlyOverridable && input.exceptionStatus === "approved") {
    return {
      allowed: true,
      reason: "An authorized exception covers the internal policy cap.",
    };
  }
  return {
    allowed: false,
    reason: "Submission stays blocked until the internal policy requirements pass.",
  };
}

export function exceptionIsProhibited(decision: PolicyDecision): boolean {
  return decision.findings.some(
    (finding) => finding.severity === "block" && !finding.overridable,
  );
}
