-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('QUEUED', 'FETCHING', 'ANALYZING', 'CALCULATING', 'PERSISTING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO');

-- CreateEnum
CREATE TYPE "IssueCategory" AS ENUM ('PRODUCT_INFORMATION', 'MEDIA', 'SEO', 'INVENTORY', 'VARIANTS');

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "refreshToken" TEXT,
    "refreshTokenExpires" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scan" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "status" "ScanStatus" NOT NULL DEFAULT 'QUEUED',
    "productCount" INTEGER NOT NULL DEFAULT 0,
    "healthScore" INTEGER,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Scan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Issue" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "category" "IssueCategory" NOT NULL DEFAULT 'PRODUCT_INFORMATION',
    "severity" "Severity" NOT NULL DEFAULT 'MEDIUM',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "whyItMatters" TEXT NOT NULL,
    "howToFix" TEXT NOT NULL,
    "affectedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssueInstance" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "variantId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssueInstance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Scan_shop_createdAt_idx" ON "Scan"("shop", "createdAt");

-- CreateIndex
CREATE INDEX "Scan_shop_status_idx" ON "Scan"("shop", "status");

-- CreateIndex
CREATE INDEX "Issue_scanId_idx" ON "Issue"("scanId");

-- CreateIndex
CREATE INDEX "Issue_ruleId_idx" ON "Issue"("ruleId");

-- CreateIndex
CREATE INDEX "Issue_severity_idx" ON "Issue"("severity");

-- CreateIndex
CREATE UNIQUE INDEX "Issue_scanId_ruleId_key" ON "Issue"("scanId", "ruleId");

-- CreateIndex
CREATE INDEX "IssueInstance_issueId_idx" ON "IssueInstance"("issueId");

-- CreateIndex
CREATE INDEX "IssueInstance_productId_idx" ON "IssueInstance"("productId");

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueInstance" ADD CONSTRAINT "IssueInstance_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
