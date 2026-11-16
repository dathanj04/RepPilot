import { createHmac, timingSafeEqual } from "node:crypto";

export function validStripeSignature(body: string, header: string, secret: string, now = Date.now()) {
  const parts = header.split(",").map(value => value.split("="));
  const timestamp = parts.find(([key]) => key === "t")?.[1];
  if (!timestamp || !/^\d+$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300 || !secret) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest();
  return parts.some(([key,value]) => key === "v1" && /^[a-f0-9]{64}$/i.test(value ?? "") && timingSafeEqual(expected, Buffer.from(value,"hex")));
}
