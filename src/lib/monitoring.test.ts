import { describe, expect, it } from "vitest";
import { parseSentryDsn, safeMonitoringFields } from "./monitoring";

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

it("excludes personal data and token-bearing request URLs",()=>{
 expect(safeMonitoringFields({path:"/password-reset?token=secret",message:"private@example.com",stack:"private sql",route:"/accounts/[id]",method:"POST"})).toEqual({route:"/accounts/[id]",method:"POST",routeType:undefined});
 expect(safeMonitoringFields({route:"/reset?token=secret"}).route).toBe("unknown");
});
