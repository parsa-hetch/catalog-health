import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";

const severityRank: Record<string, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
};

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
    include: {
      issues: true,
    },
  });

  const issues = (latestScan?.issues ?? []).sort((a, b) => {
    const severityDifference =
      (severityRank[a.severity] ?? 3) -
      (severityRank[b.severity] ?? 3);

    if (severityDifference !== 0) {
      return severityDifference;
    }

    return b.affectedCount - a.affectedCount;
  });

  return {
    issues,
    scan: latestScan
      ? {
          productCount: latestScan.productCount,
          healthScore: latestScan.healthScore,
          createdAt: latestScan.createdAt,
        }
      : null,
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

export default function Issues() {
  const { issues, scan } = useLoaderData<typeof loader>();

  const totalAffected = issues.reduce(
    (total, issue) => total + issue.affectedCount,
    0,
  );

  const highPriorityCount = issues.filter(
    (issue) =>
      issue.severity === "CRITICAL" ||
      issue.severity === "HIGH",
  ).length;

  return (
    <s-page heading="Issues">
      <style>{`
        .issues-shell {
          max-width: 1180px;
          margin: 0 auto;
          padding: 32px 40px 64px;
        }

        .issues-intro {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 32px;
          margin-bottom: 28px;
        }

        .issues-eyebrow {
          margin-bottom: 10px;
          color: #899292;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .issues-intro h2 {
          margin: 0 0 8px;
          color: #183030;
          font-size: 32px;
          line-height: 1.05;
          font-weight: 400;
          letter-spacing: -0.025em;
        }

        .issues-intro p {
          max-width: 620px;
          margin: 0;
          color: #526060;
          font-size: 14px;
          line-height: 1.55;
        }

        .scan-summary {
          display: flex;
          align-items: center;
          gap: 18px;
          flex-shrink: 0;
        }

        .summary-stat {
          min-width: 76px;
        }

        .summary-number {
          color: #183030;
          font-size: 24px;
          line-height: 1;
          font-weight: 400;
        }

        .summary-label {
          margin-top: 5px;
          color: #899292;
          font-size: 11px;
        }

        .summary-divider {
          width: 1px;
          height: 32px;
          background: #dde1dc;
        }

        .empty-state {
          padding: 64px 24px;
          text-align: center;
          border: 1px solid #dde1dc;
          border-radius: 14px;
          background: #fbfcf9;
        }

        .empty-icon {
          width: 48px;
          height: 48px;
          margin: 0 auto 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #a8d8f0;
          border-radius: 50%;
          background: #e6f4fc;
          color: #1890f0;
          font-size: 20px;
        }

        .empty-state h3 {
          margin: 0 0 8px;
          color: #183030;
          font-size: 20px;
          font-weight: 400;
        }

        .empty-state p {
          max-width: 420px;
          margin: 0 auto 20px;
          color: #899292;
          font-size: 14px;
          line-height: 1.55;
        }

        .issue-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .issue-link {
          display: block;
          color: inherit;
          text-decoration: none;
        }

        .issue-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto auto;
          align-items: center;
          gap: 24px;
          padding: 20px 22px;
          border: 1px solid #dde1dc;
          border-radius: 12px;
          background: #fbfcf9;
          transition:
            border-color 150ms ease,
            transform 150ms ease,
            box-shadow 150ms ease;
        }

        .issue-row:hover {
          border-color: #cbd1cc;
          transform: translateY(-1px);
          box-shadow:
            0 4px 12px rgba(24, 48, 48, 0.04);
        }

        .issue-main {
          min-width: 0;
        }

        .issue-title-row {
          display: flex;
          align-items: center;
          gap: 9px;
          min-width: 0;
        }

        .priority-dot {
          width: 7px;
          height: 7px;
          flex: 0 0 auto;
          border-radius: 50%;
        }

        .priority-dot.critical {
          background: #f29a8b;
        }

        .priority-dot.high {
          background: #f3c96b;
        }

        .priority-dot.medium {
          background: #a8d8f0;
        }

        .issue-title {
          margin: 0;
          overflow: hidden;
          color: #183030;
          font-size: 16px;
          font-weight: 500;
          line-height: 1.3;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .issue-description {
          max-width: 680px;
          margin: 6px 0 0;
          color: #899292;
          font-size: 13px;
          line-height: 1.5;
        }

        .issue-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #899292;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 11px;
          white-space: nowrap;
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

        .affected {
          min-width: 100px;
          text-align: right;
        }

        .affected strong {
          display: block;
          color: #183030;
          font-size: 20px;
          font-weight: 400;
          line-height: 1;
        }

        .affected span {
          display: block;
          margin-top: 5px;
          color: #899292;
          font-size: 11px;
        }

        .issue-arrow {
          margin-left: 4px;
          color: #a3aaa6;
          font-size: 16px;
        }

        .issues-note {
          margin-top: 18px;
          color: #899292;
          font-size: 11px;
        }

        @media (max-width: 900px) {
          .issues-intro {
            align-items: flex-start;
            flex-direction: column;
          }

          .scan-summary {
            width: 100%;
          }
        }

        @media (max-width: 760px) {
          .issues-shell {
            padding: 24px 16px 48px;
          }

          .issues-intro h2 {
            font-size: 28px;
          }

          .issue-row {
            grid-template-columns: 1fr;
            gap: 14px;
          }

          .issue-meta {
            white-space: normal;
          }

          .affected {
            display: flex;
            align-items: baseline;
            gap: 7px;
            text-align: left;
          }

          .affected span {
            margin-top: 0;
          }

          .issue-arrow {
            display: none;
          }
        }
      `}</style>

      <div className="issues-shell">
        <div className="issues-intro">
          <div>
            <div className="issues-eyebrow">
              Catalog health
            </div>

            <h2>Issues worth fixing</h2>

            <p>
              Problems found in your latest catalog scan,
              prioritized by severity and the number of products
              affected.
            </p>
          </div>

          {scan && issues.length > 0 && (
            <div className="scan-summary">
              <div className="summary-stat">
                <div className="summary-number">
                  {issues.length}
                </div>

                <div className="summary-label">
                  Issues
                </div>
              </div>

              <div className="summary-divider" />

              <div className="summary-stat">
                <div className="summary-number">
                  {highPriorityCount}
                </div>

                <div className="summary-label">
                  High priority
                </div>
              </div>

              <div className="summary-divider" />

              <div className="summary-stat">
                <div className="summary-number">
                  {totalAffected}
                </div>

                <div className="summary-label">
                  Affected
                </div>
              </div>
            </div>
          )}
        </div>

        {issues.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">✓</div>

            <h3>No issues found yet</h3>

            <p>
              Run a catalog scan to find missing, incomplete, or
              inconsistent product data.
            </p>

            <s-link href="/app/scan">
              <s-button variant="primary">
                Run a scan
              </s-button>
            </s-link>
          </div>
        ) : (
          <>
            <div className="issue-list">
              {issues.map((issue) => {
                const severity = severityClass(
                  issue.severity,
                );

                return (
                  <s-link
  href={`/app/issues/${issue.id}`}
  key={issue.id}
>
                    <div className="issue-row">
                      <div className="issue-main">
                        <div className="issue-title-row">
                          <span
                            className={`priority-dot ${severity}`}
                          />

                          <h3 className="issue-title">
                            {issue.title}
                          </h3>
                        </div>

                        <p className="issue-description">
                          {issue.description}
                        </p>
                      </div>

                      <div className="issue-meta">
                        <span>{issue.category}</span>

                        <span
                          className={`severity ${severity}`}
                        >
                          {severityLabel(issue.severity)}
                        </span>
                      </div>

                      <div className="affected">
                        <div>
                          <strong>
                            {issue.affectedCount}
                          </strong>

                          <span>affected products</span>
                        </div>

                        <span className="issue-arrow">
                          →
                        </span>
                      </div>
                    </div>
                  </s-link>
                );
              })}
            </div>

            <div className="issues-note">
              Priority is based on issue severity first, then
              the number of affected products.
            </div>
          </>
        )}
      </div>
    </s-page>
  );
}