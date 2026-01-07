/**
 * ML Pricing Service
 *
 * Advanced pricing algorithm using weighted scoring and profit margin protection.
 * Replaces the simple rule-based approach with a more sophisticated model.
 */

import prisma from "~/db.server";
import type { MLModelConfig } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

// ============================================================================
// TYPES
// ============================================================================

export interface ProductPricingData {
  productId: string;
  variantId?: string;
  title: string;
  currentPrice: number;
  costPrice?: number;
  inventoryQuantity: number;

  // Analytics data
  views7d: number;
  views30d: number;
  sales7d: number;
  sales30d: number;
  conversionRate: number;

  // Competitor data
  competitorLow?: number;
  competitorHigh?: number;
  competitorAvg?: number;

  // Historical elasticity
  elasticity?: number;
}

export interface PricingSuggestion {
  productId: string;
  variantId?: string;
  currentPrice: number;
  suggestedPrice: number;
  priceChange: number;
  direction: "increase" | "decrease" | "maintain";
  confidenceScore: number;
  reason: string;

  // Detailed breakdown
  factors: {
    demandScore: number;
    inventoryScore: number;
    competitorScore: number;
    conversionScore: number;
    marginScore: number;
    seasonalityScore: number;
    weightedTotal: number;
  };

  // Constraints applied
  constraints: {
    marginProtected: boolean;
    maxChangeApplied: boolean;
    originalSuggestion: number;
    finalSuggestion: number;
  };
}

export interface ModelWeights {
  demand: number;
  inventory: number;
  competitor: number;
  conversion: number;
  margin: number;
  seasonality: number;
}

export interface SeasonalityData {
  currentPeriodSales: number;
  lastYearSamePeriodSales: number;
  monthlyAverageSales: number;
  weeklyTrend: number; // Percentage change week over week
  isHolidayPeriod: boolean;
  specialEvents?: string[]; // e.g., "Black Friday", "Valentine's Day"
}

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const DEFAULT_WEIGHTS: ModelWeights = {
  demand: 0.25,
  inventory: 0.20,
  competitor: 0.20,
  conversion: 0.15,
  margin: 0.10,
  seasonality: 0.10,
};

const DEFAULT_CONSTRAINTS = {
  minMarginPercent: 10,
  maxPriceIncrease: 20,
  maxPriceDecrease: 25,
  defaultElasticity: -1.5,
};

// ============================================================================
// MAIN PRICING FUNCTION
// ============================================================================

/**
 * Generate ML-based pricing suggestions for products
 */
export async function generateMLPricingSuggestions(
  shopId: string,
  products: ProductPricingData[]
): Promise<PricingSuggestion[]> {
  // Get shop's model config or use defaults
  const config = await getMLModelConfig(shopId);
  const weights = extractWeights(config);
  const constraints = extractConstraints(config);

  const suggestions: PricingSuggestion[] = [];

  for (const product of products) {
    const suggestion = calculatePriceSuggestion(product, weights, constraints);

    // Only include meaningful suggestions (>1% change)
    if (Math.abs(suggestion.priceChange) > 1) {
      suggestions.push(suggestion);
    }
  }

  // Sort by confidence score (highest first)
  return suggestions.sort((a, b) => b.confidenceScore - a.confidenceScore);
}

/**
 * Calculate price suggestion for a single product
 */
