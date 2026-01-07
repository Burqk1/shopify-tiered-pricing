/**
 * AI Pricing Server Functions
 *
 * Generates pricing insights based on:
 * - Sales velocity and demand signals
 * - Inventory levels
 * - Competitor pricing (when available)
 * - Historical performance
 */

import prisma from "~/db.server";
import type { InsightStatus, Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

export interface ProductData {
  productId: string;
  variantId?: string;
  title: string;
  currentPrice: number;
  costPrice?: number;
  inventoryQuantity?: number;
  viewsLast7Days?: number;
  viewsLast30Days?: number;
  salesLast7Days?: number;
  salesLast30Days?: number;
}

export interface CompetitorData {
  productId: string;
  competitorName?: string;
  competitorPrice: number;
  url?: string;
  fetchedAt: Date;
}

export interface GeneratedInsight {
  productId: string;
  variantId?: string;
  currentPrice: number;
  suggestedPrice: number;
  priceChange: number;
  direction: "increase" | "decrease" | "maintain";
  confidenceScore: number;
  reason: string;
  factors: {
    demandScore: number;
    inventoryLevel: number;
    competitorAvg?: number;
    viewsLast7Days: number;
    salesLast7Days: number;
    conversionRate: number;
  };
}

/**
 * Generate AI pricing insights for products
 */
export async function generatePricingInsights(
  shopId: string,
  products: ProductData[],
  competitorData?: CompetitorData[]
): Promise<GeneratedInsight[]> {
  const insights: GeneratedInsight[] = [];

  for (const product of products) {
    // Find competitor data for this product
    const competitors = competitorData?.filter(
      (c) => c.productId === product.productId
    ) || [];

    const competitorPrices = competitors.map((c) => c.competitorPrice);
    const competitorAvg =
      competitorPrices.length > 0
        ? competitorPrices.reduce((a, b) => a + b, 0) / competitorPrices.length
        : undefined;
    const competitorLow =
      competitorPrices.length > 0 ? Math.min(...competitorPrices) : undefined;
    const competitorHigh =
      competitorPrices.length > 0 ? Math.max(...competitorPrices) : undefined;

    // Calculate demand score (0-100)
    const viewsScore = Math.min(100, (product.viewsLast7Days || 0) / 10);
    const salesScore = Math.min(100, (product.salesLast7Days || 0) * 10);
    const demandScore = Math.round((viewsScore + salesScore) / 2);

    // Calculate conversion rate
    const conversionRate =
      (product.viewsLast7Days || 0) > 0
        ? ((product.salesLast7Days || 0) / (product.viewsLast7Days || 1)) * 100
        : 0;

    // Calculate inventory level (0-100, where 100 is overstocked)
    const inventoryLevel = Math.min(100, product.inventoryQuantity || 50);

    // Generate price suggestion
    let suggestedPrice = product.currentPrice;
    let reason = "";
    let confidenceScore = 0.5;

    // Rule-based pricing logic
    if (demandScore >= 80 && inventoryLevel < 30) {
      // High demand, low inventory -> increase price
      const increase = 1 + (demandScore - 50) / 500; // 6-10% increase
      suggestedPrice = Math.round(product.currentPrice * increase * 100) / 100;
      reason = "High demand + Low inventory";
      confidenceScore = 0.85 + (demandScore - 80) / 200;
    } else if (demandScore < 40 && inventoryLevel > 60) {
      // Low demand, high inventory -> decrease price
      const decrease = 1 - (60 - demandScore) / 500; // 4-12% decrease
      suggestedPrice = Math.round(product.currentPrice * decrease * 100) / 100;
      reason = "Slow sales + High inventory";
      confidenceScore = 0.7 + (inventoryLevel - 60) / 200;
    } else if (conversionRate > 5) {
      // Strong conversion -> can increase slightly
      suggestedPrice = Math.round(product.currentPrice * 1.1 * 100) / 100;
      reason = "Strong conversion rate";
      confidenceScore = 0.85 + conversionRate / 100;
    } else if (competitorAvg && product.currentPrice > competitorAvg * 1.2) {
      // Price significantly above competitors
      suggestedPrice = Math.round(competitorAvg * 1.05 * 100) / 100;
      reason = "Above competitor average";
      confidenceScore = 0.75;
    } else if (competitorAvg && product.currentPrice < competitorAvg * 0.8) {
      // Price significantly below competitors
      suggestedPrice = Math.round(competitorAvg * 0.95 * 100) / 100;
      reason = "Below competitor average - opportunity to increase";
      confidenceScore = 0.7;
    }

    // Ensure confidence is within bounds
    confidenceScore = Math.max(0.5, Math.min(0.99, confidenceScore));

    // Calculate price change percentage
    const priceChange =
      ((suggestedPrice - product.currentPrice) / product.currentPrice) * 100;

    // Determine direction
    let direction: "increase" | "decrease" | "maintain" = "maintain";
    if (priceChange > 1) direction = "increase";
    else if (priceChange < -1) direction = "decrease";

    // Only add insight if there's a meaningful change
    if (Math.abs(priceChange) > 1) {
      insights.push({
        productId: product.productId,
        variantId: product.variantId,
        currentPrice: product.currentPrice,
        suggestedPrice,
        priceChange: Math.round(priceChange * 10) / 10,
        direction,
        confidenceScore: Math.round(confidenceScore * 100) / 100,
        reason,
        factors: {
          demandScore,
          inventoryLevel,
          competitorAvg,
          viewsLast7Days: product.viewsLast7Days || 0,
          salesLast7Days: product.salesLast7Days || 0,
          conversionRate: Math.round(conversionRate * 100) / 100,
        },
      });
    }
  }

  return insights;
}

/**
 * Save generated insights to database
 */
export async function savePricingInsights(
  shopId: string,
  insights: GeneratedInsight[],
  competitorData?: { productId: string; low?: number; high?: number; avg?: number }[]
): Promise<void> {
  for (const insight of insights) {
    const competitors = competitorData?.find(
      (c) => c.productId === insight.productId
    );

    await prisma.pricingInsight.upsert({
      where: {
        id: `${shopId}-${insight.productId}`,
      },
      update: {
        currentPrice: new Decimal(insight.currentPrice),
        suggestedPrice: new Decimal(insight.suggestedPrice),
        confidenceScore: new Decimal(insight.confidenceScore),
        reason: insight.reason,
        factors: JSON.stringify(insight.factors),
        viewsLast7Days: insight.factors.viewsLast7Days,
        viewsLast30Days: 0, // Would be populated from actual data
        salesLast7Days: insight.factors.salesLast7Days,
        salesLast30Days: 0,
        conversionRate: new Decimal(insight.factors.conversionRate / 100),
        competitorLow: competitors?.low ? new Decimal(competitors.low) : null,
        competitorHigh: competitors?.high ? new Decimal(competitors.high) : null,
        competitorAvg: competitors?.avg ? new Decimal(competitors.avg) : null,
        status: "NEW",
        updatedAt: new Date(),
      },
      create: {
        id: `${shopId}-${insight.productId}`,
        shopId,
        productId: insight.productId,
        variantId: insight.variantId || null,
        currentPrice: new Decimal(insight.currentPrice),
        suggestedPrice: new Decimal(insight.suggestedPrice),
        confidenceScore: new Decimal(insight.confidenceScore),
        reason: insight.reason,
        factors: JSON.stringify(insight.factors),
        viewsLast7Days: insight.factors.viewsLast7Days,
        viewsLast30Days: 0,
        salesLast7Days: insight.factors.salesLast7Days,
        salesLast30Days: 0,
        conversionRate: new Decimal(insight.factors.conversionRate / 100),
        competitorLow: competitors?.low ? new Decimal(competitors.low) : null,
        competitorHigh: competitors?.high ? new Decimal(competitors.high) : null,
        competitorAvg: competitors?.avg ? new Decimal(competitors.avg) : null,
        status: "NEW",
      },
    });
  }
}

/**
 * Get pricing insights for a shop
 */
export async function getPricingInsights(
  shopId: string,
  options?: {
    status?: InsightStatus | InsightStatus[];
    limit?: number;
  }
) {
  const statusFilter = options?.status
    ? {
        status: Array.isArray(options.status)
          ? { in: options.status }
          : options.status,
      }
    : {};

  return prisma.pricingInsight.findMany({
    where: {
      shopId,
      ...statusFilter,
    },
    orderBy: [
      { confidenceScore: "desc" },
      { createdAt: "desc" },
    ],
    take: options?.limit || 50,
  });
}

/**
 * Update insight status
 */
export async function updateInsightStatus(
  insightId: string,
  status: InsightStatus
): Promise<void> {
  const updateData: Prisma.PricingInsightUpdateInput = { status };

  if (status === "APPLIED") {
    updateData.appliedAt = new Date();
  } else if (status === "DISMISSED") {
    updateData.dismissedAt = new Date();
  }

  await prisma.pricingInsight.update({
    where: { id: insightId },
    data: updateData,
  });
}

/**
 * Fetch competitor prices from database
 * Prices can be added via:
 * 1. Manual entry through UI
 * 2. External API integrations (Prisync, Competera, etc.)
 * 3. Web scraping services
 */
export async function fetchCompetitorPrices(
  shopId: string,
  productIds: string[]
): Promise<CompetitorData[]> {
  // Fetch competitor prices from database
  const competitorPrices = await prisma.competitorPrice.findMany({
    where: {
      shopId,
      productId: { in: productIds },
    },
    orderBy: { updatedAt: "desc" },
  });

  return competitorPrices.map((cp) => ({
    productId: cp.productId,
    competitorName: cp.competitorName,
    competitorPrice: Number(cp.competitorPrice),
    url: cp.competitorUrl || undefined,
    fetchedAt: cp.updatedAt,
  }));
}

/**
 * Get aggregated competitor price stats for products
 */
export async function getCompetitorPriceStats(
  shopId: string,
  productIds: string[]
): Promise<Map<string, { low: number; high: number; avg: number; count: number }>> {
  const stats = new Map<string, { low: number; high: number; avg: number; count: number }>();

  const competitorPrices = await prisma.competitorPrice.findMany({
    where: {
      shopId,
      productId: { in: productIds },
    },
  });

  // Group by product and calculate stats
  const byProduct = new Map<string, number[]>();
  for (const cp of competitorPrices) {
    const prices = byProduct.get(cp.productId) || [];
    prices.push(Number(cp.competitorPrice));
    byProduct.set(cp.productId, prices);
  }

  for (const [productId, prices] of byProduct) {
    if (prices.length > 0) {
      stats.set(productId, {
        low: Math.min(...prices),
        high: Math.max(...prices),
        avg: prices.reduce((a, b) => a + b, 0) / prices.length,
        count: prices.length,
      });
    }
  }

  return stats;
}

/**
 * Add or update a competitor price entry
 */
export async function upsertCompetitorPrice(
  shopId: string,
  data: {
    productId: string;
    variantId?: string;
    productTitle?: string;
    sku?: string;
    competitorName: string;
    competitorUrl?: string;
    competitorPrice: number;
    source?: "MANUAL" | "API" | "SCRAPER" | "GOOGLE_SHOPPING" | "AMAZON";
  }
) {
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

  const previousPrice = existing ? Number(existing.competitorPrice) : null;
  let priceDirection: "UP" | "DOWN" | "STABLE" | null = null;
  let priceChangePercent: number | null = null;

  if (previousPrice !== null) {
    const diff = data.competitorPrice - previousPrice;
    priceChangePercent = (diff / previousPrice) * 100;
    if (diff > 0.01) priceDirection = "UP";
    else if (diff < -0.01) priceDirection = "DOWN";
    else priceDirection = "STABLE";
  }

  return prisma.competitorPrice.upsert({
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
}

/**
 * Delete a competitor price entry
 */
export async function deleteCompetitorPrice(id: string) {
  return prisma.competitorPrice.delete({
    where: { id },
  });
}

/**
 * Get all competitor prices for a shop
 */
export async function getCompetitorPrices(shopId: string) {
  return prisma.competitorPrice.findMany({
    where: { shopId },
    orderBy: [{ productId: "asc" }, { competitorName: "asc" }],
  });
}

/**
 * Calculate potential revenue lift from applying suggestions
 */
export function calculatePotentialRevenueLift(
  currentPrice: number,
  suggestedPrice: number,
  expectedUnitsSold: number
): number {
  const currentRevenue = currentPrice * expectedUnitsSold;
  const projectedRevenue = suggestedPrice * expectedUnitsSold;
  return Math.round((projectedRevenue - currentRevenue) * 100) / 100;
}
