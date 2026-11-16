import { expect, it } from "vitest";
import { isNativeShell } from "./native-shell";
it("recognizes the configured iOS/Android shell marker",()=>{expect(isNativeShell('Mozilla/5.0 RepPilotNative/1.0')).toBe(true);});
it("leaves normal browser billing available",()=>{for(const ua of [null,'Mozilla/5.0','NotRepPilotNative/1.0']) expect(isNativeShell(ua)).toBe(false);});
