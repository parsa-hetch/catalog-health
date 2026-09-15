import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({
  request,
  params,
}: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const issue = await prisma.issue.findFirst({
    where: {
      id: params.issueId,
      scan: {
        shop: session.shop,
      },
    },
    include: {
      instances: {
        orderBy: {
          productTitle: "asc",
        },
      },
    },
  });

  if (!issue) {
    throw new Response("Issue not found", {
      status: 404,
    });
  }

  return {
    issue,
    shop: session.shop,
  };
};

const severityClass = (severity: string) => {
  if (severity === "CRITICAL") {
    return "critical";
  }

  if (severity === "HIGH") {
    return "high";
  }

  return "medium";
};

const severityLabel = (severity: string) => {
  if (severity === "CRITICAL") {
    return "Critical";
  }

  if (severity === "HIGH") {
    return "High";
  }

  return "Medium";
};

const getAdminProductUrl = (
  shop: string,
  productId: string,
) => {
  const numericId = productId.split("/").pop();

  if (!numericId) {
    return `https://${shop}/admin/products`;
  }

  return `https://${shop}/admin/products/${numericId}`;
};

export default function IssueDetail() {
  const { issue, shop } = useLoaderData<typeof loader>();

  const firstProduct = issue.instances[0];

  return (
    <s-page heading={issue.title}>
      <style>{`
        .issue-detail {
          max-width: 1080px;
          margin: 0 auto;
          padding: 32px 40px 64px;
        }

        .back {
          margin-bottom: 28px;
        }

        .hero {
          padding-bottom: 32px;
          border-bottom: 1px solid #dde1dc;
        }

        .eyebrow {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 14px;
        }

        .category {
          color: #899292;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 11px;
          letter-spacing: 0.02em;
        }

        .severity {
          padding: 5px 8px;
          border-radius: 999px;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 10px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .severity.critical {
          background: #fbe0db;
          color: #9d4033;
        }

        .severity.high {
          background: #fff0c7;
          color: #8b6818;
        }

        .severity.medium {
          background: #e6f4fc;
          color: #39728e;
        }

        .hero h1 {
          margin: 0 0 12px;
          color: #183030;
          font-size: 40px;
          line-height: 1.05;
          font-weight: 300;
          letter-spacing: -0.03em;
        }

        .hero p {
          max-width: 720px;
          margin: 0;
          color: #526060;
          font-size: 16px;
          line-height: 1.6;
        }

        .content {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 320px;
          gap: 48px;
          padding-top: 36px;
        }

        .section {
          margin-bottom: 36px;
        }

        .section h2 {
          margin: 0 0 10px;
          color: #183030;
          font-size: 20px;
          line-height: 1.2;
          font-weight: 400;
        }

        .section p {
          margin: 0;
          color: #526060;
          font-size: 14px;
          line-height: 1.65;
        }

        .sidebar {
          align-self: start;
          padding: 22px;
          border: 1px solid #dde1dc;
          border-radius: 14px;
          background: #fbfcf9;
        }

        .stat {
          padding-bottom: 20px;
          margin-bottom: 20px;
          border-bottom: 1px solid #e8ebe6;
        }

        .stat:last-of-type {
          margin-bottom: 20px;
        }

        .stat-label {
          color: #899292;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 10px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .stat-value {
          margin-top: 6px;
          color: #183030;
          font-size: 28px;
          line-height: 1.15;
          font-weight: 300;
        }

        .stat-value.category-value {
          font-size: 17px;
          font-weight: 400;
        }

        .products {
          display: flex;
          flex-direction: column;
          border: 1px solid #dde1dc;
          border-radius: 12px;
          overflow: hidden;
          background: #fbfcf9;
        }

        .product {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 14px 16px;
          border-bottom: 1px solid #e8ebe6;
        }

        .product:last-child {
          border-bottom: 0;
        }

        .product-info {
          min-width: 0;
        }

        .product-name {
          overflow: hidden;
          color: #183030;
          font-size: 13px;
          line-height: 1.4;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .product-id {
          margin-top: 4px;
          overflow: hidden;
          color: #899292;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 10px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .product-action {
          flex-shrink: 0;
        }

        .product-link {
          color: inherit;
          text-decoration: none;
        }

        .products-empty {
          padding: 20px;
          border: 1px solid #dde1dc;
          border-radius: 12px;
          background: #fbfcf9;
        }

        .products-empty p {
          margin: 0;
          color: #899292;
          font-size: 13px;
        }

        .sidebar-action {
          width: 100%;
        }

        .sidebar-action s-button {
          width: 100%;
        }

        @media (max-width: 800px) {
          .issue-detail {
            padding: 24px 16px 48px;
          }

          .hero h1 {
            font-size: 32px;
          }

          .content {
            grid-template-columns: 1fr;
            gap: 24px;
          }

          .product {
            align-items: flex-start;
          }
        }

        @media (max-width: 520px) {
          .product {
            flex-direction: column;
          }

          .product-action {
            width: 100%;
          }

          .product-action s-button {
            width: 100%;
          }
        }
      `}</style>

      <div className="issue-detail">
        <div className="back">
          <s-link href="/app/issues">
            ← Back to issues
          </s-link>
        </div>

        <div className="hero">
          <div className="eyebrow">
            <span className="category">
              {issue.category}
            </span>

            <span
              className={`severity ${severityClass(
                issue.severity,
              )}`}
            >
              {severityLabel(issue.severity)}
            </span>
          </div>

          <h1>{issue.title}</h1>

          <p>{issue.description}</p>
        </div>

        <div className="content">
          <main>
            <section className="section">
              <h2>Why this matters</h2>

              <p>{issue.whyItMatters}</p>
            </section>

            <section className="section">
              <h2>What to do</h2>

              <p>{issue.howToFix}</p>
            </section>

            <section className="section">
              <h2>Affected products</h2>

              {issue.instances.length === 0 ? (
                <div className="products-empty">
                  <p>
                    No affected products were recorded for
                    this issue.
                  </p>
                </div>
              ) : (
                <div className="products">
                  {issue.instances.map((product) => {
                    const adminUrl = getAdminProductUrl(
                      shop,
                      product.productId,
                    );

                    return (
                      <div
                        className="product"
                        key={product.id}
                      >
                        <div className="product-info">
                          <div className="product-name">
                            {product.productTitle ||
                              "Untitled product"}
                          </div>

                          <div className="product-id">
                            {product.productId}
                          </div>
                        </div>

                        <div className="product-action">
                          <a
                            className="product-link"
                            href={adminUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <s-button variant="secondary">
                              Open
                            </s-button>
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </main>

          <aside className="sidebar">
            <div className="stat">
              <div className="stat-label">
                Affected products
              </div>

              <div className="stat-value">
                {issue.affectedCount}
              </div>
            </div>

            <div className="stat">
              <div className="stat-label">
                Issue category
              </div>

              <div className="stat-value category-value">
                {issue.category}
              </div>
            </div>

            {firstProduct && (
              <div className="sidebar-action">
                <a
                  href={getAdminProductUrl(
                    shop,
                    firstProduct.productId,
                  )}
                  target="_blank"
                  rel="noreferrer"
                >
                  <s-button variant="primary">
                    Open in Shopify
                  </s-button>
                </a>
              </div>
            )}
          </aside>
        </div>
      </div>
    </s-page>
  );
}