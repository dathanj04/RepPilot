/** Presentation/payment-channel marker only. Never use this to grant data access. */
export function isNativeShell(userAgent: string | null) {
  return /(?:^|\s)RepPilotNative\/\d+(?:\.\d+)*(?:\s|$)/.test(userAgent || "");
}
