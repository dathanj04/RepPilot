import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const session = vi.hoisted(() => vi.fn(async () => ({})));
vi.mock("iron-session", () => ({ getIronSession: session, nextProxyCookies: () => ({}) }));
vi.mock("@/lib/session-options", () => ({ sessionOptions: () => ({}) }));
import { proxy } from "./proxy";
beforeEach(() => vi.clearAllMocks());
it("serves brand and app icons without requiring a login", async () => {
 for (const path of ["/brand/reppilot-mark-v1.png","/brand/reppilot-icon-192.png","/brand/reppilot-icon-512.png","/brand/reppilot-favicon-32.png","/icon.png?version=1","/apple-icon.png"]) {
  expect((await proxy(new NextRequest(`https://reppilot.app${path}`))).status).toBe(200);
 }
 expect(session).not.toHaveBeenCalled();
});
it("keeps workspace data and other brand paths behind authentication", async () => {
 for (const path of ["/accounts","/api/accounts","/brand/private-data.json","/brand/reppilot-mark-v1.png/private"]) {
  const result = await proxy(new NextRequest(`https://reppilot.app${path}`));
  expect(result.status).toBe(307);
  expect(new URL(result.headers.get("location")!).pathname).toBe("/login");
 }
});