function calculatePriceSuggestion(
  product: ProductPricingData,
  weights: ModelWeights,
  constraints: typeof DEFAULT_CONSTRAINTS
): PricingSuggestion {
  // Step 1: Calculate factor scores (0-100 each)
  const demandScore = calculateDemandScore(product);
  const inventoryScore = calculateInventoryScore(product);
  const competitorScore = calculateCompetitorScore(product);
  const conversionScore = calculateConversionScore(product);
  const marginScore = calculateMarginScore(product);
  const seasonalityScore = calculateSeasonalityScore();

  // Step 2: Calculate weighted total
  const weightedTotal =
    demandScore * weights.demand +
    inventoryScore * weights.inventory +
    competitorScore * weights.competitor +
    conversionScore * weights.conversion +
    marginScore * weights.margin +
    seasonalityScore * weights.seasonality;

  // Step 3: Determine price direction and magnitude
  const elasticity = product.elasticity || constraints.defaultElasticity;
  const { suggestedPrice, direction, reason } = calculateSuggestedPrice(
    product,
    weightedTotal,
    elasticity
  );

  // Step 4: Apply constraints
  const { finalPrice, marginProtected, maxChangeApplied } = applyConstraints(
    product.currentPrice,
    suggestedPrice,
    product.costPrice,
    constraints
  );

  // Step 5: Calculate confidence score
  const confidenceScore = calculateConfidenceScore(
    product,
    weightedTotal,
    marginProtected,
    maxChangeApplied
  );

  // Step 6: Calculate price change percentage
  const priceChange = ((finalPrice - product.currentPrice) / product.currentPrice) * 100;

  // Determine final direction
  let finalDirection: "increase" | "decrease" | "maintain" = "maintain";
  if (priceChange > 1) finalDirection = "increase";
  else if (priceChange < -1) finalDirection = "decrease";

  return {
    productId: product.productId,
    variantId: product.variantId,
    currentPrice: product.currentPrice,
    suggestedPrice: Math.round(finalPrice * 100) / 100,
    priceChange: Math.round(priceChange * 10) / 10,
    direction: finalDirection,
    confidenceScore: Math.round(confidenceScore * 100) / 100,
    reason,
    factors: {
      demandScore: Math.round(demandScore),
      inventoryScore: Math.round(inventoryScore),
      competitorScore: Math.round(competitorScore),
      conversionScore: Math.round(conversionScore),
      marginScore: Math.round(marginScore),
      seasonalityScore: Math.round(seasonalityScore),
      weightedTotal: Math.round(weightedTotal),
    },
    constraints: {
      marginProtected,
      maxChangeApplied,
      originalSuggestion: Math.round(suggestedPrice * 100) / 100,
      finalSuggestion: Math.round(finalPrice * 100) / 100,
    },
  };
}

// ============================================================================
// FACTOR SCORING FUNCTIONS
// ============================================================================

/**
 * Demand Score: Based on views and sales velocity
 * High demand = high score = opportunity for price increase
 */
function calculateDemandScore(product: ProductPricingData): number {
  // Views component (0-50)
  const viewsScore = Math.min(50, (product.views7d || 0) / 20);

  // Sales velocity component (0-50)
  const dailySales = (product.sales7d || 0) / 7;
  const salesScore = Math.min(50, dailySales * 10);

  // Growth trend bonus (compare 7d to 30d average)
  const avg30d = (product.sales30d || 0) / 30;
  const growthMultiplier = avg30d > 0 ? Math.min(1.2, dailySales / avg30d) : 1;

  return (viewsScore + salesScore) * growthMultiplier;
}

/**
 * Inventory Score: Based on stock levels relative to sales velocity
 * High inventory + low sales = high score = need to lower price
 * Low inventory + high sales = low score = opportunity to increase price
 */
function calculateInventoryScore(product: ProductPricingData): number {
  const dailySales = (product.sales7d || 0) / 7;
  const daysOfStock = dailySales > 0
    ? product.inventoryQuantity / dailySales
    : product.inventoryQuantity;

  // Convert to 0-100 where:
  // 0-7 days = 0-20 (critical low)
  // 7-14 days = 20-40 (low)
  // 14-30 days = 40-60 (healthy)
  // 30-60 days = 60-80 (high)
  // 60+ days = 80-100 (overstocked)
  if (daysOfStock <= 7) return Math.round((daysOfStock / 7) * 20);
  if (daysOfStock <= 14) return Math.round(20 + ((daysOfStock - 7) / 7) * 20);
  if (daysOfStock <= 30) return Math.round(40 + ((daysOfStock - 14) / 16) * 20);
  if (daysOfStock <= 60) return Math.round(60 + ((daysOfStock - 30) / 30) * 20);
  return Math.min(100, Math.round(80 + ((daysOfStock - 60) / 60) * 20));
}

