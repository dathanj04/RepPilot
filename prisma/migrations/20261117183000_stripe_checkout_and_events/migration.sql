ALTER TABLE "Subscription" ADD COLUMN "checkoutSessionId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "checkoutSessionExpiresAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "Subscription_checkoutSessionId_key" ON "Subscription"("checkoutSessionId");
CREATE TABLE "StripeWebhookEvent" (
  "id" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("id")
);
