export interface NormalizedProduct {
  id: string;
  title: string;
  descriptionHtml?: string;
  imagesCount: number;
  variantsCount: number;
  skusCount: number;
  hasMissingSku: boolean;
}

export interface RuleResult {
  ruleId: string;
  affectedProducts: Array<{
    productId: string;
    productTitle: string;
    metadata?: Record<string, unknown>;
  }>;
}

export interface RuleDefinition {
  id: string;
  category: "PRODUCT_INFORMATION" | "MEDIA" | "SEO" | "INVENTORY" | "VARIANTS";
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  title: string;
  description: string;
  whyItMatters: string;
  howToFix: string;
  evaluate: (products: NormalizedProduct[]) => RuleResult;
}