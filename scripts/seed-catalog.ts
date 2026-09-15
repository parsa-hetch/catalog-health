import prisma from "../app/db.server";

const SHOP = "catalog-health-dev-tzeqhgzu.myshopify.com";

async function main() {
  const session = await prisma.session.findFirst({
    where: {
      shop: SHOP,
      isOnline: false,
    },
  });

  if (!session) {
    throw new Error(`No offline Shopify session found for ${SHOP}`);
  }

  console.log(`Using Shopify session for ${SHOP}`);
  console.log(`Access token found: ${Boolean(session.accessToken)}`);

  const response = await fetch(
    `https://${SHOP}/admin/api/2026-07/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": session.accessToken,
      },
      body: JSON.stringify({
        query: `
          query {
            shop {
              name
            }
          }
        `,
      }),
    },
  );

  const result = await response.json();

  if (!response.ok || result.errors) {
    console.error(result);
    throw new Error("Shopify Admin API request failed");
  }

  console.log(`Connected to Shopify store: ${result.data.shop.name}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });