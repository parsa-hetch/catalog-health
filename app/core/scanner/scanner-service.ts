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
   * موتور اصلی اسکن: محصولات را Fetch می‌کند، به Rule Engine می‌دهد و نتایج را Aggregation و Persist می‌کند.
   */
  static async runScan(scanId: string, shopifyGraphQLClient: any) {
    try {
      // 1. UPDATE STATE: FETCHING
      await prisma.scan.update({
        where: { id: scanId },
        data: { status: "FETCHING", startedAt: new Date() },
      });

      // نمونه Query شاپفای (می‌توان بعداً Pagination اضافه کرد)
      const response = await shopifyGraphQLClient.query({
        data: `{
          products(first: 250) {
            edges {
              node {
                id
                title
                descriptionHtml
                images(first: 10) { edges { node { id } } }
                variants(first: 10) { edges { node { id sku } } }
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

      // اجرای Rule Engine به صورت Pure
      const ruleResults = RuleEngine.analyzeBatch(normalizedProducts);

      // 3. UPDATE STATE: CALCULATING (Health Score)
      await prisma.scan.update({
        where: { id: scanId },
        data: { status: "CALCULATING" },
      });

      // محاسبه ساده Health Score (MVP)
      const totalRules = RULES.length;
      const failedRulesCount = ruleResults.filter((r) => r.affectedProducts.length > 0).length;
      const healthScore = totalRules > 0 
        ? Math.max(0, Math.round(((totalRules - failedRulesCount) / totalRules) * 100))
        : 100;

      // 4. UPDATE STATE: PERSISTING (Save Issues & Instances)
      await prisma.scan.update({
        where: { id: scanId },
        data: { status: "PERSISTING" },
      });

      for (const result of ruleResults) {
        if (result.affectedProducts.length === 0) continue;

        const ruleDef = RULES.find((r) => r.id === result.ruleId);
        if (!ruleDef) continue;

        // ذخیره Issue و IssueInstance به‌صورت Cascaded
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
      // TERMINAL STATE: FAILED
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