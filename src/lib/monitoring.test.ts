import { describe, expect, it } from "vitest";
import { parseSentryDsn } from "./monitoring";

describe("Sentry DSN", () => {
  it("parses a project DSN and rejects incomplete values", () => {
    expect(parseSentryDsn("https://public-key@o123.ingest.sentry.io/456")).toEqual({
      publicKey: "public-key",
      storeUrl: "https://o123.ingest.sentry.io/api/456/store/",
    });
    expect(parseSentryDsn("not a dsn")).toBeNull();
    expect(parseSentryDsn("https://o123.ingest.sentry.io/456")).toBeNull();
  });
});
