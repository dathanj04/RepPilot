import {describe,it,expect} from "vitest";
import {base32,totp,verifiedStep,recoveryHash,newRecoveryCodes,mfaSessionFresh} from "./totp";
describe("owner authenticator security",()=>{
 const secret=base32(Buffer.from("12345678901234567890"));
 it.each([[59,"94287082"],[1111111109,"07081804"],[1111111111,"14050471"],[1234567890,"89005924"],[2000000000,"69279037"],[20000000000,"65353130"]])("matches RFC 6238 at %s",(seconds,expected)=>{expect(totp(secret,Math.floor(Number(seconds)/30),8)).toBe(expected);});
 it("accepts clock skew once but rejects replay and malformed codes",()=>{
  const now=1234567890000,step=Math.floor(now/30000),code=totp(secret,step);
  expect(verifiedStep(secret,code,now)).toBe(BigInt(step));
  expect(verifiedStep(secret,code,now,BigInt(step))).toBeNull();
  expect(verifiedStep(secret,totp(secret,step+1),now)).toBe(BigInt(step+1));
  expect(verifiedStep(secret,totp(secret,step-2),now)).toBeNull();
  expect(verifiedStep(secret,"12345",now)).toBeNull();
 });
 it("scopes normalized recovery hashes to one user and creates unique codes",()=>{
  const codes=newRecoveryCodes();expect(new Set(codes).size).toBe(10);
  expect(recoveryHash("a",codes[0].toLowerCase().replaceAll("-"," "))).toBe(recoveryHash("a",codes[0]));
  expect(recoveryHash("b",codes[0])).not.toBe(recoveryHash("a",codes[0]));
 });
 it("rejects missing, expired and future session proof",()=>{
  const now=2000000;expect(mfaSessionFresh(now-1,now)).toBe(true);
  for(const at of [undefined,NaN,Infinity,now+1,now-1800000])expect(mfaSessionFresh(at,now)).toBe(false);
 });
});
