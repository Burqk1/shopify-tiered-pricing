/**
 * Competitor Price Sync Service
 *
 * Manages syncing competitor prices from various sources:
 * - Manual API (user input)
 * - External APIs (Prisync, Competera, etc.)
 * - Google Shopping API
 * - Web scraping services
 */

import prisma from "~/db.server";
import type { CompetitorSource } from "@prisma/client";

// ============================================================================
// TYPES
// ============================================================================

export interface CompetitorPriceInput {
  productId: string;
  variantId?: string;
  productTitle?: string;
  sku?: string;
  competitorName: string;
  competitorUrl?: string;
  competitorPrice: number;
  source?: CompetitorSource;
}

export interface CompetitorPriceResult {
  productId: string;
  competitorName: string;
  price: number;
  previousPrice?: number;
  priceChange?: number;
  url?: string;
  fetchedAt: Date;
}

export interface BulkSyncResult {
  synced: number;
  failed: number;
  errors: string[];
}

export interface CompetitorApiConfig {
  provider: "prisync" | "competera" | "custom";
  apiKey: string;
  apiUrl?: string;
  enabled: boolean;
}

// ============================================================================
// MANUAL SYNC FUNCTIONS
// ============================================================================

/**
 * Add or update a single competitor price
 */
export async function syncCompetitorPrice(
  shopId: string,
  data: CompetitorPriceInput
): Promise<CompetitorPriceResult> {
  // Get existing record to track price changes
  const existing = await prisma.competitorPrice.findUnique({
    where: {
      shopId_productId_competitorName: {
        shopId,
        productId: data.productId,
        competitorName: data.competitorName,
      },
    },
  });

  const previousPrice = existing ? Number(existing.competitorPrice) : undefined;
  let priceDirection: "UP" | "DOWN" | "STABLE" | null = null;
  let priceChangePercent: number | null = null;

  if (previousPrice !== undefined) {
    const diff = data.competitorPrice - previousPrice;
    priceChangePercent = (diff / previousPrice) * 100;
    if (diff > 0.01) priceDirection = "UP";
    else if (diff < -0.01) priceDirection = "DOWN";
    else priceDirection = "STABLE";
  }

  const result = await prisma.competitorPrice.upsert({
    where: {
      shopId_productId_competitorName: {
        shopId,
        productId: data.productId,
        competitorName: data.competitorName,
      },
    },
    update: {
      competitorPrice: data.competitorPrice,
      competitorUrl: data.competitorUrl,
      productTitle: data.productTitle,
      sku: data.sku,
      previousPrice,
      priceChangePercent,
      priceDirection,
      source: data.source || "MANUAL",
      updatedAt: new Date(),
    },
    create: {
      shopId,
      productId: data.productId,
      variantId: data.variantId,
      productTitle: data.productTitle,
      sku: data.sku,
      competitorName: data.competitorName,
      competitorUrl: data.competitorUrl,
      competitorPrice: data.competitorPrice,
      source: data.source || "MANUAL",
    },
  });

  return {
    productId: result.productId,
    competitorName: result.competitorName,
    price: Number(result.competitorPrice),
    previousPrice,
    priceChange: priceChangePercent ?? undefined,
    url: result.competitorUrl ?? undefined,
    fetchedAt: result.updatedAt,
  };
}

/**
 * Bulk sync competitor prices
 */
export async function bulkSyncCompetitorPrices(
  shopId: string,
  prices: CompetitorPriceInput[]
): Promise<BulkSyncResult> {
  const errors: string[] = [];
  let synced = 0;
  let failed = 0;

  for (const price of prices) {
    try {
      await syncCompetitorPrice(shopId, price);
      synced++;
    } catch (error) {
      failed++;
      errors.push(`Failed to sync ${price.productId} from ${price.competitorName}: ${(error as Error).message}`);
    }
  }

  return { synced, failed, errors };
}

/**
 * Import competitor prices from CSV data
 */
