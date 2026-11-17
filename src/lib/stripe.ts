import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const STRIPE_API = "https://api.stripe.com/v1";
type StripeError = { error?: { message?: string } };

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET && process.env.STRIPE_PRICE_INDIVIDUAL && process.env.STRIPE_PRICE_BUSINESS);
}

export async function stripePost<T>(path: string, params: URLSearchParams, idempotencyKey?: string): Promise<T> {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Stripe is not configured");
  const response = await fetch(STRIPE_API + path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "content-type": "application/x-www-form-urlencoded",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: params.toString(),
    cache: "no-store",
  });
  const data = await response.json() as T & StripeError;
  if (!response.ok) throw new Error(data.error?.message || "Stripe request failed");
  return data;
}

export async function stripeGet<T>(path: string): Promise<T> {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Stripe is not configured");
  const response = await fetch(STRIPE_API + path, {
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
    cache: "no-store",
  });
  const data = await response.json() as T & StripeError;
  if (!response.ok) throw new Error(data.error?.message || "Stripe request failed");
  return data;
}

export function verifyStripeSignature(payload: string, header: string, secret: string, now = Math.floor(Date.now() / 1000)): boolean {
  const fields = header.split(",").map(part => part.trim());
  const timestamp = fields.find(part => part.startsWith("t="))?.slice(2);
  const signatures = fields.filter(part => part.startsWith("v1=")).map(part => part.slice(3));
  if (!timestamp || !/^\d+$/.test(timestamp) || signatures.length === 0) return false;
  const time = Number(timestamp);
  if (!Number.isSafeInteger(time) || Math.abs(now - time) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest();
  return signatures.some(signature => {
    if (!/^[0-9a-f]{64}$/i.test(signature)) return false;
    const received = Buffer.from(signature, "hex");
    return received.length === expected.length && timingSafeEqual(received, expected);
  });
}
