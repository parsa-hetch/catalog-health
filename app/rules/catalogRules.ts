export type CatalogProduct = {
  id: string;
  title: string;
  descriptionHtml: string;
  featuredImage: unknown;
  status: string;
  totalInventory: number | null;
  variants: {
    nodes: {
      id?: string;
      title?: string;
      sku: string | null;
      price: string | null;
      inventoryQuantity: number | null;
    }[];
  };
};

export type RuleSeverity = "CRITICAL" | "HIGH" | "MEDIUM";

export type CatalogRule = {
  id: string;
  category: string;
  severity: RuleSeverity;
  title: string;
  description: string;
  whyItMatters: string;
  howToFix: string;
  check: (product: CatalogProduct) => boolean;
};

export const catalogRules: CatalogRule[] = [
  {
    id: "missing-title",
    category: "Product Information",
    severity: "HIGH",
    title: "Missing product title",
    description: "This product does not have a title.",
    whyItMatters:
      "A clear product title helps customers and sales channels understand what the product is.",
    howToFix:
      "Add a clear, descriptive title that identifies the product.",
    check: (product) => !product.title?.trim(),
  },

  {
  id: "short-title",
  category: "Product Information",
  severity: "MEDIUM",
  title: "Product title is too short",
  description:
    "This product has a title that is too short to clearly describe the product.",
  whyItMatters:
    "Descriptive product titles help customers and sales channels understand what the product is.",
  howToFix:
    "Expand the title with the most useful identifying details, such as product type, model, material, or key variation.",
  check: (product) => {
    const title = product.title?.trim() ?? "";

    return title.length > 0 && title.length < 10;
  },
},

  {
    id: "missing-description",
    category: "Product Information",
    severity: "MEDIUM",
    title: "Missing product description",
    description: "This product does not have a description.",
    whyItMatters:
      "Product descriptions help customers understand the product and can provide useful context to search and sales channels.",
    howToFix:
      "Add a concise description covering the product's key features, use, and important details.",
    check: (product) => !product.descriptionHtml?.trim(),
  },

  {
    id: "missing-image",
    category: "Images",
    severity: "HIGH",
    title: "Missing product image",
    description: "This product does not have a featured image.",
    whyItMatters:
      "Products without imagery are harder for customers to understand and can look incomplete across storefront and sales channels.",
    howToFix:
      "Add at least one clear, relevant product image.",
    check: (product) => !product.featuredImage,
  },

  {
    id: "missing-sku",
    category: "Identifiers",
    severity: "MEDIUM",
    title: "Missing SKU",
    description:
      "At least one variant of this product does not have a SKU.",
    whyItMatters:
      "SKUs make products and variants easier to identify and manage across inventory and operational workflows.",
    howToFix:
      "Add a unique SKU to every variant that needs inventory identification.",
    check: (product) =>
      product.variants.nodes.some(
        (variant) => !variant.sku?.trim(),
      ),
  },

  {
  id: "draft-product",
  category: "Product Information",
  severity: "MEDIUM",
  title: "Product is in draft",
  description:
    "This product is currently saved as a draft and is not available for sale.",
  whyItMatters:
    "Draft products can remain incomplete and may be overlooked before launch.",
  howToFix:
    "Complete the product information and publish it when the product is ready.",
  check: (product) => product.status === "DRAFT",
},

{
  id: "archived-product",
  category: "Product Information",
  severity: "MEDIUM",
  title: "Product is archived",
  description:
    "This product is currently archived.",
  whyItMatters:
    "Archived products can remain in your catalog without being actively maintained.",
  howToFix:
    "Review the product and either restore it if it should be active or keep it archived intentionally.",
  check: (product) => product.status === "ARCHIVED",
},

{
  id: "out-of-stock",
  category: "Pricing & Availability",
  severity: "HIGH",
  title: "Product is out of stock",
  description:
    "This product currently has no inventory available.",
  whyItMatters:
    "Out-of-stock products can reduce the usefulness of your catalog and may affect how products are presented across sales channels.",
  howToFix:
    "Restock the product or review its inventory settings if it is intentionally unavailable.",
  check: (product) =>
    product.totalInventory !== null &&
    product.totalInventory <= 0,
},

 {
  id: "missing-price",
  category: "Pricing & Availability",
  severity: "HIGH",
  title: "Missing variant price",
  description:
    "At least one variant of this product does not have a price.",
  whyItMatters:
    "A variant without a price can prevent the product from being properly purchased or displayed.",
  howToFix:
    "Add a valid price to every variant that is intended to be sold.",
  check: (product) =>
    product.variants.nodes.some(
      (variant) => !variant.price || Number(variant.price) <= 0,
    ),
},
];