export async function importCompetitorPricesFromCSV(
  shopId: string,
  csvData: string
): Promise<BulkSyncResult> {
  const lines = csvData.split("\n").filter((line) => line.trim());
  const prices: CompetitorPriceInput[] = [];
  const errors: string[] = [];

  // Parse header
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const productIdIdx = header.indexOf("product_id");
  const competitorNameIdx = header.indexOf("competitor_name");
  const priceIdx = header.indexOf("price");
  const urlIdx = header.indexOf("url");
  const skuIdx = header.indexOf("sku");

  if (productIdIdx === -1 || competitorNameIdx === -1 || priceIdx === -1) {
    return {
      synced: 0,
      failed: 1,
      errors: ["CSV must have columns: product_id, competitor_name, price"],
    };
  }

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim());

    try {
      const price = parseFloat(values[priceIdx]);
      if (isNaN(price) || price <= 0) {
        errors.push(`Row ${i + 1}: Invalid price`);
        continue;
      }

      prices.push({
        productId: values[productIdIdx],
        competitorName: values[competitorNameIdx],
        competitorPrice: price,
        competitorUrl: urlIdx !== -1 ? values[urlIdx] : undefined,
        sku: skuIdx !== -1 ? values[skuIdx] : undefined,
        source: "MANUAL",
      });
    } catch {
      errors.push(`Row ${i + 1}: Failed to parse`);
    }
  }

  if (prices.length === 0) {
    return { synced: 0, failed: lines.length - 1, errors };
  }

  const result = await bulkSyncCompetitorPrices(shopId, prices);
  return {
    ...result,
    errors: [...errors, ...result.errors],
  };
}

// ============================================================================
// EXTERNAL API INTEGRATIONS
// ============================================================================

/**
 * Sync prices from Prisync API
 * https://prisync.com/api/
 */
export async function syncFromPrisync(
  shopId: string,
  apiKey: string,
  productIds?: string[]
): Promise<BulkSyncResult> {
  const errors: string[] = [];
  const prices: CompetitorPriceInput[] = [];

  try {
    // Prisync API endpoint
    const response = await fetch("https://api.prisync.com/v2/list/product/all", {
      headers: {
        "apikey": apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Prisync API error: ${response.status}`);
    }

    const data = await response.json();

    // Parse Prisync response format
    for (const product of data.results || []) {
      // Filter by productIds if specified
      if (productIds && !productIds.includes(product.internal_code)) {
        continue;
      }

      for (const competitor of product.competitors || []) {
        if (competitor.price && competitor.price > 0) {
          prices.push({
            productId: product.internal_code,
            productTitle: product.name,
            sku: product.barcode,
            competitorName: competitor.name,
            competitorUrl: competitor.url,
            competitorPrice: parseFloat(competitor.price),
            source: "API",
          });
        }
      }
    }

    if (prices.length === 0) {
      return { synced: 0, failed: 0, errors: ["No prices found in Prisync response"] };
    }

    return await bulkSyncCompetitorPrices(shopId, prices);
  } catch (error) {
    return {
      synced: 0,
      failed: 1,
      errors: [`Prisync sync failed: ${(error as Error).message}`],
    };
  }
}

/**
 * Sync prices from Competera API
 * https://competera.net/
 */
export async function syncFromCompetera(
  shopId: string,
  apiKey: string,
  apiUrl: string,
  productIds?: string[]
): Promise<BulkSyncResult> {
  const errors: string[] = [];
  const prices: CompetitorPriceInput[] = [];

  try {
    const response = await fetch(`${apiUrl}/prices`, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Competera API error: ${response.status}`);
    }

    const data = await response.json();

    for (const item of data.items || []) {
      if (productIds && !productIds.includes(item.product_id)) {
        continue;
      }

      for (const competitor of item.competitor_prices || []) {
        prices.push({
          productId: item.product_id,
          productTitle: item.product_name,
          sku: item.sku,
          competitorName: competitor.competitor_name,
          competitorUrl: competitor.url,
          competitorPrice: competitor.price,
          source: "API",
        });
      }
    }

    if (prices.length === 0) {
      return { synced: 0, failed: 0, errors: ["No prices found in Competera response"] };
    }

    return await bulkSyncCompetitorPrices(shopId, prices);
  } catch (error) {
    return {
      synced: 0,
      failed: 1,
      errors: [`Competera sync failed: ${(error as Error).message}`],
    };
  }
}

/**
 * Sync prices from a custom API endpoint
 * Expected format: { prices: [{ product_id, competitor_name, price, url? }] }
 */
export async function syncFromCustomAPI(
  shopId: string,
  apiUrl: string,
  apiKey?: string,
  productIds?: string[]
): Promise<BulkSyncResult> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const response = await fetch(apiUrl, { headers });

    if (!response.ok) {
      throw new Error(`Custom API error: ${response.status}`);
    }

    const data = await response.json();
    const prices: CompetitorPriceInput[] = [];

    for (const item of data.prices || data.results || data || []) {
      const productId = item.product_id || item.productId || item.id;
      if (!productId) continue;

      if (productIds && !productIds.includes(productId)) {
        continue;
      }

      prices.push({
        productId,
        productTitle: item.product_name || item.title,
        sku: item.sku,
        competitorName: item.competitor_name || item.competitor,
        competitorUrl: item.url || item.competitor_url,
        competitorPrice: parseFloat(item.price || item.competitor_price),
        source: "API",
      });
    }

    if (prices.length === 0) {
      return { synced: 0, failed: 0, errors: ["No prices found in API response"] };
    }

    return await bulkSyncCompetitorPrices(shopId, prices);
  } catch (error) {
    return {
      synced: 0,
      failed: 1,
      errors: [`Custom API sync failed: ${(error as Error).message}`],
    };
  }
}