/**
 * Competitor Score: Based on position vs competitors
 * Above competitor avg = high score = should decrease
 * Below competitor avg = low score = opportunity to increase
 */
function calculateCompetitorScore(product: ProductPricingData): number {
  if (!product.competitorAvg) return 50; // Neutral if no competitor data

  const priceDiff = ((product.currentPrice - product.competitorAvg) / product.competitorAvg) * 100;

  // Convert to 0-100 where:
  // -30% or lower = 0 (well below competitors)
  // 0% = 50 (at competitor level)
  // +30% or higher = 100 (well above competitors)
  return Math.max(0, Math.min(100, 50 + (priceDiff / 0.6)));
}

/**
 * Conversion Score: Based on conversion rate
 * High conversion = low score = can increase price
 * Low conversion = high score = should decrease price
 */
function calculateConversionScore(product: ProductPricingData): number {
  const convRate = product.conversionRate * 100; // Convert to percentage

  // Industry average is ~2.5%
  // High (>5%) = opportunity to increase price (low score)
  // Low (<1%) = should decrease price (high score)
  if (convRate >= 5) return 20;
  if (convRate >= 3) return 40;
  if (convRate >= 2) return 50;
  if (convRate >= 1) return 70;
  return 90;
}

/**
 * Margin Score: Based on current profit margin
 * High margin = low score = can afford to decrease
 * Low margin = high score = need to protect
 */
function calculateMarginScore(product: ProductPricingData): number {
  if (!product.costPrice || product.costPrice <= 0) return 50; // Neutral if no cost data

  const margin = ((product.currentPrice - product.costPrice) / product.currentPrice) * 100;

  // Convert to 0-100 where:
  // <10% margin = 100 (critical - protect margin)
  // 10-20% margin = 70-80 (low margin)
  // 20-40% margin = 40-60 (healthy)
  // >40% margin = 20-30 (high margin - room to decrease)
  if (margin < 10) return 100;
  if (margin < 20) return 80;
  if (margin < 30) return 60;
  if (margin < 40) return 40;
  return 20;
}

/**
 * Seasonality Score: Based on time of year and historical data
 * Uses year-over-year comparison when historical data is available
 */
function calculateSeasonalityScore(historicalData?: SeasonalityData): number {
  const now = new Date();
  const month = now.getMonth();
  const dayOfWeek = now.getDay();

  // Base score from calendar
  let baseScore = 50;

  // Peak seasons (Nov-Dec for holidays, Jul-Aug for summer)
  const peakMonths = [6, 7, 10, 11];
  if (peakMonths.includes(month)) baseScore = 70;

  // Slow seasons (Jan-Feb, post-holiday)
  const slowMonths = [0, 1];
  if (slowMonths.includes(month)) baseScore = 30;

  // Weekend boost
  if (dayOfWeek === 0 || dayOfWeek === 6) baseScore += 5;

  // If we have historical data, adjust based on YoY trends
  if (historicalData) {
    const yoyMultiplier = calculateYoYMultiplier(historicalData);
    baseScore = Math.round(baseScore * yoyMultiplier);
  }

  return Math.max(0, Math.min(100, baseScore));
}

/**
 * Calculate Year-over-Year multiplier for seasonality adjustment
 */
function calculateYoYMultiplier(data: SeasonalityData): number {
  let multiplier = 1.0;

  // YoY comparison
  if (data.lastYearSamePeriodSales > 0) {
    const yoyGrowth = (data.currentPeriodSales - data.lastYearSamePeriodSales) / data.lastYearSamePeriodSales;

    // Cap the impact to ±30%
    const cappedGrowth = Math.max(-0.3, Math.min(0.3, yoyGrowth));
    multiplier += cappedGrowth * 0.5; // Apply 50% of the YoY change
  }

  // Compare to monthly average
  if (data.monthlyAverageSales > 0) {
    const vsAverage = (data.currentPeriodSales - data.monthlyAverageSales) / data.monthlyAverageSales;

    // If significantly above/below average, adjust
    if (vsAverage > 0.2) multiplier += 0.1;
    else if (vsAverage < -0.2) multiplier -= 0.1;
  }

  // Weekly trend momentum
  if (data.weeklyTrend > 0.1) multiplier += 0.05;
  else if (data.weeklyTrend < -0.1) multiplier -= 0.05;

  // Holiday period boost
  if (data.isHolidayPeriod) multiplier += 0.15;

  // Special event boost
  if (data.specialEvents && data.specialEvents.length > 0) {
    multiplier += 0.1 * Math.min(data.specialEvents.length, 2);
  }

  return Math.max(0.6, Math.min(1.5, multiplier));
}

