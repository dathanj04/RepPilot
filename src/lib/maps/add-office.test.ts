import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({user:vi.fn(),duplicate:vi.fn(),create:vi.fn(),assign:vi.fn(),audit:vi.fn(),transaction:vi.fn(),revalidate:vi.fn()}));
vi.mock("../auth",()=>({getCurrentUser:mocks.user}));
vi.mock("../db",()=>({prisma:{$transaction:mocks.transaction}}));
vi.mock("../services/accounts",()=>({findDuplicateAccount:mocks.duplicate}));
vi.mock("next/cache",()=>({revalidatePath:mocks.revalidate}));
import { addDiscoveredAccountAction } from "./actions";
const form=()=>{const f=new FormData();for(const [key,value] of Object.entries({name:"Example Pediatrics",specialty:"Pediatrics",street:"123 Example St",city:"Frisco",state:"TX",zip:"75034",latitude:"33.1",longitude:"-96.8",organizationId:"other-org",userId:"other-user"}))f.set(key,value);return f;};
beforeEach(()=>{vi.clearAllMocks();mocks.user.mockResolvedValue({id:"current-user",organizationId:"current-org"});mocks.duplicate.mockResolvedValue(null);mocks.create.mockResolvedValue({id:"new-account"});mocks.assign.mockResolvedValue({});mocks.audit.mockResolvedValue({});mocks.transaction.mockImplementation(fn=>fn({account:{create:mocks.create},accountAssignment:{create:mocks.assign},auditLog:{create:mocks.audit}}));});
describe("add discovered offices",()=>{
 it("creates and assigns the office atomically using the signed-in identity",async()=>{expect(await addDiscoveredAccountAction(form())).toEqual({accountId:"new-account"});expect(mocks.transaction).toHaveBeenCalledTimes(1);expect(mocks.create.mock.calls[0][0].data.organizationId).toBe("current-org");expect(mocks.assign.mock.calls[0][0].data).toEqual({organizationId:"current-org",accountId:"new-account",userId:"current-user"});expect(mocks.revalidate).toHaveBeenCalledWith("/map");expect(mocks.revalidate).toHaveBeenCalledWith("/accounts");});
 it("does not create another copy of an existing office",async()=>{mocks.duplicate.mockResolvedValue({id:"existing"});expect(await addDiscoveredAccountAction(form())).toMatchObject({error:expect.any(String),accountId:"existing"});expect(mocks.transaction).not.toHaveBeenCalled();});
 it("rejects incomplete addresses and invalid coordinates",async()=>{const data=form();data.set("latitude","999");expect(await addDiscoveredAccountAction(data)).toHaveProperty("error");data.set("latitude","33");data.set("street","");expect(await addDiscoveredAccountAction(data)).toHaveProperty("error");expect(mocks.transaction).not.toHaveBeenCalled();});
 it("does not report success when assignment fails",async()=>{mocks.assign.mockRejectedValue(new Error("assignment failed"));await expect(addDiscoveredAccountAction(form())).rejects.toThrow("assignment failed");expect(mocks.revalidate).not.toHaveBeenCalled();});
});
