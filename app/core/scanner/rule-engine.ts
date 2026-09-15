import { NormalizedProduct, RuleDefinition, RuleResult } from "./types";

export const RULES: RuleDefinition[] = [
  {
    id: "missing_title",
    category: "PRODUCT_INFORMATION",
    severity: "HIGH",
    title: "Missing Product Title",
    description: "Products without a proper title.",
    whyItMatters: "Titles are essential for searchability and store navigation.",
    howToFix: "Add a clear title to affected products.",
    evaluate: (products) => ({
      ruleId: "missing_title",
      affectedProducts: products
        .filter((p) => !p.title || p.title.trim() === "")
        .map((p) => ({ productId: p.id, productTitle: p.title || "Untitled Product" })),
    }),
  },
  {
    id: "missing_description",
    category: "PRODUCT_INFORMATION",
    severity: "MEDIUM",
    title: "Missing Description",
    description: "Products with empty descriptions.",
    whyItMatters: "Descriptions provide key context to customers and boost SEO.",
    howToFix: "Add a detailed description for these items.",
    evaluate: (products) => ({
      ruleId: "missing_description",
      affectedProducts: products
        .filter((p) => !p.descriptionHtml || p.descriptionHtml.trim() === "")
        .map((p) => ({ productId: p.id, productTitle: p.title })),
    }),
  },
  {
    id: "missing_images",
    category: "MEDIA",
    severity: "HIGH",
    title: "Missing Product Images",
    description: "Products without any media uploaded.",
    whyItMatters: "Visuals are the most critical factor for customer conversions.",
    howToFix: "Upload high-quality images to your product gallery.",
    evaluate: (products) => ({
      ruleId: "missing_images",
      affectedProducts: products
        .filter((p) => p.imagesCount === 0)
        .map((p) => ({ productId: p.id, productTitle: p.title })),
    }),
  },
];

export class RuleEngine {
  static analyzeBatch(products: NormalizedProduct[]): RuleResult[] {
    return RULES.map((rule) => rule.evaluate(products));
  }
}