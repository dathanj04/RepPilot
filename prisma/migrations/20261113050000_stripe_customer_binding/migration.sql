ALTER TABLE "Subscription" ADD COLUMN "stripeCustomerId" TEXT, ADD COLUMN "billingPayerUserId" TEXT, ADD COLUMN "stripeCheckoutId" TEXT;
CREATE UNIQUE INDEX "Subscription_stripeCustomerId_key" ON "Subscription"("stripeCustomerId");
