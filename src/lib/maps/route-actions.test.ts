import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const mocks = vi.hoisted(() => ({ user: {id:"rep",organizationId:"org",roleKey:"REP"}, find: vi.fn(), lunch: vi.fn(), meeting: vi.fn(), create: vi.fn(), optimize: vi.fn(), rate: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: async () => mocks.user }));
vi.mock("@/lib/db", () => ({ prisma: { account:{findMany:mocks.find}, lunchBooking:{findFirst:mocks.lunch}, meeting:{findFirst:mocks.meeting}, dailyRoute:{create:mocks.create} } }));
vi.mock("@/lib/domain/rate-limit-store", () => ({ consumeSharedRateLimit:mocks.rate }));
vi.mock("./tomtom", () => ({ optimizeDrive:mocks.optimize }));
import { optimizeRouteAction } from "./route-actions";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.find.mockResolvedValue(["a","b","c"].map((id,i) => ({id,name:id,latitude:33+i/10,longitude:-96})));
  mocks.lunch.mockResolvedValue(null); mocks.meeting.mockResolvedValue(null);
  mocks.rate.mockResolvedValue({ok:true});
  mocks.optimize.mockResolvedValue({status:"ok",value:{order:[0,1,2],plan:{durationSeconds:1200,distanceMeters:10000,trafficApplied:true,legs:[{durationSeconds:600,distanceMeters:5000},{durationSeconds:600,distanceMeters:5000}]}}});
  mocks.create.mockResolvedValue({id:"route"});
});
it("enforces assignment scope and refuses unavailable accounts before API calls", async () => {
  mocks.find.mockResolvedValue([]);
  expect(await optimizeRouteAction(["a","b"])).toHaveProperty("error");
  expect(mocks.find.mock.calls[0][0].where).toMatchObject({organizationId:"org",assignments:{some:{userId:"rep",organizationId:"org"}}});
  expect(mocks.optimize).not.toHaveBeenCalled(); expect(mocks.create).not.toHaveBeenCalled();
});
it("protects upcoming lunch and meeting commitments", async () => {
  for (const fixed of [mocks.lunch,mocks.meeting]) {
    fixed.mockResolvedValueOnce({id:"appointment"});
    expect(await optimizeRouteAction(["a","b","c"],true)).toHaveProperty("error");
  }
  expect(mocks.optimize).not.toHaveBeenCalled(); expect(mocks.create).not.toHaveBeenCalled();
});
it("refuses duplicate and oversized selections without accessing records", async () => {
  for (const ids of [["a","a"],Array.from({length:13},(_,i)=>String(i))]) expect(await optimizeRouteAction(ids,true)).toHaveProperty("error");
  expect(mocks.find).not.toHaveBeenCalled();
});
it("saves a lasso route in provider order under the signed-in user", async () => {
  const result = await optimizeRouteAction(["a","b","c"],true);
  expect(result).toHaveProperty("routeId","route");
  expect(mocks.create.mock.calls[0][0].data).toMatchObject({organizationId:"org",userId:"rep",stops:{create:[{accountId:"a",position:1},{accountId:"b",position:2},{accountId:"c",position:3}]}});
});
it("never saves on provider failure or quota exhaustion", async () => {
  mocks.optimize.mockResolvedValueOnce({status:"error",message:"Unavailable"});
  expect(await optimizeRouteAction(["a","b","c"],true)).toEqual({error:"Unavailable"});
  mocks.rate.mockResolvedValueOnce({ok:false});
  expect(await optimizeRouteAction(["a","b","c"],true)).toHaveProperty("error");
  expect(mocks.create).not.toHaveBeenCalled();
});