/**
 * Detect if current date is within a holiday period
 */
export function detectHolidayPeriod(): { isHoliday: boolean; events: string[] } {
  const now = new Date();
  const month = now.getMonth();
  const day = now.getDate();
  const events: string[] = [];

  // Black Friday / Cyber Monday (last week of November)
  if (month === 10 && day >= 20 && day <= 30) {
    events.push("Black Friday", "Cyber Monday");
  }

  // Christmas shopping season (December 1-25)
  if (month === 11 && day <= 25) {
    events.push("Christmas Season");
  }

  // Valentine's Day (Feb 7-14)
  if (month === 1 && day >= 7 && day <= 14) {
    events.push("Valentine's Day");
  }

  // Mother's Day (May 1-15)
  if (month === 4 && day >= 1 && day <= 15) {
    events.push("Mother's Day");
  }

  // Back to School (Aug 1 - Sep 15)
  if ((month === 7) || (month === 8 && day <= 15)) {
    events.push("Back to School");
  }

  // Easter (March-April, simplified)
  if ((month === 2 && day >= 15) || (month === 3 && day <= 25)) {
    events.push("Easter Season");
  }

  return {
    isHoliday: events.length > 0,
    events,
  };
}

/**
 * Get seasonality data from analytics history
 */
export async function getSeasonalityDataForProduct(
  shopId: string,
  productId: string
): Promise<SeasonalityData | null> {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const oneYearAgoEnd = new Date(oneYearAgo.getTime() + 7 * 24 * 60 * 60 * 1000);

  try {
    // Get current week sales
    const currentWeekData = await prisma.productAnalyticsHistory.aggregate({
      where: {
        shopId,
        productId,
        date: { gte: oneWeekAgo, lte: now },
      },
      _sum: { unitsSold: true },
    });

    // Get last week sales (for weekly trend)
    const lastWeekData = await prisma.productAnalyticsHistory.aggregate({
      where: {
        shopId,
        productId,
        date: { gte: twoWeeksAgo, lt: oneWeekAgo },
      },
      _sum: { unitsSold: true },
    });

    // Get same period last year
    const lastYearData = await prisma.productAnalyticsHistory.aggregate({
      where: {
        shopId,
        productId,
        date: { gte: oneYearAgo, lte: oneYearAgoEnd },
      },
      _sum: { unitsSold: true },
    });

    // Get monthly average (last 30 days)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const monthlyData = await prisma.productAnalyticsHistory.aggregate({
      where: {
        shopId,
        productId,
        date: { gte: thirtyDaysAgo, lte: now },
      },
      _sum: { unitsSold: true },
      _count: true,
    });

    const currentPeriodSales = currentWeekData._sum.unitsSold || 0;
    const lastWeekSales = lastWeekData._sum.unitsSold || 0;
    const lastYearSamePeriodSales = lastYearData._sum.unitsSold || 0;
    const monthlySales = monthlyData._sum.unitsSold || 0;
    const daysWithData = monthlyData._count || 1;

    const weeklyTrend = lastWeekSales > 0
      ? (currentPeriodSales - lastWeekSales) / lastWeekSales
      : 0;

    const monthlyAverageSales = (monthlySales / daysWithData) * 7; // Weekly equivalent

    const { isHoliday, events } = detectHolidayPeriod();

    return {
      currentPeriodSales,
      lastYearSamePeriodSales,
      monthlyAverageSales,
      weeklyTrend,
      isHolidayPeriod: isHoliday,
      specialEvents: events,
    };
  } catch {
    return null;
  }
}

/**
 * Get aggregated seasonality data for a shop (all products)
 */
