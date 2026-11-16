import { deliverEmail } from "./send";
import type { OutboundEmail } from "../services/reminders";

/** A saved private link remains usable even when its optional email cannot be delivered. */
export async function deliverInvitationEmail(message: OutboundEmail): Promise<{ status: string }> {
  try { return await deliverEmail(message); }
  catch { return { status: "failed" }; }
}
