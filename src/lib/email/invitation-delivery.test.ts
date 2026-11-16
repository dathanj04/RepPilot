import { expect, it, vi } from "vitest";
const send = vi.hoisted(() => vi.fn());
vi.mock("./send", () => ({ deliverEmail: send }));
import { deliverInvitationEmail } from "./invitation-delivery";
it("returns a non-sent result when optional transport throws after link creation", async () => {
 send.mockRejectedValueOnce(new Error("RESEND_API_KEY missing"));
 expect(await deliverInvitationEmail({organizationId:"org",to:"office@example.test",subject:"Invitation",html:"private",text:"private",idempotencyKey:"invitation:test"})).toEqual({status:"failed"});
});
it("preserves successful transport status", async () => {
 send.mockResolvedValueOnce({status:"sent"});
 expect(await deliverInvitationEmail({organizationId:"org",to:"office@example.test",subject:"Invitation",html:"private",text:"private",idempotencyKey:"invitation:test2"})).toEqual({status:"sent"});
});
