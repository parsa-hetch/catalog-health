import { useEffect, useState } from "react";
import {
  useFetcher,
  useLoaderData,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";

import { authenticate } from "../shopify.server";
import { prisma } from "../db.server";

const DEV_STORE = "catalog-health-dev-tzeqhgzu.myshopify.com";

const SEED_TOTAL = 300;
const SEED_BATCH_SIZE = 10;

const SEED_PREFIX = "Catalog Test Product";
const SEED_TAG = "catalog-health-seed";

const TEST_IMAGE_URL =
  "https://cdn.shopify.com/shopifycloud/brochure/assets/sell/image/image-@artdirection-large-1ba8d5de56c361cec6bc487b747c8774b9ec8203f392a99f53c028df8d0fb3fc.png";

type PriorityIssue = {
  id: string;
  title: string;
  category: string;
  severity: string;
  affectedCount: number;
};

type SeedResult = {
  success?: boolean;
  created?: number;
  failed?: number;
  nextStart?: number;
  complete?: boolean;
  deleted?: number;
  error?: string;
  mode?: string;
};

type GraphQLUserError = {
  field?: string[];
  message: string;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const response = await admin.graphql(`#graphql
    query CatalogOverview {
      productsCount {
        count
      }
    }
  `);

  const data = await response.json();

  const latestScan = await prisma.scan.findFirst({
    where: {
      shop: session.shop,
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      issues: {
        select: {
          id: true,
          title: true,
          category: true,
          severity: true,
          affectedCount: true,
        },
      },
    },
  });

  const criticalCount =
    latestScan?.issues.filter(
      (issue) => issue.severity === "CRITICAL",
    ).length ?? 0;

  const highCount =
    latestScan?.issues.filter(
      (issue) => issue.severity === "HIGH",
    ).length ?? 0;

  const mediumCount =
    latestScan?.issues.filter(
      (issue) => issue.severity === "MEDIUM",
    ).length ?? 0;

  const priorityIssues: PriorityIssue[] =
    latestScan?.issues
      .slice()
      .sort((a, b) => {
        const severityWeight: Record<string, number> = {
          CRITICAL: 4,
          HIGH: 3,
          MEDIUM: 2,
          LOW: 1,
        };

        const severityDifference =
          (severityWeight[b.severity] ?? 0) -
          (severityWeight[a.severity] ?? 0);

        if (severityDifference !== 0) {
          return severityDifference;
        }

        return b.affectedCount - a.affectedCount;
      })
      .slice(0, 3) ?? [];

  return {
    productCount: data.data?.productsCount?.count ?? 0,
    healthScore: latestScan?.healthScore ?? null,
    scanDate: latestScan?.createdAt?.toISOString() ?? null,
    issueCounts: {
      critical: criticalCount,
      high: highCount,
      medium: mediumCount,
    },
    priorityIssues,
    totalIssues: latestScan?.issues.length ?? 0,
    hasScan: Boolean(latestScan),
    isDevStore: session.shop === DEV_STORE,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  if (session.shop !== DEV_STORE) {
    return Response.json(
      {
        error: "Seed is only allowed on the development store.",
      },
      { status: 403 },
    );
  }

  const formData = await request.formData();
  const mode = String(formData.get("mode") ?? "seed");

  if (mode === "reset") {
    let deleted = 0;

    const deleteProductsByQuery = async (query: string) => {
      while (true) {
        const response = await admin.graphql(
          `#graphql
          query SeedProducts($query: String!) {
            products(
              first: 50
              query: $query
            ) {
              nodes {
                id
                title
              }
            }
          }
        `,
          {
            variables: {
              query,
            },
          },
        );

        const data = await response.json();
        const products = data.data?.products?.nodes ?? [];

        if (products.length === 0) {
          break;
        }

        for (const product of products) {
          const deleteResponse = await admin.graphql(
            `#graphql
              mutation DeleteProduct($input: ProductDeleteInput!) {
                productDelete(input: $input) {
                  deletedProductId
                  userErrors {
                    field
                    message
                  }
                }
              }
            `,
            {
              variables: {
                input: {
                  id: product.id,
                },
              },
            },
          );

          const deleteData = await deleteResponse.json();
          const errors: GraphQLUserError[] =
            deleteData.data?.productDelete?.userErrors ?? [];

          if (
            errors.length === 0 &&
            deleteData.data?.productDelete?.deletedProductId
          ) {
            deleted++;
          }
        }
      }
    };

    await deleteProductsByQuery(`tag:${SEED_TAG}`);
    await deleteProductsByQuery(`title:${SEED_PREFIX}`);

    for (let i = 271; i <= 280; i++) {
      await deleteProductsByQuery(`title:"Item ${i}"`);
    }

    await prisma.scan.deleteMany({
      where: {
        shop: session.shop,
      },
    });

    return Response.json({
      success: true,
      deleted,
      complete: true,
      mode: "reset",
    });
  }

  const start = Math.max(
    0,
    Number(formData.get("start") ?? 0),
  );

  if (!Number.isFinite(start) || start >= SEED_TOTAL) {
    return Response.json({
      success: true,
      created: 0,
      failed: 0,
      nextStart: SEED_TOTAL,
      complete: true,
      mode: "seed",
    });
  }

  if (start === 0) {
    const existingSeedResponse = await admin.graphql(`#graphql
      query ExistingSeedProducts {
        products(
          first: 1
          query: "tag:${SEED_TAG}"
        ) {
          nodes {
            id
          }
        }
      }
    `);

    const existingSeedData = await existingSeedResponse.json();
    const existingSeedProducts = existingSeedData.data?.products?.nodes ?? [];

    if (existingSeedProducts.length > 0) {
      return Response.json(
        {
          success: false,
          mode: "seed",
          error:
            "A test catalog already exists. Reset the test catalog before seeding again.",
        },
        { status: 409 },
      );
    }
  }

  const end = Math.min(start + SEED_BATCH_SIZE, SEED_TOTAL);
  let created = 0;
  let failed = 0;

  const locationsResponse = await admin.graphql(`#graphql
    query SeedLocations {
      locations(first: 10) {
        nodes {
          id
        }
      }
    }
  `);

  const locationsData = await locationsResponse.json();
  const inventoryLocation = locationsData.data?.locations?.nodes?.[0];

  if (!inventoryLocation?.id) {
    return Response.json(
      {
        success: false,
        mode: "seed",
        error: "No Shopify inventory location was found.",
      },
      { status: 500 },
    );
  }

  for (let i = start + 1; i <= end; i++) {
    const missingDescription = i >= 151 && i <= 190;
    const missingSku = i >= 191 && i <= 215;
    const missingPrice = i >= 216 && i <= 235;
    const outOfStock = i >= 236 && i <= 255;
    const missingImage = i >= 256 && i <= 270;
    const shortTitle = i >= 271 && i <= 280;
    const draft = i >= 281 && i <= 290;
    const archived = i >= 291 && i <= 295;
    const mixedDefect = i >= 296;

    const title = shortTitle ? `Item ${i}` : `${SEED_PREFIX} ${i}`;
    const descriptionHtml =
      missingDescription || mixedDefect
        ? ""
        : "<p>A realistic test product created for Catalog Health.</p>";

    const status = archived ? "ARCHIVED" : draft ? "DRAFT" : "ACTIVE";

    const shouldHavePrice = !missingPrice && !(mixedDefect && i % 3 === 0);
    const shouldHaveSku = !missingSku && !(mixedDefect && i % 3 === 1);
    const shouldHaveInventory = !outOfStock && !(mixedDefect && i % 3 === 2);
    const shouldHaveImage = !missingImage && !(mixedDefect && i % 2 === 0);

    const price = shouldHavePrice ? 49 + ((i * 17) % 180) : undefined;
    const sku = shouldHaveSku ? `CAT-${String(i).padStart(4, "0")}` : undefined;
    const inventoryQuantity = shouldHaveInventory ? 10 + (i % 40) : 0;

    const variant: Record<string, unknown> = {
      optionValues: [
        {
          optionName: "Title",
          name: "Default Title",
        },
      ],
      inventoryItem: {
        tracked: true,
      },
      inventoryQuantities: [
        {
          locationId: inventoryLocation.id,
          name: "available",
          quantity: inventoryQuantity,
        },
      ],
    };

    if (price !== undefined) {
      variant.price = price;
    }

    if (sku !== undefined) {
      variant.sku = sku;
    }

    const productSet: Record<string, unknown> = {
      title,
      descriptionHtml,
      status,
      tags: [SEED_TAG],
      productOptions: [
        {
          name: "Title",
          position: 1,
          values: [
            {
              name: "Default Title",
            },
          ],
        },
      ],
      variants: [variant],
    };

    if (shouldHaveImage) {
      productSet.files = [
        {
          originalSource: TEST_IMAGE_URL,
          alt: title,
          filename: `catalog-health-${i}.png`,
          contentType: "IMAGE",
        },
      ];
    }

    try {
      const createResponse = await admin.graphql(
        `#graphql
          mutation CreateSeedProduct(
            $productSet: ProductSetInput!
            $synchronous: Boolean!
          ) {
            productSet(
              synchronous: $synchronous
              input: $productSet
            ) {
              product {
                id
              }
              userErrors {
                field
                message
              }
            }
          }
        `,
        {
          variables: {
            productSet,
            synchronous: true,
          },
        },
      );

      const createData = await createResponse.json();
      const userErrors: GraphQLUserError[] =
        createData.data?.productSet?.userErrors ?? [];

      if (userErrors.length > 0 || !createData.data?.productSet?.product) {
        failed++;
        continue;
      }

      created++;
    } catch {
      failed++;
    }
  }

  return Response.json({
    success: true,
    created,
    failed,
    nextStart: end,
    complete: end >= SEED_TOTAL,
    mode: "seed",
  });
};

export default function Index() {
  const {
    productCount,
    healthScore,
    scanDate,
    issueCounts,
    priorityIssues,
    totalIssues,
    hasScan,
    isDevStore,
  } = useLoaderData<typeof loader>();

  const seedFetcher = useFetcher<SeedResult>();
  const resetFetcher = useFetcher<SeedResult>();

  const [seedStart, setSeedStart] = useState(0);
  const [seedTotalCreated, setSeedTotalCreated] = useState(0);

  const isSeeding = seedFetcher.state !== "idle";
  const isResetting = resetFetcher.state !== "idle";

  useEffect(() => {
    const result = seedFetcher.data;

    if (!result?.success || result.mode !== "seed" || result.complete) {
      return;
    }

    if (typeof result.nextStart !== "number") {
      return;
    }

    setSeedStart(result.nextStart);
    setSeedTotalCreated(
      (current) => current + (result.created ?? 0),
    );

    seedFetcher.submit(
      {
        mode: "seed",
        start: String(result.nextStart),
      },
      {
        method: "post",
      },
    );
  }, [seedFetcher.data]);

  const formattedScanDate = scanDate
    ? new Date(scanDate).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const scoreLabel = healthScore === null ? "—" : healthScore;

  const priorityCopy =
    priorityIssues.length > 0
      ? "Start with the issues affecting the most products."
      : hasScan
        ? "No catalog issues were found in your latest scan."
        : "Run a scan to see what needs attention first.";

  return (
    <s-page heading="Catalog Health">
      <div className="catalog-health">
        <section className="dashboard-header">
          <div className="header-copy">
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              Catalog overview
            </div>

            <h1>
              Find what’s wrong.
              <br />
              <span>Fix what matters.</span>
            </h1>

            <p>
              Scan your Shopify catalog for missing, incomplete, or inconsistent
              product data — then see exactly what needs attention first.
            </p>
          </div>

          <div className="header-action">
            <s-link href="/app/scan">
              <s-button variant="primary">Scan my catalog</s-button>
            </s-link>

            <span>No changes are made to your products.</span>

            {isDevStore && (
              <div className="dev-tools">
                <div className="dev-tool">
                  <resetFetcher.Form
                    method="post"
                    onSubmit={() => {
                      setSeedStart(0);
                      setSeedTotalCreated(0);
                    }}
                  >
                    <input type="hidden" name="mode" value="reset" />
                    <s-button
                      type="submit"
                      variant="secondary"
                      disabled={isResetting || isSeeding}
                    >
                      {isResetting ? "Resetting…" : "Reset test catalog"}
                    </s-button>
                  </resetFetcher.Form>

                  {resetFetcher.data?.success && (
                    <span className="seed-result">
                      Removed {resetFetcher.data.deleted ?? 0} test products.
                    </span>
                  )}

                  {resetFetcher.data?.error && (
                    <span className="seed-error">
                      {resetFetcher.data.error}
                    </span>
                  )}
                </div>

                <div className="dev-tool">
                  <seedFetcher.Form
                    method="post"
                    onSubmit={() => {
                      setSeedStart(0);
                      setSeedTotalCreated(0);
                    }}
                  >
                    <input type="hidden" name="mode" value="seed" />
                    <input type="hidden" name="start" value="0" />
                    <s-button
                      type="submit"
                      variant="secondary"
                      disabled={isSeeding || isResetting}
                    >
                      {isSeeding
                        ? `Creating test catalog… ${Math.min(
                            seedStart + SEED_BATCH_SIZE,
                            SEED_TOTAL,
                          )}/${SEED_TOTAL}`
                        : "Seed 300 test products"}
                    </s-button>
                  </seedFetcher.Form>

                  {seedFetcher.data?.success && seedFetcher.data.complete && (
                    <span className="seed-result">
                      Created{" "}
                      {seedTotalCreated + (seedFetcher.data.created ?? 0)} test
                      products.
                    </span>
                  )}

                  {seedFetcher.data?.error && (
                    <span className="seed-error">
                      {seedFetcher.data.error}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="health-overview">
          <div className="health-score">
            <span className="label">CATALOG HEALTH</span>
            <div className="score-row">
              <strong>{scoreLabel}</strong>
              <span>/ 100</span>
            </div>
            <p>
              {hasScan && formattedScanDate
                ? `Last scanned ${formattedScanDate}`
                : "No scan yet"}
            </p>

            <div className="catalog-count">
              <span className="label">PRODUCTS IN CATALOG</span>
              <strong>{productCount.toLocaleString()}</strong>
            </div>
          </div>

          <div className="health-summary">
            <div className="summary-item critical">
              <span>CRITICAL</span>
              <strong>{hasScan ? issueCounts.critical : "—"}</strong>
              <p>Issues requiring attention</p>
            </div>

            <div className="summary-item high">
              <span>HIGH</span>
              <strong>{hasScan ? issueCounts.high : "—"}</strong>
              <p>Important catalog issues</p>
            </div>

            <div className="summary-item medium">
              <span>MEDIUM</span>
              <strong>{hasScan ? issueCounts.medium : "—"}</strong>
              <p>Issues worth improving</p>
            </div>
          </div>
        </section>

        <section className="priority-section">
          <div className="section-heading">
            <div>
              <span className="label">FIX THESE FIRST</span>
              <h2>What needs attention first</h2>
            </div>
            <span className="muted">{priorityCopy}</span>
          </div>

          {priorityIssues.length > 0 ? (
            <div className="priority-list">
              {priorityIssues.map((issue, index) => (
                <s-link key={issue.id} href={`/app/issues/${issue.id}`}>
                  <div className="priority-row">
                    <div className="priority-index">
                      {String(index + 1).padStart(2, "0")}
                    </div>
                    <div className="priority-copy">
                      <div className="priority-title">{issue.title}</div>
                      <div className="priority-meta">
                        <span>{issue.category}</span>
                        <span
                          className={`severity ${issue.severity.toLowerCase()}`}
                        >
                          {issue.severity}
                        </span>
                      </div>
                    </div>
                    <div className="priority-count">
                      <strong>{issue.affectedCount.toLocaleString()}</strong>
                      <span>affected products</span>
                    </div>
                    <div className="priority-arrow">→</div>
                  </div>
                </s-link>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">{hasScan ? "✓" : "+"}</div>
              <div className="empty-copy">
                <h3>
                  {hasScan
                    ? "Your catalog looks healthy"
                    : "Run your first catalog scan"}
                </h3>
                <p>
                  {hasScan
                    ? "No issues were found in your latest scan."
                    : "We’ll check your products for missing, incomplete, and inconsistent data, then rank the issues by impact."}
                </p>
              </div>
              <s-link href={hasScan ? "/app/issues" : "/app/scan"}>
                <s-button variant="primary">
                  {hasScan ? "View issues" : "Start scan"}
                </s-button>
              </s-link>
            </div>
          )}

          {priorityIssues.length > 0 && (
            <div className="priority-footer">
              <span>
                {totalIssues} issue{totalIssues === 1 ? "" : "s"} found in your
                latest scan.
              </span>
              <s-link href="/app/issues">View all issues →</s-link>
            </div>
          )}
        </section>

        <section className="checks-section">
          <div className="section-heading">
            <div>
              <span className="label">WHAT WE CHECK</span>
              <h2>Built around catalog quality</h2>
            </div>
          </div>

          <div className="checks-grid">
            <div className="check-card">
              <span className="check-number">01</span>
              <h3>Product information</h3>
              <p>Titles, descriptions, and essential product details.</p>
            </div>

            <div className="check-card">
              <span className="check-number">02</span>
              <h3>Images</h3>
              <p>Missing or incomplete product imagery.</p>
            </div>

            <div className="check-card">
              <span className="check-number">03</span>
              <h3>Variants</h3>
              <p>Variant-level pricing, inventory, and product data.</p>
            </div>

            <div className="check-card">
              <span className="check-number">04</span>
              <h3>Identifiers</h3>
              <p>SKUs and other important catalog identifiers.</p>
            </div>
          </div>
        </section>
      </div>

      <style>{`
        .catalog-health {
          max-width: 1180px;
          margin: 32px auto 80px;
          color: #183030;
        }

        .dashboard-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 48px;
          padding: 48px 0 52px;
          border-bottom: 1px solid #dde1dc;
        }

        .header-copy {
          max-width: 700px;
        }

        .eyebrow {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 20px;
          color: #526060;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: .1em;
          text-transform: uppercase;
        }

        .eyebrow-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #7edb91;
        }

        h1 {
          margin: 0;
          font-size: clamp(44px, 5vw, 68px);
          line-height: .98;
          font-weight: 300;
          letter-spacing: -.045em;
        }

        h1 span {
          color: #526060;
        }

        .header-copy > p {
          max-width: 590px;
          margin: 26px 0 0;
          color: #526060;
          font-size: 16px;
          line-height: 1.55;
        }

        .header-action {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 10px;
          flex-shrink: 0;
        }

        .header-action > span {
          color: #899292;
          font-size: 10px;
        }

        .dev-tools {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 12px;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px dashed #dde1dc;
        }

        .dev-tool {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 7px;
        }

        .seed-result,
        .seed-error {
          font-size: 10px;
        }

        .seed-result {
          color: #526060;
        }

        .seed-error {
          color: #d87568;
        }

        .health-overview {
          display: grid;
          grid-template-columns: 1fr 1.5fr;
          margin-top: 24px;
          border: 1px solid #dde1dc;
          border-radius: 14px;
          background: #fbfcf9;
          overflow: hidden;
        }

        .health-score {
          padding: 32px;
          border-right: 1px solid #dde1dc;
        }

        .label {
          color: #899292;
          font-family: monospace;
          font-size: 10px;
          letter-spacing: .08em;
        }

        .score-row {
          display: flex;
          align-items: baseline;
          gap: 6px;
          margin-top: 18px;
        }

        .score-row strong {
          font-size: 72px;
          line-height: .9;
          font-weight: 300;
          letter-spacing: -.06em;
        }

        .score-row span {
          color: #899292;
          font-family: monospace;
          font-size: 12px;
        }

        .health-score > p {
          margin: 12px 0 0;
          color: #526060;
          font-size: 12px;
        }

        .catalog-count {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 20px;
          margin-top: 32px;
          padding-top: 18px;
          border-top: 1px solid #e8ebe6;
        }

        .catalog-count strong {
          color: #183030;
          font-size: 24px;
          font-weight: 400;
          letter-spacing: -.02em;
        }

        .health-summary {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
        }

        .summary-item {
          padding: 32px 24px;
          border-left: 1px solid #dde1dc;
        }

        .summary-item:first-child {
          border-left: 0;
        }

        .summary-item > span {
          color: #899292;
          font-family: monospace;
          font-size: 10px;
          letter-spacing: .06em;
        }

        .summary-item strong {
          display: block;
          margin-top: 22px;
          font-size: 32px;
          font-weight: 400;
        }

        .summary-item p {
          margin: 7px 0 0;
          color: #899292;
          font-size: 11px;
          line-height: 1.4;
        }

        .critical strong {
          color: #d87568;
        }

        .high strong {
          color: #c59a3c;
        }

        .medium strong {
          color: #657cbd;
        }

        .priority-section,
        .checks-section {
          margin-top: 56px;
        }

        .section-heading {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 18px;
        }

        .section-heading h2 {
          margin: 8px 0 0;
          font-size: 24px;
          line-height: 1.1;
          font-weight: 400;
          letter-spacing: -.02em;
        }

        .muted {
          color: #899292;
          font-size: 11px;
        }

        .priority-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .priority-list > s-link {
          display: block;
          text-decoration: none;
        }

        .priority-row {
          display: grid;
          grid-template-columns: 48px minmax(0, 1fr) auto 24px;
          align-items: center;
          gap: 20px;
          padding: 20px 22px;
          border: 1px solid #dde1dc;
          border-radius: 12px;
          background: #fbfcf9;
          transition:
            border-color .15s ease,
            transform .15s ease,
            box-shadow .15s ease;
        }

        .priority-row:hover {
          border-color: #cbd2cc;
          transform: translateY(-1px);
          box-shadow: 0 6px 18px rgba(24, 48, 48, .05);
        }

        .priority-index {
          color: #899292;
          font-family: monospace;
          font-size: 11px;
        }

        .priority-title {
          color: #183030;
          font-size: 15px;
          font-weight: 500;
        }

        .priority-meta {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 6px;
          color: #899292;
          font-family: monospace;
          font-size: 10px;
        }

        .severity {
          display: inline-flex;
          align-items: center;
          padding: 4px 8px;
          border-radius: 999px;
          font-family: monospace;
          font-size: 9px;
        }

        .severity.critical {
          color: #c9685b;
          background: #fbe0db;
        }

        .severity.high {
          color: #9a761f;
          background: #fff0c7;
        }

        .severity.medium {
          color: #526ba9;
          background: #e6f4fc;
        }

        .priority-count {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          text-align: right;
        }

        .priority-count strong {
          color: #183030;
          font-size: 22px;
          font-weight: 400;
          letter-spacing: -.02em;
        }

        .priority-count span {
          margin-top: 3px;
          color: #899292;
          font-size: 10px;
        }

        .priority-arrow {
          color: #899292;
          font-size: 18px;
        }

        .priority-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-top: 12px;
          padding: 0 4px;
          color: #899292;
          font-size: 10px;
        }

        .priority-footer s-link {
          color: #526060;
        }

        .empty-state {
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 24px;
          border: 1px dashed #cfd5d0;
          border-radius: 14px;
          background: #fbfcf9;
        }

        .empty-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          flex-shrink: 0;
          border-radius: 12px;
          background: #e6f4fc;
          color: #1890f0;
          font-size: 24px;
          font-weight: 300;
        }

        .empty-copy {
          flex: 1;
        }

        .empty-copy h3 {
          margin: 0;
          font-size: 15px;
          font-weight: 500;
        }

        .empty-copy p {
          max-width: 650px;
          margin: 6px 0 0;
          color: #526060;
          font-size: 12px;
          line-height: 1.5;
        }

        .checks-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }

        .check-card {
          min-height: 170px;
          padding: 22px;
          border: 1px solid #dde1dc;
          border-radius: 12px;
          background: #fbfcf9;
        }

        .check-number {
          color: #899292;
          font-family: monospace;
          font-size: 10px;
        }

        .check-card h3 {
          margin: 34px 0 8px;
          font-size: 15px;
          font-weight: 500;
        }

        .check-card p {
          margin: 0;
          color: #526060;
          font-size: 12px;
          line-height: 1.5;
        }

        @media (max-width: 900px) {
          .dashboard-header {
            flex-direction: column;
            align-items: flex-start;
          }

          .header-action,
          .dev-tools,
          .dev-tool {
            align-items: flex-start;
          }

          .health-overview {
            grid-template-columns: 1fr;
          }

          .health-score {
            border-right: 0;
            border-bottom: 1px solid #dde1dc;
          }

          .checks-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .priority-row {
            grid-template-columns: 40px minmax(0, 1fr) auto;
          }

          .priority-arrow {
            display: none;
          }
        }

        @media (max-width: 600px) {
          .catalog-health {
            margin: 20px 16px 60px;
          }

          .dashboard-header {
            padding: 32px 0 36px;
          }

          .health-summary {
            grid-template-columns: 1fr;
          }

          .summary-item {
            border-left: 0;
            border-top: 1px solid #dde1dc;
          }

          .summary-item:first-child {
            border-top: 0;
          }

          .empty-state {
            align-items: flex-start;
            flex-direction: column;
          }

          .checks-grid {
            grid-template-columns: 1fr;
          }

          .section-heading {
            align-items: flex-start;
            flex-direction: column;
          }

          .catalog-count {
            align-items: center;
          }

          .priority-row {
            grid-template-columns: 28px minmax(0, 1fr);
          }

          .priority-count {
            grid-column: 2;
            align-items: flex-start;
            text-align: left;
          }

          .priority-footer {
            align-items: flex-start;
            flex-direction: column;
          }
        }
      `}</style>
    </s-page>
  );
}