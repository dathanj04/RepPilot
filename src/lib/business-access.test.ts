import {beforeEach,it,expect,vi} from "vitest";
vi.mock("server-only",()=>({}));
const user=vi.hoisted(()=>vi.fn());
vi.mock("./auth",()=>({getCurrentUser:user}));
import {getBusinessUser} from "./business-access";
beforeEach(()=>vi.clearAllMocks());
it("rejects Individual at the server boundary",async()=>{user.mockResolvedValue({planTier:"individual"});await expect(getBusinessUser()).rejects.toThrow("upgrade to Business");});
it("allows full Business trial and paid access",async()=>{user.mockResolvedValue({planTier:"business"});await expect(getBusinessUser()).resolves.toEqual({planTier:"business"});});
