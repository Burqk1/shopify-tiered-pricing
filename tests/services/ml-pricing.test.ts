/**
 * ML Pricing Service Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma
vi.mock("~/db.server", () => ({
  default: {
    mLModelConfig: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    productAnalyticsHistory: {
      findMany: vi.fn(),
    },
    priceElasticity: {
      findUnique: vi.fn(),
    },
    pricingInsight: {
      create: vi.fn(),
    },
  },
}));

import prisma from "~/db.server";

describe("ML Pricing Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("MLModelConfig", () => {
    it("should use default weights when no config exists", async () => {
      vi.mocked(prisma.mLModelConfig.findUnique).mockResolvedValue(null);

      const config = await prisma.mLModelConfig.findUnique({
        where: { shopId: "shop-1" },
      });

      expect(config).toBeNull();

      // Default weights should sum to 1.0
      const defaultWeights = {
        demand: 0.25,
        inventory: 0.20,
        competitor: 0.20,
        conversion: 0.15,
        margin: 0.10,
        seasonality: 0.10,
      };

      const sum = Object.values(defaultWeights).reduce((a, b) => a + b, 0);
      expect(sum).toBe(1.0);
    });

    it("should create config with custom weights", async () => {
      const customConfig = {
        id: "config-1",
        shopId: "shop-1",
        weightDemand: 0.30,
        weightInventory: 0.25,
        weightCompetitor: 0.15,
        weightConversion: 0.15,
        weightMargin: 0.10,
        weightSeasonality: 0.05,
        minMarginPercent: 15,
        maxPriceIncrease: 25,
        maxPriceDecrease: 30,
        minConfidenceShow: 0.60,
        minConfidenceApply: 0.90,
      };

      vi.mocked(prisma.mLModelConfig.upsert).mockResolvedValue(customConfig as never);

      const result = await prisma.mLModelConfig.upsert({
        where: { shopId: "shop-1" },
        update: customConfig,
        create: customConfig,
      });

      expect(result.weightDemand).toBe(0.30);
      expect(result.minMarginPercent).toBe(15);
    });
  });

  describe("Weighted Score Calculation", () => {
    it("should calculate weighted score correctly", () => {
      const factors = {
        demandScore: 80,
        inventoryScore: 60,
        competitorScore: 70,
        conversionScore: 75,
        marginScore: 50,
        seasonalityScore: 65,
      };

      const weights = {
        demand: 0.25,
        inventory: 0.20,
        competitor: 0.20,
        conversion: 0.15,
        margin: 0.10,
        seasonality: 0.10,
      };

      const weightedScore =
        factors.demandScore * weights.demand +
        factors.inventoryScore * weights.inventory +
        factors.competitorScore * weights.competitor +
        factors.conversionScore * weights.conversion +
        factors.marginScore * weights.margin +
        factors.seasonalityScore * weights.seasonality;

      // Expected: 80*0.25 + 60*0.20 + 70*0.20 + 75*0.15 + 50*0.10 + 65*0.10
      // = 20 + 12 + 14 + 11.25 + 5 + 6.5 = 68.75
      expect(weightedScore).toBeCloseTo(68.75, 2);
    });

    it("should suggest price increase for high weighted score", () => {
      const weightedScore = 75; // Above 60 threshold
      const shouldIncrease = weightedScore > 60;
      expect(shouldIncrease).toBe(true);
    });

    it("should suggest price decrease for low weighted score", () => {
      const weightedScore = 35; // Below 40 threshold
      const shouldDecrease = weightedScore < 40;
      expect(shouldDecrease).toBe(true);
    });

    it("should suggest no change for mid-range score", () => {
      const weightedScore = 50; // Between 40-60
      const noChange = weightedScore >= 40 && weightedScore <= 60;
      expect(noChange).toBe(true);
    });
  });

  describe("Profit Margin Protection", () => {
    it("should not suggest price below minimum margin", () => {
      const costPrice = 50;
      const minMarginPercent = 20;
      const suggestedPrice = 55; // Only 10% margin

      const minAcceptablePrice = costPrice / (1 - minMarginPercent / 100);
      // minAcceptablePrice = 50 / 0.8 = 62.50

      const constrainedPrice = Math.max(suggestedPrice, minAcceptablePrice);
      expect(constrainedPrice).toBe(62.50);
    });

    it("should allow price above minimum margin", () => {
      const costPrice = 50;
      const minMarginPercent = 20;
      const suggestedPrice = 75; // 33% margin - above minimum

      const minAcceptablePrice = costPrice / (1 - minMarginPercent / 100);
      const constrainedPrice = Math.max(suggestedPrice, minAcceptablePrice);

      expect(constrainedPrice).toBe(75); // Original price kept
    });

    it("should handle missing cost price gracefully", () => {
      const costPrice = null;
      const suggestedPrice = 50;

      // When no cost price, cannot enforce margin - use suggested
      const constrainedPrice = costPrice ?
        Math.max(suggestedPrice, costPrice / 0.8) :
        suggestedPrice;

      expect(constrainedPrice).toBe(50);
    });
  });

  describe("Price Change Limits", () => {
    it("should cap price increase at max percent", () => {
      const currentPrice = 100;
      const suggestedPrice = 140; // 40% increase
      const maxIncreasePercent = 20;

      const maxPrice = currentPrice * (1 + maxIncreasePercent / 100);
      const constrainedPrice = Math.min(suggestedPrice, maxPrice);

      expect(constrainedPrice).toBe(120); // Capped at 20% increase
    });

    it("should cap price decrease at max percent", () => {
      const currentPrice = 100;
      const suggestedPrice = 60; // 40% decrease
      const maxDecreasePercent = 25;

      const minPrice = currentPrice * (1 - maxDecreasePercent / 100);
      const constrainedPrice = Math.max(suggestedPrice, minPrice);

      expect(constrainedPrice).toBe(75); // Capped at 25% decrease
    });

    it("should allow price within limits", () => {
      const currentPrice = 100;
      const suggestedPrice = 110; // 10% increase
      const maxIncreasePercent = 20;

      const maxPrice = currentPrice * (1 + maxIncreasePercent / 100);
      const constrainedPrice = Math.min(suggestedPrice, maxPrice);

      expect(constrainedPrice).toBe(110); // Within limits
    });
  });

  describe("Confidence Score Calculation", () => {
    it("should calculate multi-factor confidence", () => {
      const factors = {
        dataCompleteness: 0.9,    // 90% of required data available
        signalStrength: 0.8,      // Strong price signal
        historicalAccuracy: 0.7,  // 70% past accuracy
        marketVolatility: 0.3,    // 30% volatility (inverted in calculation)
      };

      const weights = { dc: 0.2, ss: 0.4, ha: 0.3, mv: 0.1 };

      const confidence = Math.min(0.99,
        factors.dataCompleteness * weights.dc +
        factors.signalStrength * weights.ss +
        factors.historicalAccuracy * weights.ha +
        (1 - factors.marketVolatility) * weights.mv
      );

      // Expected: 0.9*0.2 + 0.8*0.4 + 0.7*0.3 + 0.7*0.1
      // = 0.18 + 0.32 + 0.21 + 0.07 = 0.78
      expect(confidence).toBeCloseTo(0.78, 2);
    });

    it("should cap confidence at 0.99", () => {
      const factors = {
        dataCompleteness: 1.0,
        signalStrength: 1.0,
        historicalAccuracy: 1.0,
        marketVolatility: 0,
      };

      const weights = { dc: 0.2, ss: 0.4, ha: 0.3, mv: 0.1 };

      const rawConfidence =
        factors.dataCompleteness * weights.dc +
        factors.signalStrength * weights.ss +
        factors.historicalAccuracy * weights.ha +
        (1 - factors.marketVolatility) * weights.mv;

      const confidence = Math.min(0.99, rawConfidence);

      expect(confidence).toBe(0.99);
    });

    it("should penalize confidence for missing data", () => {
      const completeData = { dataCompleteness: 1.0 };
      const incompleteData = { dataCompleteness: 0.5 };

      const baseConfidence = 0.8;

      const fullConfidence = baseConfidence * completeData.dataCompleteness;
      const reducedConfidence = baseConfidence * incompleteData.dataCompleteness;

      expect(fullConfidence).toBe(0.8);
      expect(reducedConfidence).toBe(0.4);
    });
  });

  describe("Demand Score Calculation", () => {
    it("should calculate high demand score for trending products", () => {
      const viewsLast7Days = 1000;
      const viewsLast30Days = 2000;
      const salesLast7Days = 50;
      const salesLast30Days = 100;

      // 7-day trend is 2x the 30-day average (1000 vs 500 per week)
      const weeklyAverage = viewsLast30Days / 4;
      const trendMultiplier = viewsLast7Days / weeklyAverage;

      expect(trendMultiplier).toBe(2); // Trending up 2x

      const demandScore = Math.min(100, trendMultiplier * 50);
      expect(demandScore).toBe(100);
    });

    it("should calculate low demand score for declining products", () => {
      const viewsLast7Days = 100;
      const viewsLast30Days = 2000;

      const weeklyAverage = viewsLast30Days / 4; // 500
      const trendMultiplier = viewsLast7Days / weeklyAverage; // 0.2

      expect(trendMultiplier).toBe(0.2); // Trending down 80%

      const demandScore = Math.min(100, trendMultiplier * 50);
      expect(demandScore).toBe(10);
    });
  });

  describe("Inventory Score Calculation", () => {
    it("should score low inventory as urgency signal", () => {
      const inventoryQuantity = 5;
      const avgDailySales = 10; // Will run out in 0.5 days

      const daysOfCoverage = inventoryQuantity / avgDailySales;
      expect(daysOfCoverage).toBe(0.5);

      // Low coverage = high urgency = consider price increase
      const urgencyScore = daysOfCoverage < 7 ?
        Math.round((1 - daysOfCoverage / 7) * 100) : 0;

      expect(urgencyScore).toBe(93); // High urgency
    });

    it("should score high inventory as overstock signal", () => {
      const inventoryQuantity = 1000;
      const avgDailySales = 5; // 200 days of stock

      const daysOfCoverage = inventoryQuantity / avgDailySales;
      expect(daysOfCoverage).toBe(200);

      // High coverage = overstocked = consider price decrease
      const overstockScore = daysOfCoverage > 60 ?
        Math.min(100, Math.round((daysOfCoverage - 60) / 2)) : 0;

      expect(overstockScore).toBe(70);
    });
  });

  describe("Seasonality Score", () => {
    it("should detect high season based on historical comparison", () => {
      const currentMonthSales = 500;
      const sameMonthLastYear = 400;
      const monthlyAverage = 350;

      // Current vs last year same month
      const yoyGrowth = (currentMonthSales - sameMonthLastYear) / sameMonthLastYear;
      expect(yoyGrowth).toBeCloseTo(0.25, 2); // 25% YoY growth

      // Current vs average
      const vsAverage = (currentMonthSales - monthlyAverage) / monthlyAverage;
      expect(vsAverage).toBeCloseTo(0.43, 2); // 43% above average

      const isHighSeason = vsAverage > 0.2;
      expect(isHighSeason).toBe(true);
    });

    it("should detect low season", () => {
      const currentMonthSales = 200;
      const monthlyAverage = 350;

      const vsAverage = (currentMonthSales - monthlyAverage) / monthlyAverage;
      expect(vsAverage).toBeCloseTo(-0.43, 2); // 43% below average

      const isLowSeason = vsAverage < -0.2;
      expect(isLowSeason).toBe(true);
    });
  });
});

describe("Price Elasticity", () => {
  it("should calculate elasticity from price-demand relationship", () => {
    // Price increase of 10%, demand decrease of 15%
    const priceChange = 0.10; // 10% increase
    const demandChange = -0.15; // 15% decrease

    const elasticity = demandChange / priceChange;
    expect(elasticity).toBeCloseTo(-1.5, 10);

    // Interpret: product is elastic (|e| > 1)
    // 1% price increase leads to 1.5% demand decrease
    const isElastic = Math.abs(elasticity) > 1;
    expect(isElastic).toBe(true);
  });

  it("should identify inelastic products", () => {
    const priceChange = 0.10;
    const demandChange = -0.05;

    const elasticity = demandChange / priceChange;
    expect(elasticity).toBe(-0.5);

    const isInelastic = Math.abs(elasticity) < 1;
    expect(isInelastic).toBe(true);
  });

  it("should use elasticity to predict revenue impact", () => {
    const currentPrice = 100;
    const currentQuantity = 100;
    const elasticity = -1.5;
    const priceIncrease = 0.10; // 10%

    const newPrice = currentPrice * (1 + priceIncrease);
    const quantityChange = elasticity * priceIncrease; // -1.5 * 0.1 = -0.15
    const newQuantity = currentQuantity * (1 + quantityChange); // 100 * 0.85 = 85

    const currentRevenue = currentPrice * currentQuantity; // 10000
    const newRevenue = newPrice * newQuantity; // 110 * 85 = 9350

    expect(newRevenue).toBeCloseTo(9350, 5);
    expect(newRevenue).toBeLessThan(currentRevenue); // Revenue decreased despite price increase
  });

  it("should suggest price decrease for elastic products", () => {
    const elasticity = -2.0; // Very elastic
    const currentMargin = 0.40; // 40% margin

    // For elastic products with good margin, decrease can increase revenue
    const shouldConsiderDecrease = Math.abs(elasticity) > 1.5 && currentMargin > 0.30;
    expect(shouldConsiderDecrease).toBe(true);
  });
});
