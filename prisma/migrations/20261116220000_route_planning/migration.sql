-- Nullable additive field keeps all existing routes and RouteStop relations intact.
ALTER TABLE "DailyRoute" ADD COLUMN "planning" JSONB;
