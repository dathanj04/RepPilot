-- Separate catering approval and receipt files. Existing orders stay NOT_REQUESTED.

ALTER TABLE "CateringOrder" ADD COLUMN "approvalStatus" TEXT NOT NULL DEFAULT 'NOT_REQUESTED';
ALTER TABLE "CateringOrder" ADD COLUMN "subtotalCents" INTEGER;
ALTER TABLE "CateringOrder" ADD COLUMN "taxCents" INTEGER;
ALTER TABLE "CateringOrder" ADD COLUMN "feeCents" INTEGER;
ALTER TABLE "CateringOrder" ADD COLUMN "deliveryCents" INTEGER;
ALTER TABLE "CateringOrder" ADD COLUMN "tipCents" INTEGER;
ALTER TABLE "CateringOrder" ADD COLUMN "deliveryStatus" TEXT NOT NULL DEFAULT 'NOT_TRACKED';

ALTER TABLE "OrderReceipt" ADD COLUMN "fileName" TEXT;
ALTER TABLE "OrderReceipt" ADD COLUMN "contentType" TEXT;
ALTER TABLE "OrderReceipt" ADD COLUMN "byteSize" INTEGER;
ALTER TABLE "OrderReceipt" ADD COLUMN "content" BYTEA;

CREATE INDEX "CateringOrder_organizationId_approvalStatus_idx" ON "CateringOrder"("organizationId", "approvalStatus");
