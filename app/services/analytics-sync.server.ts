/**
 * Analytics Sync Service
 *
 * Syncs product analytics data from Shopify and stores in database
 * for AI pricing analysis.
 */

import prisma from "~/db.server";
import type { AnalyticsSource } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

// GraphQL admin client type
type AdminGraphQL = {
  graphql: (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response>;
};

export interface DailyAnalytics {
  productId: string;
  variantId?: string;
  date: Date;
  pageViews: number;
  uniqueVisitors: number;
  addToCartCount: number;
  unitsSold: number;
  revenue: number;
  averagePrice?: number;
  inventoryLevel: number;
  dataSource: AnalyticsSource;
}

interface ShopifyOrderEdge {
  node: {
    id: string;
    createdAt: string;
    totalPriceSet: {
      shopMoney: {
        amount: string;
      };
    };
    lineItems: {
      edges: Array<{
        node: {
          quantity: number;
          originalTotalSet: {
            shopMoney: {
              amount: string;
            };
          };
          variant: {
            id: string;
            price: string;
            product: {
              id: string;
            };
          } | null;
        };
      }>;
    };
  };
}

/**
 * Sync daily analytics for all products
 * Should be called daily via cron job
 */
export async function syncDailyAnalytics(
  shopId: string,
  admin: AdminGraphQL,
  date?: Date
): Promise<{ synced: number; errors: string[] }> {
  const targetDate = date || new Date();
  targetDate.setHours(0, 0, 0, 0);

  const errors: string[] = [];
  let synced = 0;

  try {
    // Fetch sales data for the day
    const salesByProduct = await fetchDailySales(admin, targetDate);

    // Fetch inventory levels
    const inventoryByVariant = await fetchInventoryLevels(admin);

    // Fetch page views with fallback chain (Shopify API -> Estimation)
    const { views: viewsByProduct, source: dataSource } = await getPageViewsWithFallback(
      admin,
      targetDate,
      salesByProduct
    );

    // Combine all data and save
    const productIds = new Set([
      ...salesByProduct.keys(),
      ...inventoryByVariant.keys(),
      ...viewsByProduct.keys(),
    ]);

    for (const productId of productIds) {
      try {
        const sales = salesByProduct.get(productId) || {
          unitsSold: 0,
          revenue: 0,
          avgPrice: 0,
          addToCart: 0,
        };
        const inventory = inventoryByVariant.get(productId) || 0;
        const views = viewsByProduct.get(productId) || { pageViews: 0, unique: 0 };

        await upsertDailyAnalytics(shopId, {
          productId,
          date: targetDate,
          pageViews: views.pageViews,
          uniqueVisitors: views.unique,
          addToCartCount: sales.addToCart,
          unitsSold: sales.unitsSold,
          revenue: sales.revenue,
          averagePrice: sales.avgPrice || undefined,
          inventoryLevel: inventory,
          dataSource,
        });

        synced++;
      } catch (error) {
        errors.push(`Failed to sync ${productId}: ${error}`);
      }
    }
  } catch (error) {
    errors.push(`Sync failed: ${error}`);
  }

  return { synced, errors };
}

/**
 * Fetch sales data for a specific day
 */
async function fetchDailySales(
  admin: AdminGraphQL,
  date: Date
): Promise<Map<string, { unitsSold: number; revenue: number; avgPrice: number; addToCart: number }>> {
  const salesMap = new Map<string, { unitsSold: number; revenue: number; avgPrice: number; addToCart: number }>();

  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const ordersQuery = `
    query GetDailyOrders($first: Int!, $query: String!) {
      orders(first: $first, query: $query) {
        edges {
          node {
            id
            createdAt
            totalPriceSet {
              shopMoney {
                amount
              }
            }
            lineItems(first: 100) {
              edges {
                node {
                  quantity
                  originalTotalSet {
                    shopMoney {
                      amount
                    }
                  }
                  variant {
                    id
                    price
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

  const response = await admin.graphql(ordersQuery, {
    variables: {
      first: 250,
      query: `created_at:>=${startOfDay.toISOString()} created_at:<=${endOfDay.toISOString()} financial_status:paid`,
    },
  });

  const data = await response.json();
  const orders = (data.data?.orders?.edges || []) as ShopifyOrderEdge[];

  for (const orderEdge of orders) {
    for (const lineItemEdge of orderEdge.node.lineItems.edges) {
      const lineItem = lineItemEdge.node;
      if (!lineItem.variant?.product?.id) continue;

      const productId = lineItem.variant.product.id;
      const existing = salesMap.get(productId) || {
        unitsSold: 0,
        revenue: 0,
        avgPrice: 0,
        addToCart: 0,
      };

      existing.unitsSold += lineItem.quantity;
      existing.revenue += parseFloat(lineItem.originalTotalSet.shopMoney.amount);

      salesMap.set(productId, existing);
    }
  }

  // Calculate average prices
  for (const [productId, data] of salesMap) {
    if (data.unitsSold > 0) {
      data.avgPrice = data.revenue / data.unitsSold;
    }
  }

  return salesMap;
}

/**
 * Fetch current inventory levels for all products
 */
async function fetchInventoryLevels(
  admin: AdminGraphQL
): Promise<Map<string, number>> {
  const inventoryMap = new Map<string, number>();

  const productsQuery = `
    query GetProductInventory($first: Int!) {
      products(first: $first) {
        edges {
          node {
            id
            totalInventory
          }
        }
      }
    }
  `;

  const response = await admin.graphql(productsQuery, {
    variables: { first: 250 },
  });

  const data = await response.json();
  const products = data.data?.products?.edges || [];

  for (const edge of products) {
    inventoryMap.set(edge.node.id, edge.node.totalInventory || 0);
  }

  return inventoryMap;
}

/**
 * Fetch real page views from Shopify Analytics API (ShopifyQL)
 * Uses the shopifyqlQuery endpoint available in Shopify Admin API
 */
async function fetchShopifyAnalyticsPageViews(
  admin: AdminGraphQL,
  date: Date
): Promise<Map<string, { pageViews: number; unique: number }> | null> {
  const viewsMap = new Map<string, { pageViews: number; unique: number }>();

  const dateStr = date.toISOString().split("T")[0];

  // ShopifyQL query for product page views
  // Note: Requires Shopify Plus or Analytics API access
  const shopifyqlQuery = `
    query getProductPageViews($query: String!) {
      shopifyqlQuery(query: $query) {
        __typename
        ... on TableResponse {
          tableData {
            rowData
            columns {
              name
              dataType
            }
          }
        }
        ... on PolarisVizResponse {
          data {
            key
            value
          }
        }
        parseErrors {
          message
        }
      }
    }
  `;

  try {
    const response = await admin.graphql(shopifyqlQuery, {
      variables: {
        query: `
          FROM products
          SHOW product_id, sum(page_views) AS total_views, sum(unique_visitors) AS unique_views
          SINCE ${dateStr}
          UNTIL ${dateStr}
          GROUP BY product_id
        `,
      },
    });

    const data = await response.json();

    // Check for errors
    if (data.errors || data.data?.shopifyqlQuery?.parseErrors?.length > 0) {
      console.warn("ShopifyQL query failed, falling back to estimation");
      return null;
    }

    // Parse table response
    const tableData = data.data?.shopifyqlQuery?.tableData;
    if (tableData?.rowData) {
      for (const row of tableData.rowData) {
        // Row format depends on columns, typically [product_id, total_views, unique_views]
        const productId = row[0];
        const pageViews = parseInt(row[1]) || 0;
        const uniqueViews = parseInt(row[2]) || 0;

        if (productId) {
          viewsMap.set(productId, { pageViews, unique: uniqueViews });
        }
      }
    }

    return viewsMap.size > 0 ? viewsMap : null;
  } catch (error) {
    console.warn("Shopify Analytics API not available:", error);
    return null;
  }
}

/**
 * Fetch session data from Shopify Analytics API
 * Alternative method using web analytics reports
 */
async function fetchShopifySessionAnalytics(
  admin: AdminGraphQL,
  date: Date
): Promise<Map<string, { pageViews: number; unique: number; addToCart: number }> | null> {
  const viewsMap = new Map<string, { pageViews: number; unique: number; addToCart: number }>();

  const startDate = new Date(date);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(date);
  endDate.setHours(23, 59, 59, 999);

  // Alternative: Use web pixel events if available
  const eventsQuery = `
    query getAnalyticsEvents($startDate: DateTime!, $endDate: DateTime!) {
      analyticsEvents(first: 250, query: "created_at:>=$startDate created_at:<=$endDate event_type:page_view OR event_type:add_to_cart") {
        edges {
          node {
            eventType
            targetId
            createdAt
          }
        }
      }
    }
  `;

  try {
    const response = await admin.graphql(eventsQuery, {
      variables: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    });

    const data = await response.json();

    if (data.errors) {
      return null;
    }

    // Process events
    const events = data.data?.analyticsEvents?.edges || [];
    for (const edge of events) {
      const event = edge.node;
      const productId = event.targetId;

      if (!productId) continue;

      const existing = viewsMap.get(productId) || { pageViews: 0, unique: 0, addToCart: 0 };

      if (event.eventType === "page_view") {
        existing.pageViews++;
      } else if (event.eventType === "add_to_cart") {
        existing.addToCart++;
      }

      viewsMap.set(productId, existing);
    }

    // Estimate unique visitors as 70% of page views
    for (const [productId, data] of viewsMap) {
      data.unique = Math.round(data.pageViews * 0.7);
    }

    return viewsMap.size > 0 ? viewsMap : null;
  } catch {
    return null;
  }
}

/**
 * Get page views with fallback chain:
 * 1. Shopify Analytics API (ShopifyQL)
 * 2. Shopify Session Analytics
 * 3. Estimation from sales data
 */
async function getPageViewsWithFallback(
  admin: AdminGraphQL,
  date: Date,
  salesByProduct: Map<string, { unitsSold: number; revenue: number; avgPrice: number; addToCart: number }>
): Promise<{ views: Map<string, { pageViews: number; unique: number }>; source: AnalyticsSource }> {

  // Try Shopify Analytics API first
  const shopifyViews = await fetchShopifyAnalyticsPageViews(admin, date);
  if (shopifyViews && shopifyViews.size > 0) {
    return { views: shopifyViews, source: "SHOPIFY_API" };
  }

  // Try session analytics
  const sessionViews = await fetchShopifySessionAnalytics(admin, date);
  if (sessionViews && sessionViews.size > 0) {
    const viewsOnly = new Map<string, { pageViews: number; unique: number }>();
    for (const [productId, data] of sessionViews) {
      viewsOnly.set(productId, { pageViews: data.pageViews, unique: data.unique });
      // Also update add-to-cart in sales data
      const sales = salesByProduct.get(productId);
      if (sales) {
        sales.addToCart = data.addToCart;
      }
    }
    return { views: viewsOnly, source: "SHOPIFY_API" };
  }

  // Fall back to estimation
  const estimatedViews = await estimatePageViews(salesByProduct);
  return { views: estimatedViews, source: "ESTIMATED" };
}

/**
 * Estimate page views from sales data
 * Uses industry average conversion rate when real analytics not available
 */
async function estimatePageViews(
  salesByProduct: Map<string, { unitsSold: number; revenue: number; avgPrice: number; addToCart: number }>
): Promise<Map<string, { pageViews: number; unique: number }>> {
  const viewsMap = new Map<string, { pageViews: number; unique: number }>();

  // Industry average conversion rates
  const CONVERSION_RATE = 0.025; // 2.5% view-to-purchase
  const CART_RATE = 0.10; // 10% view-to-cart
  const UNIQUE_RATIO = 0.7; // 70% of page views are unique visitors

  for (const [productId, sales] of salesByProduct) {
    // Estimate views from sales using conversion rate
    const estimatedViews = sales.unitsSold > 0
      ? Math.round(sales.unitsSold / CONVERSION_RATE)
      : 0;

    // Estimate add-to-cart count
    const estimatedAddToCart = Math.round(estimatedViews * CART_RATE);

    // Update sales data with estimated add-to-cart
    sales.addToCart = estimatedAddToCart;

    viewsMap.set(productId, {
      pageViews: estimatedViews,
      unique: Math.round(estimatedViews * UNIQUE_RATIO),
    });
  }

  return viewsMap;
}

/**
 * Upsert daily analytics record
 */
async function upsertDailyAnalytics(
  shopId: string,
  data: DailyAnalytics
): Promise<void> {
  const conversionRate = data.pageViews > 0
    ? data.unitsSold / data.pageViews
    : null;

  const cartRate = data.pageViews > 0
    ? data.addToCartCount / data.pageViews
    : null;

  await prisma.productAnalyticsHistory.upsert({
    where: {
      shopId_productId_date: {
        shopId,
        productId: data.productId,
        date: data.date,
      },
    },
    update: {
      pageViews: data.pageViews,
      uniqueVisitors: data.uniqueVisitors,
      addToCartCount: data.addToCartCount,
      unitsSold: data.unitsSold,
      revenue: new Decimal(data.revenue),
      averagePrice: data.averagePrice ? new Decimal(data.averagePrice) : null,
      conversionRate: conversionRate ? new Decimal(conversionRate) : null,
      cartRate: cartRate ? new Decimal(cartRate) : null,
      inventoryLevel: data.inventoryLevel,
      dataSource: data.dataSource,
    },
    create: {
      shopId,
      productId: data.productId,
      variantId: data.variantId,
      date: data.date,
      pageViews: data.pageViews,
      uniqueVisitors: data.uniqueVisitors,
      addToCartCount: data.addToCartCount,
      unitsSold: data.unitsSold,
      revenue: new Decimal(data.revenue),
      averagePrice: data.averagePrice ? new Decimal(data.averagePrice) : null,
      conversionRate: conversionRate ? new Decimal(conversionRate) : null,
      cartRate: cartRate ? new Decimal(cartRate) : null,
      inventoryLevel: data.inventoryLevel,
      dataSource: data.dataSource,
    },
  });
}

/**
 * Get aggregated analytics for a product over a date range
 */
export async function getProductAnalytics(
  shopId: string,
  productId: string,
  days: number = 30
): Promise<{
  totalViews: number;
  totalSales: number;
  totalRevenue: number;
  avgConversionRate: number;
  avgInventory: number;
  trend: "up" | "down" | "stable";
}> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const analytics = await prisma.productAnalyticsHistory.findMany({
    where: {
      shopId,
      productId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: { date: "asc" },
  });

  if (analytics.length === 0) {
    return {
      totalViews: 0,
      totalSales: 0,
      totalRevenue: 0,
      avgConversionRate: 0,
      avgInventory: 0,
      trend: "stable",
    };
  }

  const totalViews = analytics.reduce((sum, a) => sum + a.pageViews, 0);
  const totalSales = analytics.reduce((sum, a) => sum + a.unitsSold, 0);
  const totalRevenue = analytics.reduce((sum, a) => sum + Number(a.revenue), 0);
  const avgConversionRate = totalViews > 0 ? totalSales / totalViews : 0;
  const avgInventory = analytics.reduce((sum, a) => sum + a.inventoryLevel, 0) / analytics.length;

  // Calculate trend (compare first half to second half)
  const midpoint = Math.floor(analytics.length / 2);
  const firstHalfSales = analytics.slice(0, midpoint).reduce((sum, a) => sum + a.unitsSold, 0);
  const secondHalfSales = analytics.slice(midpoint).reduce((sum, a) => sum + a.unitsSold, 0);

  let trend: "up" | "down" | "stable" = "stable";
  if (secondHalfSales > firstHalfSales * 1.1) trend = "up";
  else if (secondHalfSales < firstHalfSales * 0.9) trend = "down";

  return {
    totalViews,
    totalSales,
    totalRevenue,
    avgConversionRate,
    avgInventory,
    trend,
  };
}

/**
 * Get analytics summary for multiple products (for AI pricing)
 */
export async function getBulkProductAnalytics(
  shopId: string,
  productIds: string[],
  days: number = 30
): Promise<Map<string, {
  views7d: number;
  views30d: number;
  sales7d: number;
  sales30d: number;
  revenue7d: number;
  revenue30d: number;
  conversionRate: number;
  inventoryLevel: number;
  trend: "up" | "down" | "stable";
}>> {
  const results = new Map();

  const endDate = new Date();
  const startDate30 = new Date();
  startDate30.setDate(startDate30.getDate() - 30);
  const startDate7 = new Date();
  startDate7.setDate(startDate7.getDate() - 7);

  // Fetch all analytics in one query
  const analytics = await prisma.productAnalyticsHistory.findMany({
    where: {
      shopId,
      productId: { in: productIds },
      date: { gte: startDate30 },
    },
    orderBy: { date: "desc" },
  });

  // Group by product
  const byProduct = new Map<string, typeof analytics>();
  for (const record of analytics) {
    const existing = byProduct.get(record.productId) || [];
    existing.push(record);
    byProduct.set(record.productId, existing);
  }

  // Calculate stats for each product
  for (const productId of productIds) {
    const productAnalytics = byProduct.get(productId) || [];

    const last7Days = productAnalytics.filter(a => a.date >= startDate7);
    const last30Days = productAnalytics;

    const views7d = last7Days.reduce((sum, a) => sum + a.pageViews, 0);
    const views30d = last30Days.reduce((sum, a) => sum + a.pageViews, 0);
    const sales7d = last7Days.reduce((sum, a) => sum + a.unitsSold, 0);
    const sales30d = last30Days.reduce((sum, a) => sum + a.unitsSold, 0);
    const revenue7d = last7Days.reduce((sum, a) => sum + Number(a.revenue), 0);
    const revenue30d = last30Days.reduce((sum, a) => sum + Number(a.revenue), 0);

    const conversionRate = views30d > 0 ? sales30d / views30d : 0;
    const inventoryLevel = productAnalytics[0]?.inventoryLevel || 0;

    // Calculate trend
    const midpoint = Math.floor(last30Days.length / 2);
    const firstHalfSales = last30Days.slice(midpoint).reduce((sum, a) => sum + a.unitsSold, 0);
    const secondHalfSales = last30Days.slice(0, midpoint).reduce((sum, a) => sum + a.unitsSold, 0);

    let trend: "up" | "down" | "stable" = "stable";
    if (secondHalfSales > firstHalfSales * 1.1) trend = "up";
    else if (secondHalfSales < firstHalfSales * 0.9) trend = "down";

    results.set(productId, {
      views7d,
      views30d,
      sales7d,
      sales30d,
      revenue7d,
      revenue30d,
      conversionRate,
      inventoryLevel,
      trend,
    });
  }

  return results;
}

/**
 * Backfill analytics from order history
 * Useful for new installations
 */
export async function backfillAnalytics(
  shopId: string,
  admin: AdminGraphQL,
  days: number = 30
): Promise<{ synced: number; errors: string[] }> {
  const errors: string[] = [];
  let synced = 0;

  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    try {
      const result = await syncDailyAnalytics(shopId, admin, date);
      synced += result.synced;
      errors.push(...result.errors);
    } catch (error) {
      errors.push(`Failed to backfill ${date.toISOString()}: ${error}`);
    }
  }

  return { synced, errors };
}
