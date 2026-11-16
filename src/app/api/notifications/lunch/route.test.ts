import { expect, it, vi } from "vitest";
const find=vi.hoisted(()=>vi.fn());
vi.mock("@/lib/auth",()=>({getCurrentUser:async()=>({id:"rep",organizationId:"org"})}));
vi.mock("@/lib/db",()=>({prisma:{lunchBooking:{findMany:find}}}));
import { GET } from "./route";
it("returns pending approvals for the authenticated rep only, without caching",async()=>{
 find.mockResolvedValue([{id:"lunch",slotStartsAt:new Date('2026-11-20T18:00:00Z'),account:{name:"Practice"}}]);
 const response=await GET();
 expect(find.mock.calls[0][0].where).toEqual({organizationId:"org",representativeId:"rep",status:"AWAITING_APPROVAL"});
 expect(response.headers.get('Cache-Control')).toBe('private, no-store');
 expect(await response.json()).toEqual({lunches:[{id:"lunch",name:"Practice",startsAt:'2026-11-20T18:00:00.000Z'}]});
});
