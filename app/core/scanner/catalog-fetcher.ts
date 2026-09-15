import { NormalizedProduct } from "./types";

export class CatalogFetcher {
  // این متد محصولات را به‌صورت Batch از GraphQL شاپفای می‌خواند
  static normalizeShopifyProducts(shopifyProductsNode: any[]): NormalizedProduct[] {
    return shopifyProductsNode.map((node) => {
      const imagesCount = node.images?.edges?.length || 0;
      const variants = node.variants?.edges || [];
      const hasMissingSku = variants.some((v: any) => !v.node.sku || v.node.sku.trim() === "");

      return {
        id: node.id,
        title: node.title,
        descriptionHtml: node.descriptionHtml,
        imagesCount,
        variantsCount: variants.length,
        skusCount: variants.filter((v: any) => v.node.sku).length,
        hasMissingSku,
      };
    });
  }
}