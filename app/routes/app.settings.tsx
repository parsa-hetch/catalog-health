import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({
  request,
}: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const latestScan = await prisma.scan.findFirst({
    where: {
      shop: session.shop,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return {
    shop: session.shop,
    latestScan: latestScan
      ? {
          status: latestScan.status,
          productCount: latestScan.productCount,
          healthScore: latestScan.healthScore,
          createdAt: latestScan.createdAt.toISOString(),
        }
      : null,
  };
};

const formatDate = (value: string) => {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
};

export default function Settings() {
  const { shop, latestScan } =
    useLoaderData<typeof loader>();

  return (
    <s-page heading="Settings">
      <style>{`
        .settings-shell {
          max-width: 960px;
          margin: 0 auto;
          padding: 32px 40px 64px;
        }

        .settings-intro {
          margin-bottom: 32px;
        }

        .settings-eyebrow {
          margin-bottom: 10px;
          color: #899292;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .settings-title {
          margin: 0;
          color: #183030;
          font-size: 36px;
          line-height: 1.05;
          font-weight: 400;
          letter-spacing: -0.025em;
        }

        .settings-description {
          max-width: 620px;
          margin: 12px 0 0;
          color: #526060;
          font-size: 15px;
          line-height: 1.55;
        }

        .settings-grid {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .settings-card {
          padding: 24px;
          border: 1px solid #dde1dc;
          border-radius: 14px;
          background: #fbfcf9;
        }

        .card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          padding-bottom: 20px;
          border-bottom: 1px solid #e8ebe6;
        }

        .card-title {
          margin: 0;
          color: #183030;
          font-size: 17px;
          font-weight: 500;
        }

        .card-description {
          max-width: 540px;
          margin: 6px 0 0;
          color: #899292;
          font-size: 13px;
          line-height: 1.5;
        }

        .connection-badge {
          flex-shrink: 0;
          padding: 5px 9px;
          border: 1px solid #bfe7c7;
          border-radius: 999px;
          background: #ddf4e2;
          color: #3c7950;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 10px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .setting-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          padding: 18px 0;
        }

        .setting-row + .setting-row {
          border-top: 1px solid #e8ebe6;
        }

        .setting-label {
          color: #526060;
          font-size: 12px;
        }

        .setting-value {
          color: #183030;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 12px;
          text-align: right;
        }

        .scan-status {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: #3c7950;
          font-size: 12px;
        }

        .scan-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #7edb91;
        }

        .scan-empty {
          color: #899292;
          font-size: 12px;
        }

        .coming-soon {
          display: inline-flex;
          align-items: center;
          padding: 5px 9px;
          border: 1px solid #dde1dc;
          border-radius: 999px;
          background: #f5f6f1;
          color: #899292;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 10px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .settings-note {
          margin-top: 20px;
          color: #899292;
          font-size: 11px;
          line-height: 1.5;
        }

        @media (max-width: 640px) {
          .settings-shell {
            padding: 24px 16px 48px;
          }

          .settings-title {
            font-size: 30px;
          }

          .card-header {
            flex-direction: column;
            gap: 12px;
          }

          .setting-row {
            align-items: flex-start;
            flex-direction: column;
            gap: 8px;
          }

          .setting-value {
            text-align: left;
          }
        }
      `}</style>

      <div className="settings-shell">
        <div className="settings-intro">
          <div className="settings-eyebrow">
            Configuration
          </div>

          <h1 className="settings-title">
            Settings
          </h1>

          <p className="settings-description">
            Manage your store connection and see how your
            catalog health checks are configured.
          </p>
        </div>

        <div className="settings-grid">
          <section className="settings-card">
            <div className="card-header">
              <div>
                <h2 className="card-title">
                  Store
                </h2>

                <p className="card-description">
                  The Shopify store currently connected to
                  Catalog Health.
                </p>
              </div>

              <span className="connection-badge">
                Connected
              </span>
            </div>

            <div className="setting-row">
              <span className="setting-label">
                Store
              </span>

              <span className="setting-value">
                {shop}
              </span>
            </div>

            <div className="setting-row">
              <span className="setting-label">
                Connection
              </span>

              <span className="scan-status">
                <span className="scan-dot" />
                Shopify Admin API
              </span>
            </div>
          </section>

          <section className="settings-card">
            <div className="card-header">
              <div>
                <h2 className="card-title">
                  Catalog scanning
                </h2>

                <p className="card-description">
                  Catalog Health checks your product data
                  against the rules used by the current
                  scanner.
                </p>
              </div>

              <s-link href="/app/scan">
                <s-button variant="secondary">
                  Run scan
                </s-button>
              </s-link>
            </div>

            <div className="setting-row">
              <span className="setting-label">
                Latest scan
              </span>

              {latestScan ? (
                <span className="setting-value">
                  {formatDate(latestScan.createdAt)}
                </span>
              ) : (
                <span className="scan-empty">
                  No scans yet
                </span>
              )}
            </div>

            <div className="setting-row">
              <span className="setting-label">
                Products checked
              </span>

              <span className="setting-value">
                {latestScan
                  ? latestScan.productCount
                  : "—"}
              </span>
            </div>

            <div className="setting-row">
              <span className="setting-label">
                Latest health score
              </span>

              <span className="setting-value">
                {latestScan?.healthScore !== null &&
                latestScan?.healthScore !== undefined
                  ? `${latestScan.healthScore} / 100`
                  : "—"}
              </span>
            </div>
          </section>

          <section className="settings-card">
            <div className="card-header">
              <div>
                <h2 className="card-title">
                  Billing
                </h2>

                <p className="card-description">
                  Plans and billing management will be
                  connected here before the paid launch.
                </p>
              </div>

              <span className="coming-soon">
                Coming soon
              </span>
            </div>

            <div className="setting-row">
              <span className="setting-label">
                Current plan
              </span>

              <span className="setting-value">
                Development
              </span>
            </div>
          </section>
        </div>

        <p className="settings-note">
          Catalog Health currently uses the connected Shopify
          store as the source of truth for catalog data.
        </p>
      </div>
    </s-page>
  );
}