import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({
  request,
}: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const scans = await prisma.scan.findMany({
    where: {
      shop: session.shop,
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      issues: {
        select: {
          severity: true,
          affectedCount: true,
        },
      },
    },
  });

  const history = scans.map((scan, index) => {
    const issueCount = scan.issues.length;

    const criticalCount = scan.issues.filter(
      (issue) => issue.severity === "CRITICAL",
    ).length;

    const highCount = scan.issues.filter(
      (issue) => issue.severity === "HIGH",
    ).length;

    const mediumCount = scan.issues.filter(
      (issue) => issue.severity === "MEDIUM",
    ).length;

    const totalAffected = scan.issues.reduce(
      (sum, issue) => sum + issue.affectedCount,
      0,
    );

    const previousScan = scans[index + 1];

    const previousIssueCount = previousScan
      ? previousScan.issues.length
      : null;

    const issueChange =
      previousIssueCount !== null
        ? issueCount - previousIssueCount
        : null;

    const previousScore = previousScan?.healthScore ?? null;

    const scoreChange =
      scan.healthScore !== null &&
      previousScore !== null
        ? scan.healthScore - previousScore
        : null;

    return {
      id: scan.id,
      status: scan.status,
      productCount: scan.productCount,
      healthScore: scan.healthScore,
      issueCount,
      criticalCount,
      highCount,
      mediumCount,
      totalAffected,
      issueChange,
      scoreChange,
      createdAt: scan.createdAt.toISOString(),
      completedAt:
        scan.completedAt?.toISOString() ?? null,
    };
  });

  return { history };
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

const statusClass = (status: string) => {
  if (status === "COMPLETED") {
    return "completed";
  }

  if (status === "FAILED") {
    return "failed";
  }

  return "running";
};

const statusLabel = (status: string) => {
  if (status === "COMPLETED") {
    return "Completed";
  }

  if (status === "FAILED") {
    return "Failed";
  }

  return "Running";
};

export default function ScanHistory() {
  const { history } = useLoaderData<typeof loader>();

  const latestScan = history[0] ?? null;

  return (
    <s-page heading="Scan History">
      <style>{`
        .history-shell {
          max-width: 1120px;
          margin: 0 auto;
          padding: 32px 40px 64px;
        }

        .history-intro {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 32px;
          margin-bottom: 32px;
        }

        .history-eyebrow {
          margin-bottom: 10px;
          color: #899292;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .history-title {
          margin: 0;
          color: #183030;
          font-size: 36px;
          line-height: 1.05;
          font-weight: 400;
          letter-spacing: -0.025em;
        }

        .history-description {
          max-width: 600px;
          margin: 12px 0 0;
          color: #526060;
          font-size: 15px;
          line-height: 1.55;
        }

        .latest-score {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
          padding: 12px 16px;
          border: 1px solid #dde1dc;
          border-radius: 12px;
          background: #fbfcf9;
        }

        .latest-score-label {
          color: #899292;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 10px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .latest-score-value {
          color: #183030;
          font-size: 24px;
          line-height: 1;
          font-weight: 400;
        }

        .history-card {
          overflow: hidden;
          border: 1px solid #dde1dc;
          border-radius: 14px;
          background: #fbfcf9;
        }

        .history-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 20px 24px;
          border-bottom: 1px solid #e8ebe6;
        }

        .history-card-title {
          margin: 0;
          color: #183030;
          font-size: 16px;
          font-weight: 500;
        }

        .history-count {
          color: #899292;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 11px;
        }

        .scan-table {
          width: 100%;
        }

        .scan-row {
          display: grid;
          grid-template-columns:
            minmax(180px, 1.4fr)
            100px
            100px
            110px
            120px
            110px;
          align-items: center;
          gap: 18px;
          padding: 20px 24px;
          border-bottom: 1px solid #e8ebe6;
        }

        .scan-row:last-child {
          border-bottom: 0;
        }

        .scan-row:not(.scan-header):hover {
          background: #f5f6f1;
        }

        .scan-header {
          background: #f5f6f1;
          color: #899292;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 10px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .scan-date {
          color: #183030;
          font-size: 13px;
          font-weight: 500;
        }

        .scan-id {
          margin-top: 5px;
          overflow: hidden;
          color: #a0a8a4;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 10px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .scan-metric {
          color: #183030;
          font-size: 14px;
        }

        .scan-metric-muted {
          margin-top: 4px;
          color: #899292;
          font-size: 11px;
        }

        .score {
          color: #183030;
          font-size: 18px;
          font-weight: 400;
        }

        .score.empty {
          color: #a0a8a4;
        }

        .score-change {
          margin-top: 5px;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 10px;
        }

        .score-change.better {
          color: #3c9b58;
        }

        .score-change.worse {
          color: #c96a5d;
        }

        .score-change.same {
          color: #899292;
        }

        .issue-change {
          margin-top: 5px;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 10px;
        }

        .issue-change.better {
          color: #3c9b58;
        }

        .issue-change.worse {
          color: #c96a5d;
        }

        .issue-change.same {
          color: #899292;
        }

        .status {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          width: fit-content;
          padding: 5px 8px;
          border: 1px solid #dde1dc;
          border-radius: 999px;
          background: #f5f6f1;
          color: #526060;
          font-size: 10px;
          line-height: 1;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #899292;
        }

        .status.completed {
          border-color: #bfe7c7;
          background: #ddf4e2;
          color: #3c7950;
        }

        .status.completed .status-dot {
          background: #7edb91;
        }

        .status.failed {
          border-color: #f29a8b;
          background: #fbe0db;
          color: #87483e;
        }

        .status.failed .status-dot {
          background: #f29a8b;
        }

        .status.running {
          border-color: #a8d8f0;
          background: #e6f4fc;
          color: #246584;
        }

        .status.running .status-dot {
          background: #1890f0;
        }

        .empty-state {
          padding: 72px 32px;
          text-align: center;
        }

        .empty-orb {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 56px;
          height: 56px;
          margin: 0 auto 20px;
          border: 1px solid #a8d8f0;
          border-radius: 50%;
          background: #e6f4fc;
          color: #1890f0;
          font-size: 22px;
        }

        .empty-title {
          margin: 0;
          color: #183030;
          font-size: 21px;
          font-weight: 500;
        }

        .empty-copy {
          max-width: 460px;
          margin: 10px auto 24px;
          color: #526060;
          font-size: 14px;
          line-height: 1.55;
        }

        @media (max-width: 1080px) {
          .scan-row {
            grid-template-columns:
              minmax(160px, 1.4fr)
              80px
              90px
              100px
              100px
              100px;
            gap: 12px;
          }
        }

        @media (max-width: 900px) {
          .history-intro {
            align-items: flex-start;
            flex-direction: column;
          }

          .latest-score {
            width: fit-content;
          }

          .scan-header {
            display: none;
          }

          .scan-row {
            grid-template-columns: 1fr 1fr 1fr;
            gap: 18px;
            padding: 20px;
          }

          .scan-row > :first-child {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 600px) {
          .history-shell {
            padding: 24px 16px 48px;
          }

          .history-title {
            font-size: 30px;
          }

          .scan-row {
            grid-template-columns: 1fr 1fr;
          }

          .scan-row > :first-child {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 420px) {
          .scan-row {
            grid-template-columns: 1fr;
          }

          .scan-row > :first-child {
            grid-column: auto;
          }
        }
      `}</style>

      <div className="history-shell">
        <div className="history-intro">
          <div>
            <div className="history-eyebrow">
              Catalog health
            </div>

            <h1 className="history-title">
              See how your catalog changes over time.
            </h1>

            <p className="history-description">
              Every scan gives you a snapshot of your catalog
              health. Compare runs to see whether your issues
              are actually going down.
            </p>
          </div>

          {latestScan?.healthScore !== null &&
            latestScan?.healthScore !== undefined && (
              <div className="latest-score">
                <span className="latest-score-label">
                  Latest score
                </span>

                <span className="latest-score-value">
                  {latestScan.healthScore}
                </span>
              </div>
            )}
        </div>

        <div className="history-card">
          <div className="history-card-header">
            <h2 className="history-card-title">
              Scan history
            </h2>

            <span className="history-count">
              {history.length}{" "}
              {history.length === 1 ? "scan" : "scans"}
            </span>
          </div>

          {history.length === 0 ? (
            <div className="empty-state">
              <div className="empty-orb">⌁</div>

              <h2 className="empty-title">
                No scans yet
              </h2>

              <p className="empty-copy">
                Run your first catalog scan to create your
                first health snapshot.
              </p>

              <s-link href="/app/scan">
                <s-button variant="primary">
                  Scan my catalog
                </s-button>
              </s-link>
            </div>
          ) : (
            <div className="scan-table">
              <div className="scan-row scan-header">
                <div>Date</div>
                <div>Products</div>
                <div>Score</div>
                <div>Issues</div>
                <div>Affected</div>
                <div>Status</div>
              </div>

              {history.map((scan) => (
                <div className="scan-row" key={scan.id}>
                  <div>
                    <div className="scan-date">
                      {formatDate(scan.createdAt)}
                    </div>

                    <div className="scan-id">
                      {scan.id}
                    </div>
                  </div>

                  <div>
                    <div className="scan-metric">
                      {scan.productCount}
                    </div>

                    <div className="scan-metric-muted">
                      products
                    </div>
                  </div>

                  <div>
                    <div
                      className={`score ${
                        scan.healthScore === null
                          ? "empty"
                          : ""
                      }`}
                    >
                      {scan.healthScore !== null
                        ? scan.healthScore
                        : "—"}
                    </div>

                    {scan.scoreChange !== null && (
                      <div
                        className={`score-change ${
                          scan.scoreChange > 0
                            ? "better"
                            : scan.scoreChange < 0
                              ? "worse"
                              : "same"
                        }`}
                      >
                        {scan.scoreChange > 0
                          ? `+${scan.scoreChange}`
                          : scan.scoreChange < 0
                            ? scan.scoreChange
                            : "No change"}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="scan-metric">
                      {scan.issueCount}
                    </div>

                    {scan.issueChange !== null && (
                      <div
                        className={`issue-change ${
                          scan.issueChange < 0
                            ? "better"
                            : scan.issueChange > 0
                              ? "worse"
                              : "same"
                        }`}
                      >
                        {scan.issueChange < 0
                          ? `${Math.abs(
                              scan.issueChange,
                            )} fewer`
                          : scan.issueChange > 0
                            ? `${scan.issueChange} more`
                            : "No change"}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="scan-metric">
                      {scan.totalAffected}
                    </div>

                    <div className="scan-metric-muted">
                      findings
                    </div>
                  </div>

                  <div>
                    <span
                      className={`status ${statusClass(
                        scan.status,
                      )}`}
                    >
                      <span className="status-dot" />

                      {statusLabel(scan.status)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </s-page>
  );
}