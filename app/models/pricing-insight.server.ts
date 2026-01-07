/**
 * Pricing Insight Model - AI-powered pricing suggestions
 */

import prisma from "~/db.server";
import type { InsightStatus } from "@prisma/client";

// ============================================================================
// QUERIES
// ============================================================================

export async function getPricingInsights(shopId: string, status?: InsightStatus) {
  const where: { shopId: string; status?: InsightStatus } = { shopId };
  if (status) {
    where.status = status;
  }

  const insights = await prisma.pricingInsight.findMany({
    where,
    orderBy: [{ confidenceScore: "desc" }, { createdAt: "desc" }],
  });

  return insights.map((insight) => ({
    id: insight.id,
    productId: insight.productId,
    productTitle: "", // Will be fetched from Shopify
    productImage: "", // Will be fetched from Shopify
    currentPrice: Number(insight.currentPrice),
    suggestedPrice: Number(insight.suggestedPrice),
    priceChange: calculatePriceChange(Number(insight.currentPrice), Number(insight.suggestedPrice)),
    direction: Number(insight.suggestedPrice) > Number(insight.currentPrice) ? "increase" : "decrease",
    confidenceScore: Number(insight.confidenceScore),
    reason: insight.reason || generateReason(insight),
    factors: insight.factors ? JSON.parse(insight.factors) : generateFactors(insight),
    status: insight.status,
    potentialRevenueLift: calculateRevenueLift(insight),
    viewsLast7Days: insight.viewsLast7Days,
    salesLast7Days: insight.salesLast7Days,
    conversionRate: insight.conversionRate ? Number(insight.conversionRate) * 100 : 0,
    competitorAvg: insight.competitorAvg ? Number(insight.competitorAvg) : null,
  }));
}

export async function getPricingInsightById(insightId: string) {
  return prisma.pricingInsight.findUnique({
    where: { id: insightId },
  });
}

export async function getPricingInsightStats(shopId: string) {
  const insights = await prisma.pricingInsight.findMany({
    where: { shopId },
  });

  const newInsights = insights.filter((i) => i.status === "NEW").length;
  const appliedInsights = insights.filter((i) => i.status === "APPLIED").length;

  const totalPotentialLift = insights
    .filter((i) => i.status === "NEW" || i.status === "VIEWED")
    .reduce((sum, i) => sum + calculateRevenueLift(i), 0);

  const avgConfidence =
    insights.length > 0
      ? insights.reduce((sum, i) => sum + Number(i.confidenceScore), 0) / insights.length
      : 0;

  return {
    totalInsights: insights.length,
    newInsights,
    appliedInsights,
    totalPotentialLift,
    avgConfidence: Math.round(avgConfidence * 100),
  };
}

// ============================================================================
// MUTATIONS
// ============================================================================

interface CreateInsightInput {
  shopId: string;
  productId: string;
  variantId?: string;
  currentPrice: number;
  costPrice?: number;
  suggestedPrice: number;
  suggestedDiscount?: number;
  confidenceScore: number;
  reason?: string;
  factors?: Record<string, number | string>;
  viewsLast7Days?: number;
  viewsLast30Days?: number;
  salesLast7Days?: number;
  salesLast30Days?: number;
  conversionRate?: number;
  competitorLow?: number;
  competitorHigh?: number;
  competitorAvg?: number;
}

export async function createPricingInsight(input: CreateInsightInput) {
  const currentMargin = input.costPrice
    ? ((input.currentPrice - input.costPrice) / input.currentPrice) * 100
    : null;

  return prisma.pricingInsight.create({
    data: {
      shopId: input.shopId,
      productId: input.productId,
      variantId: input.variantId,
      currentPrice: input.currentPrice,
      costPrice: input.costPrice,
      currentMargin,
      suggestedPrice: input.suggestedPrice,
      suggestedDiscount: input.suggestedDiscount,
      confidenceScore: input.confidenceScore,
      reason: input.reason,
      factors: input.factors ? JSON.stringify(input.factors) : null,
      viewsLast7Days: input.viewsLast7Days || 0,
      viewsLast30Days: input.viewsLast30Days || 0,
      salesLast7Days: input.salesLast7Days || 0,
      salesLast30Days: input.salesLast30Days || 0,
      conversionRate: input.conversionRate,
      competitorLow: input.competitorLow,
      competitorHigh: input.competitorHigh,
      competitorAvg: input.competitorAvg,
      status: "NEW",
    },
  });
}

export async function updateInsightStatus(insightId: string, status: InsightStatus) {
  const updateData: { status: InsightStatus; appliedAt?: Date; dismissedAt?: Date } = { status };

  if (status === "APPLIED") {
    updateData.appliedAt = new Date();
  } else if (status === "DISMISSED") {
    updateData.dismissedAt = new Date();
  }

  return prisma.pricingInsight.update({
    where: { id: insightId },
    data: updateData,
  });
}

export async function markInsightViewed(insightId: string) {
  const insight = await prisma.pricingInsight.findUnique({
    where: { id: insightId },
  });

  if (insight?.status === "NEW") {
    return prisma.pricingInsight.update({
      where: { id: insightId },
      data: { status: "VIEWED" },
    });
  }

  return insight;
}

export async function deleteInsight(insightId: string) {
  return prisma.pricingInsight.delete({
    where: { id: insightId },
  });
}

export async function bulkApplyInsights(insightIds: string[]) {
  return prisma.pricingInsight.updateMany({
    where: { id: { in: insightIds } },
    data: {
      status: "APPLIED",
      appliedAt: new Date(),
    },
  });
}

