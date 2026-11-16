import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only",()=>({}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("next/navigation",()=>({redirect:(path:string)=>{throw new Error(`REDIRECT:${path}`);}}));
const mocks=vi.hoisted(()=>({role:"ORG_ADMIN",org:vi.fn(),update:vi.fn(),transaction:vi.fn()}));
vi.mock("./auth",()=>({getCurrentUser:async()=>({id:"admin",organizationId:"org",roleKey:mocks.role,trialDaysLeft:5})}));
vi.mock("./compliance-access",()=>({hasBusinessCompliance:async()=>false}));
vi.mock("./db",()=>({prisma:{organization:{findUniqueOrThrow:mocks.org},$transaction:mocks.transaction}}));
import { updateOrgAction } from "./actions";
function form(){const f=new FormData();for(const [key,value] of Object.entries({name:"New company",emailFromName:"RepPilot Outreach",recentVisitDays:"14",overdueVisitDays:"45",invitationExpiryHours:"48",workdayStart:"08:00",workdayEnd:"17:00",allow24:"on"}))f.set(key,value);return f;}
beforeEach(()=>{vi.clearAllMocks();mocks.role="ORG_ADMIN";mocks.org.mockResolvedValue({id:"org",name:"Old company",settings:{}});mocks.transaction.mockImplementation(async callback=>callback({organization:{update:mocks.update}}));});
it("saves the actual display name and settings in a transaction",async()=>{expect(await updateOrgAction(form())).toEqual({ok:true});expect(mocks.transaction).toHaveBeenCalledOnce();expect(mocks.update.mock.calls[0][0].data.branding).toEqual({displayName:"New company",emailFromName:"RepPilot Outreach"});});
it("rejects invalid day settings without persisting values that reset on reload",async()=>{const data=form();data.set('recentVisitDays','-1');expect(await updateOrgAction(data)).toMatchObject({ok:false});expect(mocks.transaction).not.toHaveBeenCalled();});
it("does not report success on a transaction failure",async()=>{mocks.transaction.mockRejectedValueOnce(new Error('database unavailable'));await expect(updateOrgAction(form())).rejects.toThrow('database unavailable');});
it("refuses organization settings writes from a representative",async()=>{mocks.role='REP';await expect(updateOrgAction(form())).rejects.toThrow('administrator');expect(mocks.transaction).not.toHaveBeenCalled();});
