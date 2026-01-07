/**
 * Shopify Analytics Service
 *
 * Fetches real product data from Shopify including:
 * - Inventory levels
 * - Sales data
 * - Product views (via analytics)
 */

// GraphQL admin client type
type AdminGraphQL = {
  graphql: (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response>;
};

export interface ProductAnalytics {
  productId: string;
  variantId: string;
  title: string;
  currentPrice: number;
  compareAtPrice: number | null;
  costPrice: number | null;
  inventoryQuantity: number;
  inventoryPolicy: string;
  sku: string | null;
  viewsLast7Days: number;
  viewsLast30Days: number;
  salesLast7Days: number;
  salesLast30Days: number;
  totalSold: number;
  createdAt: string;
}

interface ShopifyProductEdge {
  node: {
    id: string;
    title: string;
    createdAt: string;
    totalInventory: number;
    variants: {
      edges: Array<{
        node: {
          id: string;
          price: string;
          compareAtPrice: string | null;
          inventoryQuantity: number | null;
          inventoryPolicy: string;
          sku: string | null;
          inventoryItem: {
            unitCost: {
              amount: string;
            } | null;
          };
        };
      }>;
    };
  };
}

interface ShopifyOrderLineItem {
  quantity: number;
  variant: {
    id: string;
    product: {
      id: string;
    };
  } | null;
}

/**
 * Fetch product inventory and pricing data from Shopify
 */
export async function fetchProductAnalytics(
  admin: AdminGraphQL,
  productIds?: string[]
): Promise<ProductAnalytics[]> {
  const analytics: ProductAnalytics[] = [];

  // Build query filter
  const queryFilter = productIds?.length
    ? productIds.map((id) => `id:${id.replace("gid://shopify/Product/", "")}`).join(" OR ")
    : "";

  // Fetch products with inventory data
  const productsQuery = `
    query GetProductsWithInventory($first: Int!, $query: String) {
      products(first: $first, query: $query) {
        edges {
          node {
            id
            title
            createdAt
            totalInventory
            variants(first: 10) {
              edges {
                node {
                  id
                  price
                  compareAtPrice
                  inventoryQuantity
                  inventoryPolicy
                  sku
                  inventoryItem {
                    unitCost {
                      amount
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const productsResponse = await admin.graphql(productsQuery, {
    variables: {
      first: productIds?.length || 50,
      query: queryFilter || null,
    },
  });

  const productsData = await productsResponse.json();
  const products = productsData.data?.products?.edges || [];

  // Get sales data from orders (last 30 days)
  const salesData = await fetchSalesData(admin, 30);

  for (const edge of products as ShopifyProductEdge[]) {
    const product = edge.node;

    for (const variantEdge of product.variants.edges) {
      const variant = variantEdge.node;
      const productSales = salesData.get(product.id) || { last7Days: 0, last30Days: 0, total: 0 };

      // Calculate views estimate based on sales (typically 2-5% conversion)
      // In production, you'd use Shopify Analytics API or a third-party tool
      const estimatedConversionRate = 0.03; // 3% assumed conversion
      const estimatedViews7d = Math.round(productSales.last7Days / estimatedConversionRate);
      const estimatedViews30d = Math.round(productSales.last30Days / estimatedConversionRate);

      analytics.push({
        productId: product.id,
        variantId: variant.id,
        title: product.title,
        currentPrice: parseFloat(variant.price),
        compareAtPrice: variant.compareAtPrice ? parseFloat(variant.compareAtPrice) : null,
        costPrice: variant.inventoryItem?.unitCost?.amount
          ? parseFloat(variant.inventoryItem.unitCost.amount)
          : null,
        inventoryQuantity: variant.inventoryQuantity || 0,
        inventoryPolicy: variant.inventoryPolicy,
        sku: variant.sku,
        viewsLast7Days: estimatedViews7d,
        viewsLast30Days: estimatedViews30d,
        salesLast7Days: productSales.last7Days,
        salesLast30Days: productSales.last30Days,
        totalSold: productSales.total,
        createdAt: product.createdAt,
      });
    }
  }

  return analytics;
}

/**
 * Fetch sales data from orders
 */
async function fetchSalesData(
  admin: AdminGraphQL,
  days: number
): Promise<Map<string, { last7Days: number; last30Days: number; total: number }>> {
  const salesMap = new Map<string, { last7Days: number; last30Days: number; total: number }>();

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const ordersQuery = `
    query GetRecentOrders($first: Int!, $query: String!) {
      orders(first: $first, query: $query) {
        edges {
          node {
            id
            createdAt
            lineItems(first: 50) {
              edges {
                node {
                  quantity
                  variant {
                    id
                    product {
                      id
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const ordersResponse = await admin.graphql(ordersQuery, {
    variables: {
      first: 250,
      query: `created_at:>=${thirtyDaysAgo.toISOString().split("T")[0]} financial_status:paid`,
    },
  });

  const ordersData = await ordersResponse.json();
  const orders = ordersData.data?.orders?.edges || [];

  for (const orderEdge of orders) {
    const order = orderEdge.node;
    const orderDate = new Date(order.createdAt);
    const isLast7Days = orderDate >= sevenDaysAgo;

    for (const lineItemEdge of order.lineItems.edges) {
      const lineItem = lineItemEdge.node as ShopifyOrderLineItem;
      if (!lineItem.variant?.product?.id) continue;

      const productId = lineItem.variant.product.id;
      const existing = salesMap.get(productId) || { last7Days: 0, last30Days: 0, total: 0 };

      existing.last30Days += lineItem.quantity;
      existing.total += lineItem.quantity;
      if (isLast7Days) {
        existing.last7Days += lineItem.quantity;
      }

      salesMap.set(productId, existing);
    }
  }

  return salesMap;
}

/**
 * Fetch detailed inventory levels by location
 */
export async function fetchInventoryLevels(
  admin: AdminGraphQL,
  variantIds: string[]
): Promise<Map<string, { available: number; onHand: number; committed: number }>> {
  const inventoryMap = new Map<string, { available: number; onHand: number; committed: number }>();

  if (variantIds.length === 0) return inventoryMap;

  const inventoryQuery = `
    query GetInventoryLevels($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on ProductVariant {
          id
          inventoryQuantity
          inventoryItem {
            id
            inventoryLevels(first: 10) {
              edges {
                node {
                  available
                  quantities(names: ["available", "on_hand", "committed"]) {
                    name
                    quantity
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const response = await admin.graphql(inventoryQuery, {
    variables: { ids: variantIds },
  });

  const data = await response.json();

  for (const node of data.data?.nodes || []) {
    if (!node?.inventoryItem?.inventoryLevels?.edges) continue;

    let totalAvailable = 0;
    let totalOnHand = 0;
    let totalCommitted = 0;

    for (const levelEdge of node.inventoryItem.inventoryLevels.edges) {
      const quantities = levelEdge.node.quantities || [];
      for (const q of quantities) {
        if (q.name === "available") totalAvailable += q.quantity;
        if (q.name === "on_hand") totalOnHand += q.quantity;
        if (q.name === "committed") totalCommitted += q.quantity;
      }
    }

    inventoryMap.set(node.id, {
      available: totalAvailable,
      onHand: totalOnHand,
      committed: totalCommitted,
    });
  }

  return inventoryMap;
}

/**
 * Get inventory level as a percentage (0-100)
 * Based on typical inventory thresholds
 */
export function calculateInventoryLevel(
  quantity: number,
  avgDailySales: number = 1
): number {
  if (quantity <= 0) return 0;

  // Days of inventory coverage
  const daysOfCoverage = avgDailySales > 0 ? quantity / avgDailySales : quantity;

  // Convert to percentage where:
  // 0-7 days = 0-20% (critical)
  // 7-14 days = 20-40% (low)
  // 14-30 days = 40-60% (healthy)
  // 30-60 days = 60-80% (good)
  // 60+ days = 80-100% (overstocked)
  if (daysOfCoverage <= 7) return Math.round((daysOfCoverage / 7) * 20);
  if (daysOfCoverage <= 14) return Math.round(20 + ((daysOfCoverage - 7) / 7) * 20);
  if (daysOfCoverage <= 30) return Math.round(40 + ((daysOfCoverage - 14) / 16) * 20);
  if (daysOfCoverage <= 60) return Math.round(60 + ((daysOfCoverage - 30) / 30) * 20);
  return Math.min(100, Math.round(80 + ((daysOfCoverage - 60) / 60) * 20));
}
