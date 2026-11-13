import { describe, expect, it, vi } from "vitest";
import { savePersonalBillingProfile } from "./billing-profile";
describe("personal billing details", () => {
 it("writes only the authenticated user's profile and normalizes contact details", async () => { const update=vi.fn().mockResolvedValue({}); await savePersonalBillingProfile({user:{update}},"signed-in-user",{billingName:" Test Person ",billingEmail:" TEST@EXAMPLE.COM "}); expect(update).toHaveBeenCalledWith({where:{id:"signed-in-user"},data:{billingName:"Test Person",billingEmail:"test@example.com"}}); });
 it("does not write invalid details", async () => { const update=vi.fn(); expect(await savePersonalBillingProfile({user:{update}},"user-1",{billingName:"A",billingEmail:"x"})).toHaveProperty("error"); expect(update).not.toHaveBeenCalled(); });
 it("does not accept another user's id in the submitted values", async () => { const update=vi.fn().mockResolvedValue({}); const input={billingName:"Test Person",billingEmail:"test@example.com",userId:"another-user"}; await savePersonalBillingProfile({user:{update}},"session-user",input); expect(update.mock.calls[0][0].where.id).toBe("session-user"); expect(update.mock.calls[0][0].data).not.toHaveProperty("userId"); });
});
