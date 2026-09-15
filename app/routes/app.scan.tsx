import { useState } from "react";
import { useFetcher } from "react-router";
import type { ActionFunctionArgs } from "react-router";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  catalogRules,
  type CatalogProduct,
} from "../rules/catalogRules";

type ScanIssue = {
  ruleId: string;
  title: string;
  severity: string;
  category: string;
};

type ScanProductResult = {
  id: string;
  title: string;
  issues: ScanIssue[];
};

type ScanFinding = {
  ruleId: string;
  title: string;
  severity: string;
  category: string;
  count: number;
};

type ScanResult = {
  shop: string;
  productCount: number;
  healthScore: number;
  findings: ScanFinding[];
  products: ScanProductResult[];
};

type ShopifyProductsResponse = {
  data?: {
    products?: {
      nodes: CatalogProduct[];
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string | null;
      };
    };
  };
  errors?: Array<{
    message: string;
  }>;
};

const PRODUCTS_QUERY = `#graphql
  query ScanProducts($cursor: String) {
    products(first: 250, after: $cursor) {
      nodes {
        id
        title
        descriptionHtml
        status
        totalInventory
        featuredImage {
          id
        }
        variants(first: 100) {
          nodes {
            id
            title
            price
            sku
            inventoryQuantity
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const severityPenalty: Record<string, number> = {
  CRITICAL: 0.3,
  HIGH: 0.18,
  MEDIUM: 0.07,
};

const calculateHealthScore = (
  productResults: ScanProductResult[],
) => {
  if (productResults.length === 0) {
    return 100;
  }

  const totalProductHealth = productResults.reduce(
    (total, product) => {
      if (product.issues.length === 0) {
        return total + 1;
      }

      let productHealth = 1;

      for (const issue of product.issues) {
        const penalty = severityPenalty[issue.severity] ?? 0.05;
        productHealth *= 1 - penalty;
      }

      return total + productHealth;
    },
    0,
  );

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (totalProductHealth / productResults.length) * 100,
      ),
    ),
  );
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const products: CatalogProduct[] = [];
  let cursor: string | null = null;

  do {
    const response = await admin.graphql(PRODUCTS_QUERY, {
      variables: {
        cursor,
      },
    });

    const data =
      (await response.json()) as ShopifyProductsResponse;

    if (data.errors?.length) {
      throw new Response(
        `Shopify API error: ${data.errors
          .map((error) => error.message)
          .join(", ")}`,
        { status: 500 },
      );
    }

    const connection = data.data?.products;

    if (!connection) {
      throw new Response(
        "Shopify did not return product data.",
        { status: 500 },
      );
    }

    products.push(...connection.nodes);

    cursor = connection.pageInfo.hasNextPage
      ? connection.pageInfo.endCursor
      : null;
  } while (cursor);

  const productResults: ScanProductResult[] = products.map(
    (product) => {
      const issues: ScanIssue[] = catalogRules
        .filter((rule) => rule.check(product))
        .map((rule) => ({
          ruleId: rule.id,
          title: rule.title,
          severity: rule.severity,
          category: rule.category,
        }));

      return {
        id: product.id,
        title: product.title || "Untitled product",
        issues,
      };
    },
  );

  const findings: ScanFinding[] = catalogRules
    .map((rule) => ({
      ruleId: rule.id,
      title: rule.title,
      severity: rule.severity,
      category: rule.category,
      count: productResults.filter((product) =>
        product.issues.some(
          (issue) => issue.ruleId === rule.id,
        ),
      ).length,
    }))
    .filter((finding) => finding.count > 0)
    .sort((a, b) => {
      const severityOrder: Record<string, number> = {
        CRITICAL: 0,
        HIGH: 1,
        MEDIUM: 2,
      };

      const severityDifference =
        (severityOrder[a.severity] ?? 3) -
        (severityOrder[b.severity] ?? 3);

      if (severityDifference !== 0) {
        return severityDifference;
      }

      return b.count - a.count;
    });

  const healthScore = calculateHealthScore(productResults);

  const scanId = crypto.randomUUID();

  const scan = await prisma.scan.create({
    data: {
      id: scanId,
      shop: session.shop,
      status: "COMPLETED",
      productCount: products.length,
      healthScore,
      missingTitle:
        findings.find(
          (finding) => finding.ruleId === "missing-title",
        )?.count ?? 0,
      missingDescription:
        findings.find(
          (finding) =>
            finding.ruleId === "missing-description",
        )?.count ?? 0,
      missingImage:
        findings.find(
          (finding) => finding.ruleId === "missing-image",
        )?.count ?? 0,
      missingSku:
        findings.find(
          (finding) => finding.ruleId === "missing-sku",
        )?.count ?? 0,
      completedAt: new Date(),
    },
  });

  for (const finding of findings) {
    const rule = catalogRules.find(
      (catalogRule) => catalogRule.id === finding.ruleId,
    );

    if (!rule) {
      continue;
    }

    const affectedProducts = productResults.filter((product) =>
      product.issues.some(
        (issue) => issue.ruleId === finding.ruleId,
      ),
    );

    const issue = await prisma.issue.create({
      data: {
        id: crypto.randomUUID(),
        scanId: scan.id,
        ruleId: rule.id,
        category: rule.category,
        severity: rule.severity,
        title: rule.title,
        description: rule.description,
        whyItMatters: rule.whyItMatters,
        howToFix: rule.howToFix,
        affectedCount: affectedProducts.length,
      },
    });

    if (affectedProducts.length > 0) {
      await prisma.issueInstance.createMany({
        data: affectedProducts.map((product) => ({
          id: crypto.randomUUID(),
          issueId: issue.id,
          productId: product.id,
          productTitle: product.title,
        })),
      });
    }
  }

  const result: ScanResult = {
    shop: session.shop,
    productCount: products.length,
    healthScore,
    findings,
    products: productResults
      .filter((product) => product.issues.length > 0)
      .sort((a, b) => {
        const severityRank = (product: ScanProductResult) =>
          Math.min(
            ...product.issues.map(
              (issue) =>
                ({
                  CRITICAL: 0,
                  HIGH: 1,
                  MEDIUM: 2,
                })[issue.severity] ?? 3,
            ),
          );

        return severityRank(a) - severityRank(b);
      }),
  };

  return result;
};

const issueTone = (issue: {
  title: string;
  category: string;
}) => {
  if (issue.category === "Images") {
    return "image";
  }

  if (issue.category === "Identifiers") {
    return "sku";
  }

  if (issue.category === "Pricing & Availability") {
    return "pricing";
  }

  if (issue.category === "Variants") {
    return "variants";
  }

  return "description";
};

const severityTone = (severity: string) => {
  if (severity === "CRITICAL") {
    return "critical";
  }

  if (severity === "HIGH") {
    return "high";
  }

  return "medium";
};

export default function Scan() {
  const fetcher = useFetcher<typeof action>();
  const [started, setStarted] = useState(false);

  const scanning = fetcher.state !== "idle";
  const result = fetcher.data as ScanResult | undefined;

  const startScan = () => {
    setStarted(true);

    fetcher.submit(null, {
      method: "post",
    });
  };

  const resetScan = () => {
    setStarted(false);
  };

  return (
    <s-page heading="Catalog Scan">
      <style>{`
        .scan-shell {
          max-width: 1080px;
          margin: 0 auto;
          padding: 32px 0 64px;
        }

        .scan-intro {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 32px;
          margin-bottom: 32px;
        }

        .scan-eyebrow {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #899292;
          margin-bottom: 10px;
        }

        .scan-title {
          margin: 0;
          color: #183030;
          font-size: 36px;
          line-height: 1.05;
          font-weight: 400;
          letter-spacing: -0.025em;
        }

        .scan-description {
          max-width: 560px;
          margin: 12px 0 0;
          color: #526060;
          font-size: 15px;
          line-height: 1.55;
        }

        .scan-store {
          flex-shrink: 0;
          padding: 10px 14px;
          border: 1px solid #dde1dc;
          border-radius: 10px;
          background: #fbfcf9;
          color: #526060;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 11px;
        }

        .scan-card {
          border: 1px solid #dde1dc;
          border-radius: 14px;
          background: #fbfcf9;
          overflow: hidden;
        }

        .scan-ready {
          padding: 64px 48px;
          text-align: center;
        }

        .scan-orb {
          width: 56px;
          height: 56px;
          margin: 0 auto 20px;
          border-radius: 50%;
          background: #e6f4fc;
          border: 1px solid #a8d8f0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #1890f0;
          font-size: 22px;
        }

        .scan-ready-title {
          margin: 0;
          color: #183030;
          font-size: 22px;
          font-weight: 500;
        }

        .scan-ready-copy {
          max-width: 480px;
          margin: 10px auto 24px;
          color: #526060;
          line-height: 1.55;
          font-size: 14px;
        }

        .scan-progress {
          padding: 72px 48px;
          text-align: center;
        }

        .scan-spinner {
          width: 44px;
          height: 44px;
          margin: 0 auto 22px;
          border: 2px solid #dce9ed;
          border-top-color: #1890f0;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .scan-progress-title {
          margin: 0;
          color: #183030;
          font-size: 21px;
          font-weight: 500;
        }

        .scan-progress-copy {
          margin: 10px 0 0;
          color: #899292;
          font-size: 14px;
        }

        .scan-complete {
          padding: 32px;
        }

        .scan-complete-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding-bottom: 28px;
          border-bottom: 1px solid #e8ebe6;
        }

        .complete-label {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: #3c9b58;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .complete-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #7edb91;
        }

        .complete-title {
          margin: 7px 0 0;
          color: #183030;
          font-size: 24px;
          font-weight: 400;
          letter-spacing: -0.015em;
        }

        .score-row {
          display: grid;
          grid-template-columns: 180px 1fr;
          gap: 32px;
          align-items: center;
          padding: 28px 0;
          border-bottom: 1px solid #e8ebe6;
        }

        .score-value {
          color: #183030;
          font-size: 52px;
          line-height: 1;
          font-weight: 300;
          letter-spacing: -0.04em;
        }

        .score-value span {
          font-size: 20px;
          color: #899292;
          margin-left: 4px;
        }

        .score-label {
          margin-top: 8px;
          color: #899292;
          font-size: 12px;
        }

        .score-copy {
          color: #526060;
          font-size: 14px;
          line-height: 1.55;
          max-width: 560px;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          border-bottom: 1px solid #e8ebe6;
        }

        .summary-item {
          padding: 22px 20px;
          border-right: 1px solid #e8ebe6;
        }

        .summary-item:last-child {
          border-right: 0;
        }

        .summary-number {
          color: #183030;
          font-size: 28px;
          line-height: 1;
          font-weight: 400;
        }

        .summary-label {
          margin-top: 7px;
          color: #899292;
          font-size: 12px;
          line-height: 1.35;
        }

        .products-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 28px 0 18px;
        }

        .products-title {
          margin: 0;
          color: #183030;
          font-size: 18px;
          font-weight: 500;
        }

        .products-count {
          color: #899292;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 11px;
        }

        .product-list {
          display: flex;
          flex-direction: column;
          border-top: 1px solid #e8ebe6;
        }

        .product-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          padding: 18px 0;
          border-bottom: 1px solid #e8ebe6;
        }

        .product-main {
          min-width: 0;
        }

        .product-name {
          color: #183030;
          font-size: 14px;
          font-weight: 500;
        }

        .product-id {
          margin-top: 4px;
          color: #b0b7b3;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 10px;
        }

        .issue-list {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 6px;
        }

        .issue-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 8px;
          border-radius: 999px;
          font-size: 11px;
          line-height: 1;
          border: 1px solid #dde1dc;
          background: #f5f6f1;
          color: #526060;
          white-space: nowrap;
        }

        .issue-badge.image {
          background: #fff0c7;
          border-color: #f3c96b;
          color: #725b1c;
        }

        .issue-badge.sku {
          background: #e6f4fc;
          border-color: #a8d8f0;
          color: #246584;
        }

        .issue-badge.pricing {
          background: #fbe0db;
          border-color: #f29a8b;
          color: #87483e;
        }

        .issue-badge.description {
          background: #f1eefb;
          border-color: #d8d0f2;
          color: #62577e;
        }

        .issue-badge.variants {
          background: #ddf4e2;
          border-color: #7edb91;
          color: #356744;
        }

        .scan-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          padding-top: 28px;
        }

        .scan-footer-copy {
          color: #899292;
          font-size: 12px;
        }

        .empty-products {
          padding: 40px 20px;
          text-align: center;
          border-top: 1px solid #e8ebe6;
          color: #526060;
          font-size: 14px;
        }

        .severity-critical {
          color: #9a3023;
        }

        .severity-high {
          color: #a05a00;
        }

        .severity-medium {
          color: #62577e;
        }

        @media (max-width: 700px) {
          .scan-shell {
            padding: 20px 0 40px;
          }

          .scan-intro {
            flex-direction: column;
            align-items: flex-start;
          }

          .scan-complete {
            padding: 24px;
          }

          .scan-complete-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .score-row {
            grid-template-columns: 1fr;
            gap: 16px;
          }

          .summary-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .summary-item {
            border-bottom: 1px solid #e8ebe6;
          }

          .summary-item:nth-child(even) {
            border-right: 0;
          }

          .product-row {
            align-items: flex-start;
            flex-direction: column;
            gap: 10px;
          }

          .issue-list {
            justify-content: flex-start;
          }

          .scan-footer {
            align-items: flex-start;
            flex-direction: column;
          }
        }
      `}</style>

      <div className="scan-shell">
        <div className="scan-intro">
          <div>
            <div className="scan-eyebrow">
              Catalog health
            </div>

            <h1 className="scan-title">
              Find what needs fixing.
            </h1>

            <p className="scan-description">
              Scan your Shopify catalog for missing or
              incomplete product data, then see exactly which
              products need attention.
            </p>
          </div>

          <div className="scan-store">
            {result?.shop ?? "Shopify store"}
          </div>
        </div>

        <div className="scan-card">
          {!started && (
            <div className="scan-ready">
              <div className="scan-orb">⌁</div>

              <h2 className="scan-ready-title">
                Your catalog is ready to check
              </h2>

              <p className="scan-ready-copy">
                We’ll look through your products and flag missing
                descriptions, images, SKUs, prices, and other
                catalog issues.
              </p>

              <s-button
                variant="primary"
                onClick={startScan}
              >
                Scan my catalog
              </s-button>
            </div>
          )}

          {scanning && (
            <div className="scan-progress">
              <div className="scan-spinner" />

              <h2 className="scan-progress-title">
                Looking through your catalog…
              </h2>

              <p className="scan-progress-copy">
                Checking product data and looking for issues.
              </p>
            </div>
          )}

          {result && !scanning && (
            <div className="scan-complete">
              <div className="scan-complete-header">
                <div>
                  <div className="complete-label">
                    <span className="complete-dot" />
                    Scan complete
                  </div>

                  <h2 className="complete-title">
                    We checked {result.productCount} products.
                  </h2>
                </div>

                <s-button onClick={resetScan}>
                  Scan again
                </s-button>
              </div>

              <div className="score-row">
                <div>
                  <div className="score-value">
                    {result.healthScore}
                    <span>/100</span>
                  </div>

                  <div className="score-label">
                    Catalog health score
                  </div>
                </div>

                <div className="score-copy">
                  Your score reflects how complete and consistent
                  your catalog data is. More severe issues have a
                  larger impact, while multiple issues on the same
                  product are accounted for together.
                </div>
              </div>

              <div className="summary-grid">
                <div className="summary-item">
                  <div className="summary-number">
                    {result.productCount}
                  </div>

                  <div className="summary-label">
                    Products scanned
                  </div>
                </div>

                {result.findings.map((finding) => (
                  <div
                    className="summary-item"
                    key={finding.ruleId}
                  >
                    <div
                      className={`summary-number severity-${severityTone(
                        finding.severity,
                      )}`}
                    >
                      {finding.count}
                    </div>

                    <div className="summary-label">
                      {finding.title}
                    </div>
                  </div>
                ))}
              </div>

              <div className="products-header">
                <h3 className="products-title">
                  Products that need attention
                </h3>

                <span className="products-count">
                  {result.products.length} affected
                </span>
              </div>

              <div className="product-list">
                {result.products.length === 0 ? (
                  <div className="empty-products">
                    Your catalog looks healthy. No issues were
                    found in this scan.
                  </div>
                ) : (
                  result.products.map((product) => (
                    <div
                      className="product-row"
                      key={product.id}
                    >
                      <div className="product-main">
                        <div className="product-name">
                          {product.title}
                        </div>

                        <div className="product-id">
                          {product.id.split("/").pop()}
                        </div>
                      </div>

                      <div className="issue-list">
                        {product.issues.map((issue) => (
                          <span
                            className={`issue-badge ${issueTone(
                              issue,
                            )}`}
                            key={issue.ruleId}
                          >
                            {issue.title}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="scan-footer">
                <span className="scan-footer-copy">
                  No changes were made to your products.
                </span>

                <s-link href="/app/issues">
                  <s-button variant="primary">
                    View all issues
                  </s-button>
                </s-link>
              </div>
            </div>
          )}
        </div>
      </div>
    </s-page>
  );
}