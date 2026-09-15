CREATE TABLE "Issue" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "scanId" TEXT NOT NULL,
  "ruleId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "whyItMatters" TEXT NOT NULL,
  "howToFix" TEXT NOT NULL,
  "affectedCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Issue_scanId_fkey"
    FOREIGN KEY ("scanId")
    REFERENCES "Scan"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE TABLE "IssueInstance" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "issueId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "productTitle" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "IssueInstance_issueId_fkey"
    FOREIGN KEY ("issueId")
    REFERENCES "Issue"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE INDEX "Issue_scanId_idx"
ON "Issue"("scanId");

CREATE INDEX "Issue_ruleId_idx"
ON "Issue"("ruleId");

CREATE INDEX "Issue_severity_idx"
ON "Issue"("severity");

CREATE INDEX "IssueInstance_issueId_idx"
ON "IssueInstance"("issueId");

CREATE INDEX "IssueInstance_productId_idx"
ON "IssueInstance"("productId");