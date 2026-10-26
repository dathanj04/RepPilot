import { describe, expect, it } from "vitest";
import { isCursorPreviewHost, isPreviewRequest } from "./session-seal";

describe("preview host detection", () => {
  it("recognizes Cursor preview hosts and rejects lookalikes", () => {
    expect(isCursorPreviewHost("https://app.agent.cvm.dev/login")).toBe(true);
    expect(isCursorPreviewHost("pod.cursorvm.com")).toBe(true);
    expect(isCursorPreviewHost("app.agent.cvm.dev.evil.example")).toBe(false);
    expect(isCursorPreviewHost("sidelineloop.com")).toBe(false);
    expect(isCursorPreviewHost("localhost")).toBe(false);
  });

  it("treats a request as preview only when a preview host is present", () => {
    const production = (name: string) => (name === "host" ? "reppilot.example" : null);
    const preview = (name: string) => (name === "x-forwarded-host" ? "pod.agent.cvm.dev" : "reppilot.example");
    expect(isPreviewRequest(production)).toBe(false);
    expect(isPreviewRequest(preview)).toBe(true);
  });
});