export async function bulkDismissInsights(insightIds: string[]) {
  return prisma.pricingInsight.updateMany({
    where: { id: { in: insightIds } },
    data: {
      status: "DISMISSED",
      dismissedAt: new Date(),
    },
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculatePriceChange(current: number, suggested: number): number {
  if (current === 0) return 0;
  return Math.round(((suggested - current) / current) * 1000) / 10;
}

function calculateRevenueLift(insight: { suggestedPrice: unknown; currentPrice: unknown; salesLast7Days: number }): number {
  const priceDiff = Number(insight.suggestedPrice) - Number(insight.currentPrice);
  // Simple estimate: price difference * weekly sales * 4 weeks
  return Math.abs(priceDiff * insight.salesLast7Days * 4);
}

function generateReason(insight: {
  suggestedPrice: unknown;
  currentPrice: unknown;
  viewsLast7Days: number;
  salesLast7Days: number;
  competitorAvg: unknown;
}): string {
  const isIncrease = Number(insight.suggestedPrice) > Number(insight.currentPrice);
  const conversionRate = insight.viewsLast7Days > 0 ? (insight.salesLast7Days / insight.viewsLast7Days) * 100 : 0;

  if (isIncrease) {
    if (conversionRate > 5) {
      return "Strong conversion rate indicates room for price increase";
    }
    if (insight.viewsLast7Days > 500) {
      return "High demand + Low inventory";
    }
    return "Market analysis suggests higher value";
  } else {
    if (conversionRate < 2) {
      return "Low conversion rate - price may be too high";
    }
    if (insight.competitorAvg && Number(insight.currentPrice) > Number(insight.competitorAvg)) {
      return "Below competitor average";
    }
    return "Slow sales + High inventory";
  }
}

function generateFactors(insight: {
  viewsLast7Days: number;
  salesLast7Days: number;
  competitorAvg: unknown;
  conversionRate: unknown;
  inventoryLevel?: number;
}): Record<string, number> {
  const conversionRate = insight.conversionRate
    ? Number(insight.conversionRate) * 100
    : insight.viewsLast7Days > 0
      ? (insight.salesLast7Days / insight.viewsLast7Days) * 100
      : 0;

  // Calculate inventory level based on sales velocity
  // If no inventory data provided, estimate from sales
  const avgDailySales = insight.salesLast7Days / 7;
  const inventoryLevel = (insight as { inventoryLevel?: number }).inventoryLevel !== undefined
    ? (insight as { inventoryLevel?: number }).inventoryLevel!
    : calculateInventoryLevelFromSales(avgDailySales);

  return {
    demandScore: Math.min(100, Math.round(insight.viewsLast7Days / 10)),
    inventoryLevel,
    competitorAvg: insight.competitorAvg ? Number(insight.competitorAvg) : 0,
    viewsLast7Days: insight.viewsLast7Days,
    salesLast7Days: insight.salesLast7Days,
    conversionRate: Math.round(conversionRate * 100) / 100,
  };
}

/**
 * Calculate inventory level score based on sales velocity
 * Returns 0-100 where higher = more inventory relative to demand
 */
function calculateInventoryLevelFromSales(avgDailySales: number): number {
  // Without actual inventory, estimate based on sales velocity
  // Higher sales = likely lower inventory, so inverse relationship
  if (avgDailySales >= 10) return 20; // High velocity = likely low stock
  if (avgDailySales >= 5) return 40;
  if (avgDailySales >= 2) return 60;
  if (avgDailySales >= 1) return 70;
  return 80; // Low sales velocity = likely overstocked
}

// ============================================================================
// AI INSIGHT GENERATION
// ============================================================================

interface ProductData {
  id: string;
  variantId?: string;
  currentPrice: number;
  costPrice?: number;
  views7d: number;
  views30d: number;
  sales7d: number;
  sales30d: number;
  inventoryLevel?: number;
}

export async function generateInsightsForProducts(shopId: string, products: ProductData[]) {
  const insights = [];

  for (const product of products) {
    const conversionRate = product.views7d > 0 ? product.sales7d / product.views7d : 0;

    // Simple AI logic for price suggestions
    let suggestedPrice = product.currentPrice;
    let confidence = 0.5;
    let reason = "";

    // High conversion + high views = can increase price
    if (conversionRate > 0.05 && product.views7d > 100) {
      suggestedPrice = product.currentPrice * 1.1; // Suggest 10% increase
      confidence = 0.7 + conversionRate;
      reason = "Strong conversion rate indicates room for price increase";
    }
    // Low conversion + low views = should decrease price
    else if (conversionRate < 0.02 && product.views7d > 50) {
      suggestedPrice = product.currentPrice * 0.9; // Suggest 10% decrease
      confidence = 0.6;
      reason = "Low conversion rate - price may be too high";
    }
    // Low views = needs attention
    else if (product.views7d < 20 && product.sales7d === 0) {
      suggestedPrice = product.currentPrice * 0.85; // Suggest 15% decrease
      confidence = 0.5;
      reason = "Low visibility - consider promotional pricing";
    }

    // Only create insight if there's a meaningful suggestion
    if (Math.abs(suggestedPrice - product.currentPrice) > 0.01) {
      const insight = await createPricingInsight({
        shopId,
        productId: product.id,
        variantId: product.variantId,
        currentPrice: product.currentPrice,
        costPrice: product.costPrice,
        suggestedPrice: Math.round(suggestedPrice * 100) / 100,
        confidenceScore: Math.min(1, confidence),
        reason,
        viewsLast7Days: product.views7d,
        viewsLast30Days: product.views30d,
        salesLast7Days: product.sales7d,
        salesLast30Days: product.sales30d,
        conversionRate,
      });

      insights.push(insight);
    }
  }

  return insights;
}