// ============================================================================
// GOOGLE SHOPPING INTEGRATION
// ============================================================================

/**
 * Fetch competitor prices from Google Shopping API
 * Requires Google Content API access
 */
export async function syncFromGoogleShopping(
  shopId: string,
  credentials: {
    merchantId: string;
    accessToken: string;
  },
  productQueries: { productId: string; searchTerm: string }[]
): Promise<BulkSyncResult> {
  const prices: CompetitorPriceInput[] = [];
  const errors: string[] = [];

  for (const query of productQueries) {
    try {
      // Google Shopping API search endpoint
      const searchUrl = `https://shoppingcontent.googleapis.com/content/v2.1/${credentials.merchantId}/products`;

      const response = await fetch(searchUrl, {
        headers: {
          "Authorization": `Bearer ${credentials.accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        errors.push(`Google Shopping API error for ${query.productId}: ${response.status}`);
        continue;
      }

      const data = await response.json();

      // Parse Google Shopping results
      for (const result of data.resources || []) {
        if (result.price && result.price.value) {
          prices.push({
            productId: query.productId,
            competitorName: result.brand || result.title?.split(" ")[0] || "Unknown",
            competitorPrice: parseFloat(result.price.value),
            competitorUrl: result.link,
            source: "GOOGLE_SHOPPING",
          });
        }
      }
    } catch (error) {
      errors.push(`Failed to fetch ${query.productId}: ${(error as Error).message}`);
    }
  }

  if (prices.length === 0) {
    return { synced: 0, failed: productQueries.length, errors };
  }

  const result = await bulkSyncCompetitorPrices(shopId, prices);
  return {
    ...result,
    errors: [...errors, ...result.errors],
  };
}

// ============================================================================
// SCHEDULED SYNC
// ============================================================================

/**
 * Get competitor sync settings for a shop
 */
export async function getCompetitorSyncSettings(shopId: string): Promise<CompetitorApiConfig | null> {
  const settings = await prisma.competitorSyncSettings.findUnique({
    where: { shopId },
  });

  if (!settings || !settings.enabled) return null;

  // Map provider enum to config provider string
  const providerMap: Record<string, string> = {
    PRISYNC: "prisync",
    COMPETERA: "competera",
    GOOGLE_SHOPPING: "google",
    AMAZON: "amazon",
    CUSTOM: "custom",
  };

  return {
    provider: providerMap[settings.provider] || "custom",
    apiKey: settings.apiKey || "",
    apiUrl: settings.apiEndpoint || undefined,
    enabled: settings.enabled,
  };
}

/**
 * Update competitor sync settings
 */
export async function updateCompetitorSyncSettings(
  shopId: string,
  data: {
    provider?: string;
    apiKey?: string;
    apiSecret?: string;
    apiEndpoint?: string;
    enabled?: boolean;
    syncFrequency?: string;
    syncAllProducts?: boolean;
    syncProductIds?: string[];
    autoApplyRules?: boolean;
    priceMatchEnabled?: boolean;
    priceBeatPercent?: number;
    minMarginPercent?: number;
    notifyOnPriceChange?: boolean;
    notifyEmail?: string;
    priceChangeThreshold?: number;
  }
) {
  // Map provider string to enum
  const providerEnumMap: Record<string, any> = {
    prisync: "PRISYNC",
    competera: "COMPETERA",
    google: "GOOGLE_SHOPPING",
    amazon: "AMAZON",
    custom: "CUSTOM",
  };

  const frequencyEnumMap: Record<string, any> = {
    hourly: "HOURLY",
    daily: "DAILY",
    weekly: "WEEKLY",
    monthly: "MONTHLY",
  };

  return prisma.competitorSyncSettings.upsert({
    where: { shopId },
    update: {
      provider: data.provider ? providerEnumMap[data.provider] : undefined,
      apiKey: data.apiKey,
      apiSecret: data.apiSecret,
      apiEndpoint: data.apiEndpoint,
      enabled: data.enabled,
      syncFrequency: data.syncFrequency ? frequencyEnumMap[data.syncFrequency] : undefined,
      syncAllProducts: data.syncAllProducts,
      syncProductIds: data.syncProductIds,
      autoApplyRules: data.autoApplyRules,
      priceMatchEnabled: data.priceMatchEnabled,
      priceBeatPercent: data.priceBeatPercent,
      minMarginPercent: data.minMarginPercent,
      notifyOnPriceChange: data.notifyOnPriceChange,
      notifyEmail: data.notifyEmail,
      priceChangeThreshold: data.priceChangeThreshold,
    },
    create: {
      shopId,
      provider: data.provider ? providerEnumMap[data.provider] : "CUSTOM",
      apiKey: data.apiKey,
      apiSecret: data.apiSecret,
      apiEndpoint: data.apiEndpoint,
      enabled: data.enabled ?? false,
      syncFrequency: data.syncFrequency ? frequencyEnumMap[data.syncFrequency] : "DAILY",
      syncAllProducts: data.syncAllProducts ?? false,
      syncProductIds: data.syncProductIds ?? [],
      autoApplyRules: data.autoApplyRules ?? false,
      priceMatchEnabled: data.priceMatchEnabled ?? false,
      priceBeatPercent: data.priceBeatPercent,
      minMarginPercent: data.minMarginPercent,
      notifyOnPriceChange: data.notifyOnPriceChange ?? true,
      notifyEmail: data.notifyEmail,
      priceChangeThreshold: data.priceChangeThreshold,
    },
  });
}

/**
 * Update sync status after a sync attempt
 */
export async function updateSyncStatus(
  shopId: string,
  status: "SUCCESS" | "PARTIAL" | "FAILED" | "IN_PROGRESS",
  error?: string,
  productsSynced?: number
) {
  const nextSyncAt = new Date();

  // Get current settings to determine next sync time
  const settings = await prisma.competitorSyncSettings.findUnique({
    where: { shopId },
    select: { syncFrequency: true },
  });

  if (settings) {
    switch (settings.syncFrequency) {
      case "HOURLY":
        nextSyncAt.setHours(nextSyncAt.getHours() + 1);
        break;
      case "DAILY":
        nextSyncAt.setDate(nextSyncAt.getDate() + 1);
        break;
      case "WEEKLY":
        nextSyncAt.setDate(nextSyncAt.getDate() + 7);
        break;
      case "MONTHLY":
        nextSyncAt.setMonth(nextSyncAt.getMonth() + 1);
        break;
    }
  }

  return prisma.competitorSyncSettings.update({
    where: { shopId },
    data: {
      lastSyncAt: new Date(),
      nextSyncAt: status !== "IN_PROGRESS" ? nextSyncAt : undefined,
      lastSyncStatus: status,
      lastSyncError: error || null,
      totalSyncs: { increment: status !== "IN_PROGRESS" ? 1 : 0 },
      totalProductsSynced: productsSynced ? { increment: productsSynced } : undefined,
    },
  });
}

/**
 * Run scheduled competitor sync
 * Call this from a cron job
 */
export async function runScheduledCompetitorSync(shopId: string): Promise<BulkSyncResult> {
  const settings = await getCompetitorSyncSettings(shopId);

  if (!settings || !settings.enabled) {
    return { synced: 0, failed: 0, errors: ["Competitor sync not enabled"] };
  }

  switch (settings.provider) {
    case "prisync":
      return syncFromPrisync(shopId, settings.apiKey);

    case "competera":
      if (!settings.apiUrl) {
        return { synced: 0, failed: 1, errors: ["Competera requires apiUrl"] };
      }
      return syncFromCompetera(shopId, settings.apiKey, settings.apiUrl);

    case "custom":
      if (!settings.apiUrl) {
        return { synced: 0, failed: 1, errors: ["Custom API requires apiUrl"] };
      }
      return syncFromCustomAPI(shopId, settings.apiUrl, settings.apiKey);

    default:
      return { synced: 0, failed: 1, errors: [`Unknown provider: ${settings.provider}`] };
  }
}

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

/**
 * Get all competitor prices for a shop
 */
export async function getCompetitorPrices(shopId: string, productId?: string) {
  return prisma.competitorPrice.findMany({
    where: {
      shopId,
      ...(productId ? { productId } : {}),
    },
    orderBy: [{ productId: "asc" }, { competitorName: "asc" }],
  });
}

/**
 * Get competitor price stats for products
 */
export async function getCompetitorPriceStats(
  shopId: string,
  productIds: string[]
): Promise<Map<string, { low: number; high: number; avg: number; count: number }>> {
  const stats = new Map<string, { low: number; high: number; avg: number; count: number }>();

  const prices = await prisma.competitorPrice.findMany({
    where: {
      shopId,
      productId: { in: productIds },
    },
  });

  const byProduct = new Map<string, number[]>();
  for (const price of prices) {
    const arr = byProduct.get(price.productId) || [];
    arr.push(Number(price.competitorPrice));
    byProduct.set(price.productId, arr);
  }

  for (const [productId, priceList] of byProduct) {
    if (priceList.length > 0) {
      stats.set(productId, {
        low: Math.min(...priceList),
        high: Math.max(...priceList),
        avg: priceList.reduce((a, b) => a + b, 0) / priceList.length,
        count: priceList.length,
      });
    }
  }

  return stats;
}

/**
 * Get price position analysis
 */
export async function analyzePricePosition(
  shopId: string,
  productId: string,
  currentPrice: number
): Promise<{
  position: "below" | "at" | "above";
  percentDiff: number;
  competitorCount: number;
  lowestCompetitor?: { name: string; price: number };
  highestCompetitor?: { name: string; price: number };
}> {
  const competitors = await prisma.competitorPrice.findMany({
    where: { shopId, productId },
    orderBy: { competitorPrice: "asc" },
  });

  if (competitors.length === 0) {
    return {
      position: "at",
      percentDiff: 0,
      competitorCount: 0,
    };
  }

  const prices = competitors.map((c) => Number(c.competitorPrice));
  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
  const percentDiff = ((currentPrice - avgPrice) / avgPrice) * 100;

  let position: "below" | "at" | "above" = "at";
  if (percentDiff < -5) position = "below";
  else if (percentDiff > 5) position = "above";

  return {
    position,
    percentDiff: Math.round(percentDiff * 10) / 10,
    competitorCount: competitors.length,
    lowestCompetitor: {
      name: competitors[0].competitorName,
      price: Number(competitors[0].competitorPrice),
    },
    highestCompetitor: {
      name: competitors[competitors.length - 1].competitorName,
      price: Number(competitors[competitors.length - 1].competitorPrice),
    },
  };
}

/**
 * Delete competitor price
 */
export async function deleteCompetitorPrice(id: string) {
  return prisma.competitorPrice.delete({
    where: { id },
  });
}

/**
 * Delete all competitor prices for a product
 */
export async function deleteProductCompetitorPrices(shopId: string, productId: string) {
  return prisma.competitorPrice.deleteMany({
    where: { shopId, productId },
  });
}
