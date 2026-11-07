export type SlotDecision =
  | { ok: true }
  | { ok: false; reason: string };

export function evaluateSlotSelection(input: {
  invitationStatus: string;
  expiresAt: Date;
  now: Date;
  revoked: boolean;
  slotBelongsToInvitation: boolean;
  representativeAuthorized: boolean;
  hasConflict: boolean;
}): SlotDecision {
  if (input.revoked || input.invitationStatus === "REVOKED") {
    return { ok: false, reason: "This invitation was revoked." };
  }
  if (input.invitationStatus === "ACCEPTED") {
    return {
      ok: false,
      reason: "A time from this invitation has already been selected.",
    };
  }
  if (input.invitationStatus !== "ACTIVE" || input.expiresAt <= input.now) {
    return {
      ok: false,
      reason: "This invitation has expired. Ask your representative for a new link.",
    };
  }
  if (!input.slotBelongsToInvitation) {
    return { ok: false, reason: "That time was not offered on this invitation." };
  }
  if (!input.representativeAuthorized) {
    return {
      ok: false,
      reason: "The representative has not authorized confirmation for this invitation.",
    };
  }
  if (input.hasConflict) {
    return {
      ok: false,
      reason: "That time is no longer available. Choose another offered time.",
    };
  }
  return { ok: true };
}

export function evaluateConfirmationLink(input: {
  revoked: boolean;
  expiresAt: Date;
  now: Date;
  bookingStatus: string;
}): SlotDecision {
  if (input.revoked || input.expiresAt <= input.now) {
    return { ok: false, reason: "This confirmation link is no longer active." };
  }
  if (input.bookingStatus === "AWAITING_APPROVAL") {
    return { ok: false, reason: "The representative has not approved this time yet." };
  }
  if (input.bookingStatus === "CANCELED") {
    return {
      ok: false,
      reason: "This lunch was canceled. The link can no longer confirm it.",
    };
  }
  if (input.bookingStatus === "COMPLETED") {
    return { ok: false, reason: "This lunch is already complete." };
  }
  return { ok: true };
}
