import { useFetcher } from "react-router";
import type { ActionFunctionArgs } from "react-router";

import { authenticate } from "../shopify.server";

type SeedProduct = {
  title: string;
  descriptionHtml: string;
  status: "ACTIVE" | "DRAFT" | "ARCHIVED";
  sku: string | null;
  price: string | null;
  hasImage: boolean;
};

const TOTAL_PRODUCTS = 300;

function generateProducts(): SeedProduct[] {
  return Array.from({ length: TOTAL_PRODUCTS }, (_, index) => {
    const number = index + 1;

    const missingTitle = number <= 6;
    const missingDescription = number <= 60;
    const missingImage = number <= 17;
    const missingSku = number <= 42;
    const missingPrice = number <= 4;

    let status: SeedProduct["status"] = "ACTIVE";

    if (number >= 298 && number <= 300) {
      status = "DRAFT";
    }

    if (number >= 295 && number <= 297) {
      status = "ARCHIVED";
    }

    return {
      title: missingTitle
        ? ""
        : number % 12 === 0
          ? "Hat"
          : `Catalog Health Product ${number}`,

      descriptionHtml: missingDescription
        ? ""
        : `<p>A synthetic product created for testing Shopify Catalog Health.</p>`,

      status,

      sku: missingSku ? null : `TEST-SKU-${String(number).padStart(4, "0")}`,

      price: missingPrice ? null : `${(29.95 + number * 3.5).toFixed(2)}`,

      hasImage: !missingImage,
    };
  });
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  if (session.shop !== "catalog-health-dev-tzeqhgzu.myshopify.com") {
    return Response.json(
      {
        success: false,
        error: "Seed is only allowed on the development store.",
      },
      { status: 403 },
    );
  }

  const products = generateProducts();

  let created = 0;
  let failed = 0;

  for (const product of products) {
    const response = await admin.graphql(
      `#graphql
        mutation CreateProduct($input: ProductInput!) {
          productCreate(input: $input) {
            product {
              id
              title
            }
            userErrors {
              field
              message
            }
          }
        }
      `,
      {
        variables: {
          input: {
            title:
              product.title ||
              `Untitled Test Product ${created + failed + 1}`,
            descriptionHtml: product.descriptionHtml,
            status: product.status,
          },
        },
      },
    );

    const data = await response.json();

    const errors = data.data?.productCreate?.userErrors ?? [];

    if (errors.length > 0 || !data.data?.productCreate?.product) {
      failed++;
      continue;
    }

    created++;
  }

  return Response.json({
    success: true,
    created,
    failed,
    total: products.length,
  });
};

export default function DevSeed() {
  const fetcher = useFetcher<typeof action>();

  const running = fetcher.state !== "idle";
  const result = fetcher.data;

  return (
    <main
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "64px 32px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1>Catalog Health — Dev Seed</h1>

      <p>
        Creates 300 synthetic products with intentional catalog issues for
        scanner testing.
      </p>

      <fetcher.Form method="post">
        <button
          type="submit"
          disabled={running}
          style={{
            marginTop: 24,
            padding: "12px 18px",
            borderRadius: 8,
            border: "1px solid #ccc",
            cursor: running ? "wait" : "pointer",
          }}
        >
          {running ? "Creating products…" : "Create 300 test products"}
        </button>
      </fetcher.Form>

      {result && (
        <pre
          style={{
            marginTop: 32,
            padding: 20,
            background: "#f5f5f5",
            borderRadius: 8,
          }}
        >
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </main>
  );
}