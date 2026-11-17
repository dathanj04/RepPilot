CREATE TABLE "OperationalEvent" (
 "fingerprint" TEXT NOT NULL PRIMARY KEY,
 "kind" TEXT NOT NULL,
 "route" TEXT NOT NULL,
 "occurrences" INTEGER NOT NULL DEFAULT 1,
 "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "OperationalEvent_lastSeenAt_idx" ON "OperationalEvent"("lastSeenAt");
