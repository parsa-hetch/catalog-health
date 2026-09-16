import { prisma } from "~/db.server";
import { CatalogFetcher } from "./catalog-fetcher";
import { RuleEngine, RULES } from "./rule-engine";

export class ScannerService {
  /**
   * یک اسکن جدید ایجاد می‌کند و حالت آن را QUEUED می‌گذارد.
   */
  static async createScan(shop: string) {
    return await prisma.scan.create({
      data: {
        shop,
        status: "QUEUED",
      },
    });
  }

  /**
   * محاسبه واقع‌بینانه Health Score بر اساس درصد محصولات درگیر و شدت خطاها
   */
  private static calculateRealHealthScore(
    totalProducts: number,
    ruleResults: Array<{ ruleId: string; affectedProducts: any[] }>
  ): number {
    if (totalProducts === 0) return 100;

    // وزن جریمه به ازای هر دسته شدت (Severity)
    const SEVERITY_WEIGHTS: Record<string, number> = {
      CRITICAL: 20,
      HIGH: 12,
      MEDIUM: 6,
      LOW: 3,
      INFO: 1,
    };

    let totalDeductions = 0;

    for (const result of ruleResults) {
      const affectedCount = result.affectedProducts.length;
      if (affectedCount === 0) continue;

      const ruleDef = RULES.find((r) => r.id === result.ruleId);
      const severity = ruleDef?.severity || "MEDIUM";
      const weight = SEVERITY_WEIGHTS[severity] || 5;

      // نسبت محصولات درگیر ضرب در وزن خطا
      const percentageAffected = affectedCount / totalProducts;
      totalDeductions += percentageAffected * weight;
    }

    // نرمال‌سازی نمره نهایی بین ۰ تا ۱۰۰
    const finalScore = Math.max(0, Math.min(100, Math.round(100 - totalDeductions)));
    return finalScore;
  }

  /**
   * موتور اصلی اسکن
   */
  static async runScan(scanId: string, shopifyGraphQLClient: any) {
    try {
      // 1. UPDATE STATE: FETCHING
      await prisma.scan.update({
        where: { id: scanId },
        data: { status: "FETCHING", startedAt: new Date() },
      });

      const response = await shopifyGraphQLClient.query({
        data: `{
          products(first: 250) {
            edges {
              node {
                id
                title
                descriptionHtml
                images(first: 10) { edges { node { id } } }
                variants(first: 10) { edges { node { id sku price } } }
              }
            }
          }
        }`,
      });

      const rawProducts = response.body.data.products.edges.map((e: any) => e.node);
      const normalizedProducts = CatalogFetcher.normalizeShopifyProducts(rawProducts);

      // 2. UPDATE STATE: ANALYZING
      await prisma.scan.update({
        where: { id: scanId },
        data: { 
          status: "ANALYZING",
          productCount: normalizedProducts.length,
        },
      });

      const ruleResults = RuleEngine.analyzeBatch(normalizedProducts);

      // 3. UPDATE STATE: CALCULATING (Realistic Health Score)
      await prisma.scan.update({
        where: { id: scanId },
        data: { status: "CALCULATING" },
      });

      const healthScore = this.calculateRealHealthScore(
        normalizedProducts.length,
        ruleResults
      );

      // 4. UPDATE STATE: PERSISTING (Save Issues & Instances)
      await prisma.scan.update({
        where: { id: scanId },
        data: { status: "PERSISTING" },
      });

      for (const result of ruleResults) {
        if (result.affectedProducts.length === 0) continue;

        const ruleDef = RULES.find((r) => r.id === result.ruleId);
        if (!ruleDef) continue;

        await prisma.issue.create({
          data: {
            scanId,
            ruleId: ruleDef.id,
            category: ruleDef.category,
            severity: ruleDef.severity,
            title: ruleDef.title,
            description: ruleDef.description,
            whyItMatters: ruleDef.whyItMatters,
            howToFix: ruleDef.howToFix,
            affectedCount: result.affectedProducts.length,
            instances: {
              create: result.affectedProducts.map((p) => ({
                productId: p.productId,
                productTitle: p.productTitle,
                metadata: p.metadata ? JSON.stringify(p.metadata) : undefined,
              })),
            },
          },
        });
      }

      // 5. UPDATE STATE: COMPLETED
      return await prisma.scan.update({
        where: { id: scanId },
        data: {
          status: "COMPLETED",
          healthScore,
          completedAt: new Date(),
        },
      });
    } catch (error: any) {
      return await prisma.scan.update({
        where: { id: scanId },
        data: {
          status: "FAILED",
          errorMessage: error?.message || "Unknown error occurred during scan",
        },
      });
    }
  }
}