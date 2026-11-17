import {createHmac,createHash,randomBytes,timingSafeEqual} from "node:crypto";
const ALPHABET="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function base32(bytes:Buffer){let bits=0,value=0,out="";for(const byte of bytes){value=(value<<8)|byte;bits+=8;while(bits>=5){out+=ALPHABET[(value>>>(bits-5))&31];bits-=5;}}if(bits)out+=ALPHABET[(value<<(5-bits))&31];return out;}
function decode(secret:string){let bits=0,value=0;const out:number[]=[];for(const c of secret.toUpperCase().replace(/=+$/, "")){const n=ALPHABET.indexOf(c);if(n<0)throw Error("Invalid authenticator secret");value=(value<<5)|n;bits+=5;if(bits>=8){out.push((value>>>(bits-8))&255);bits-=8;}}return Buffer.from(out);}
export function newAuthenticatorSecret(){return base32(randomBytes(20));}
export function totp(secret:string,step:number,digits=6){const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(step));const h=createHmac("sha1",decode(secret)).update(counter).digest();const i=h[h.length-1]&15;return String((h.readUInt32BE(i)&0x7fffffff)%10**digits).padStart(digits,"0");}
export function verifiedStep(secret:string,code:string,now=Date.now(),lastUsedStep:bigint|null=null){if(!/^\d{6}$/.test(code))return null;const current=Math.floor(now/30000);for(const step of [current,current-1,current+1]){if(step<0||(lastUsedStep!==null&&BigInt(step)<=lastUsedStep))continue;const expected=totp(secret,step);if(timingSafeEqual(Buffer.from(expected),Buffer.from(code)))return BigInt(step);}return null;}
export function recoveryHash(userId:string,code:string){return createHash("sha256").update("reppilot-recovery-v1:"+userId+":"+code.replace(/[-\s]/g,"").toUpperCase()).digest("hex");}
export function newRecoveryCodes(){return Array.from({length:10},()=>randomBytes(12).toString("hex").toUpperCase().match(/.{1,4}/g)!.join("-"));}
export function mfaSessionFresh(at:number|undefined,now=Date.now()){return typeof at==="number"&&Number.isFinite(at)&&at<=now&&now-at<30*60000;}
