CREATE TABLE "Scan" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "shop" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'COMPLETED',
  "productCount" INTEGER NOT NULL DEFAULT 0,
  "missingTitle" INTEGER NOT NULL DEFAULT 0,
  "missingDescription" INTEGER NOT NULL DEFAULT 0,
  "missingImage" INTEGER NOT NULL DEFAULT 0,
  "missingSku" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3)
);

CREATE INDEX "Scan_shop_createdAt_idx"
ON "Scan"("shop", "createdAt");