export async function getShopSeasonalityData(
  shopId: string
): Promise<SeasonalityData | null> {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const oneYearAgoEnd = new Date(oneYearAgo.getTime() + 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  try {
    const [currentWeek, lastWeek, lastYear, monthly] = await Promise.all([
      prisma.productAnalyticsHistory.aggregate({
        where: { shopId, date: { gte: oneWeekAgo, lte: now } },
        _sum: { unitsSold: true },
      }),
      prisma.productAnalyticsHistory.aggregate({
        where: { shopId, date: { gte: twoWeeksAgo, lt: oneWeekAgo } },
        _sum: { unitsSold: true },
      }),
      prisma.productAnalyticsHistory.aggregate({
        where: { shopId, date: { gte: oneYearAgo, lte: oneYearAgoEnd } },
        _sum: { unitsSold: true },
      }),
      prisma.productAnalyticsHistory.aggregate({
        where: { shopId, date: { gte: thirtyDaysAgo, lte: now } },
        _sum: { unitsSold: true },
        _count: true,
      }),
    ]);

    const currentPeriodSales = currentWeek._sum.unitsSold || 0;
    const lastWeekSales = lastWeek._sum.unitsSold || 0;
    const lastYearSamePeriodSales = lastYear._sum.unitsSold || 0;
    const monthlySales = monthly._sum.unitsSold || 0;
    const daysWithData = monthly._count || 1;

    const weeklyTrend = lastWeekSales > 0
      ? (currentPeriodSales - lastWeekSales) / lastWeekSales
      : 0;

    const monthlyAverageSales = (monthlySales / daysWithData) * 7;

    const { isHoliday, events } = detectHolidayPeriod();

    return {
      currentPeriodSales,
      lastYearSamePeriodSales,
      monthlyAverageSales,
      weeklyTrend,
      isHolidayPeriod: isHoliday,
      specialEvents: events,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// PRICE CALCULATION
// ============================================================================

/**
 * Calculate suggested price based on weighted score
 */
function calculateSuggestedPrice(
  product: ProductPricingData,
  weightedScore: number,
  elasticity: number
): { suggestedPrice: number; direction: "increase" | "decrease" | "maintain"; reason: string } {
  // Score interpretation:
  // 0-30: Strong signals to decrease price
  // 30-45: Moderate signals to decrease
  // 45-55: Maintain current price
  // 55-70: Moderate signals to increase
  // 70-100: Strong signals to increase price

  let priceMultiplier = 1;
  let direction: "increase" | "decrease" | "maintain" = "maintain";
  let reason = "Market conditions stable";

  if (weightedScore < 30) {
    // Strong decrease signal
    const decreasePercent = 0.05 + ((30 - weightedScore) / 30) * 0.15; // 5-20% decrease
    priceMultiplier = 1 - decreasePercent;
    direction = "decrease";
    reason = "Low demand and/or high inventory";
  } else if (weightedScore < 45) {
    // Moderate decrease signal
    const decreasePercent = 0.02 + ((45 - weightedScore) / 15) * 0.08; // 2-10% decrease
    priceMultiplier = 1 - decreasePercent;
    direction = "decrease";
    reason = "Slightly below optimal pricing";
  } else if (weightedScore > 70) {
    // Strong increase signal
    const increasePercent = 0.05 + ((weightedScore - 70) / 30) * 0.15; // 5-20% increase
    priceMultiplier = 1 + increasePercent;
    direction = "increase";
    reason = "High demand and/or low inventory";
  } else if (weightedScore > 55) {
    // Moderate increase signal
    const increasePercent = 0.02 + ((weightedScore - 55) / 15) * 0.08; // 2-10% increase
    priceMultiplier = 1 + increasePercent;
    direction = "increase";
    reason = "Room for price optimization";
  }

  // Apply elasticity adjustment
  // If elasticity is high (inelastic), we can be more aggressive
  const elasticityFactor = Math.min(1.5, Math.max(0.5, 1 + (Math.abs(elasticity) - 1.5) / 3));
  const adjustedMultiplier = 1 + (priceMultiplier - 1) * elasticityFactor;

  return {
    suggestedPrice: product.currentPrice * adjustedMultiplier,
    direction,
    reason,
  };
}

// ============================================================================
// CONSTRAINTS
// ============================================================================

/**
 * Apply constraints to ensure safe pricing
 */
function applyConstraints(
  currentPrice: number,
  suggestedPrice: number,
  costPrice: number | undefined,
  constraints: typeof DEFAULT_CONSTRAINTS
): { finalPrice: number; marginProtected: boolean; maxChangeApplied: boolean } {
  let finalPrice = suggestedPrice;
  let marginProtected = false;
  let maxChangeApplied = false;

  // 1. Apply margin protection
  if (costPrice && costPrice > 0) {
    const minPriceForMargin = costPrice / (1 - constraints.minMarginPercent / 100);
    if (finalPrice < minPriceForMargin) {
      finalPrice = minPriceForMargin;
      marginProtected = true;
    }
  }

  // 2. Apply max price change limits
  const maxIncrease = currentPrice * (1 + constraints.maxPriceIncrease / 100);
  const maxDecrease = currentPrice * (1 - constraints.maxPriceDecrease / 100);

  if (finalPrice > maxIncrease) {
    finalPrice = maxIncrease;
    maxChangeApplied = true;
  } else if (finalPrice < maxDecrease) {
    finalPrice = maxDecrease;
    maxChangeApplied = true;
  }

  // 3. Ensure price is never negative or zero
  finalPrice = Math.max(0.01, finalPrice);

  return { finalPrice, marginProtected, maxChangeApplied };
}

// ============================================================================
// CONFIDENCE SCORING
// ============================================================================

/**
 * Calculate confidence score based on data quality and signal strength
 */
function calculateConfidenceScore(
  product: ProductPricingData,
  weightedScore: number,
  marginProtected: boolean,
  maxChangeApplied: boolean
): number {
  let confidence = 0.5; // Base confidence

  // 1. Data completeness (0-0.2)
  let dataScore = 0;
  if (product.views7d > 0) dataScore += 0.04;
  if (product.views30d > 0) dataScore += 0.02;
  if (product.sales7d > 0) dataScore += 0.04;
  if (product.sales30d > 0) dataScore += 0.02;
  if (product.costPrice) dataScore += 0.04;
  if (product.competitorAvg) dataScore += 0.04;
  confidence += dataScore;

  // 2. Signal strength (0-0.2)
  // Stronger signals (further from 50) = higher confidence
  const signalStrength = Math.abs(weightedScore - 50) / 50;
  confidence += signalStrength * 0.2;

  // 3. Volume of data (0-0.1)
  const volumeScore = Math.min(0.1, (product.sales30d / 100) * 0.1);
  confidence += volumeScore;

  // 4. Penalties
  if (marginProtected) confidence -= 0.1; // Had to override for margin
  if (maxChangeApplied) confidence -= 0.05; // Had to cap the change

  // 5. Elasticity bonus (if calculated, not default)
  if (product.elasticity !== undefined) confidence += 0.05;

  // Ensure bounds [0.3, 0.99]
  return Math.max(0.3, Math.min(0.99, confidence));
}

// ============================================================================
// MODEL CONFIGURATION
// ============================================================================

/**
 * Get ML model config for shop (or create default)
 */
export async function getMLModelConfig(shopId: string): Promise<MLModelConfig | null> {
  return prisma.mLModelConfig.findUnique({
    where: { shopId },
  });
}

/**
 * Create or update ML model config
 */
export async function upsertMLModelConfig(
  shopId: string,
  config: Partial<{
    weightDemand: number;
    weightInventory: number;
    weightCompetitor: number;
    weightConversion: number;
    weightMargin: number;
    weightSeasonality: number;
    minMarginPercent: number;
    maxPriceIncrease: number;
    maxPriceDecrease: number;
    defaultElasticity: number;
    minConfidenceShow: number;
    minConfidenceApply: number;
    learningEnabled: boolean;
    learningRate: number;
  }>
): Promise<MLModelConfig> {
  return prisma.mLModelConfig.upsert({
    where: { shopId },
    update: {
      weightDemand: config.weightDemand !== undefined ? new Decimal(config.weightDemand) : undefined,
      weightInventory: config.weightInventory !== undefined ? new Decimal(config.weightInventory) : undefined,
      weightCompetitor: config.weightCompetitor !== undefined ? new Decimal(config.weightCompetitor) : undefined,
      weightConversion: config.weightConversion !== undefined ? new Decimal(config.weightConversion) : undefined,
      weightMargin: config.weightMargin !== undefined ? new Decimal(config.weightMargin) : undefined,
      weightSeasonality: config.weightSeasonality !== undefined ? new Decimal(config.weightSeasonality) : undefined,
      minMarginPercent: config.minMarginPercent !== undefined ? new Decimal(config.minMarginPercent) : undefined,
      maxPriceIncrease: config.maxPriceIncrease !== undefined ? new Decimal(config.maxPriceIncrease) : undefined,
      maxPriceDecrease: config.maxPriceDecrease !== undefined ? new Decimal(config.maxPriceDecrease) : undefined,
      defaultElasticity: config.defaultElasticity !== undefined ? new Decimal(config.defaultElasticity) : undefined,
      minConfidenceShow: config.minConfidenceShow !== undefined ? new Decimal(config.minConfidenceShow) : undefined,
      minConfidenceApply: config.minConfidenceApply !== undefined ? new Decimal(config.minConfidenceApply) : undefined,
      learningEnabled: config.learningEnabled,
      learningRate: config.learningRate !== undefined ? new Decimal(config.learningRate) : undefined,
    },
    create: {
      shopId,
      weightDemand: new Decimal(config.weightDemand ?? DEFAULT_WEIGHTS.demand),
      weightInventory: new Decimal(config.weightInventory ?? DEFAULT_WEIGHTS.inventory),
      weightCompetitor: new Decimal(config.weightCompetitor ?? DEFAULT_WEIGHTS.competitor),
      weightConversion: new Decimal(config.weightConversion ?? DEFAULT_WEIGHTS.conversion),
      weightMargin: new Decimal(config.weightMargin ?? DEFAULT_WEIGHTS.margin),
      weightSeasonality: new Decimal(config.weightSeasonality ?? DEFAULT_WEIGHTS.seasonality),
      minMarginPercent: new Decimal(config.minMarginPercent ?? DEFAULT_CONSTRAINTS.minMarginPercent),
      maxPriceIncrease: new Decimal(config.maxPriceIncrease ?? DEFAULT_CONSTRAINTS.maxPriceIncrease),
      maxPriceDecrease: new Decimal(config.maxPriceDecrease ?? DEFAULT_CONSTRAINTS.maxPriceDecrease),
      defaultElasticity: new Decimal(config.defaultElasticity ?? DEFAULT_CONSTRAINTS.defaultElasticity),
      minConfidenceShow: new Decimal(config.minConfidenceShow ?? 0.5),
      minConfidenceApply: new Decimal(config.minConfidenceApply ?? 0.85),
      learningEnabled: config.learningEnabled ?? true,
      learningRate: new Decimal(config.learningRate ?? 0.05),
    },
  });
}

/**
 * Extract weights from config
 */
function extractWeights(config: MLModelConfig | null): ModelWeights {
  if (!config) return DEFAULT_WEIGHTS;

  return {
    demand: Number(config.weightDemand),
    inventory: Number(config.weightInventory),
    competitor: Number(config.weightCompetitor),
    conversion: Number(config.weightConversion),
    margin: Number(config.weightMargin),
    seasonality: Number(config.weightSeasonality),
  };
}

/**
 * Extract constraints from config
 */
function extractConstraints(config: MLModelConfig | null) {
  if (!config) return DEFAULT_CONSTRAINTS;

  return {
    minMarginPercent: Number(config.minMarginPercent),
    maxPriceIncrease: Number(config.maxPriceIncrease),
    maxPriceDecrease: Number(config.maxPriceDecrease),
    defaultElasticity: Number(config.defaultElasticity),
  };
}
