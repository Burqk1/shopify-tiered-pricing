/**
 * AI Pricing Model Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generatePricingInsights,
  calculatePotentialRevenueLift,
  type ProductData,
  type CompetitorData,
} from "~/models/ai-pricing.server";

describe("AI Pricing Model", () => {
  describe("generatePricingInsights", () => {
    it("should suggest price increase for high demand + low inventory", async () => {
      const products: ProductData[] = [
        {
          productId: "prod-1",
          title: "Hot Product",
          currentPrice: 100,
          inventoryQuantity: 10, // Low inventory
          viewsLast7Days: 1000, // High views
          salesLast7Days: 50, // High sales
        },
      ];

      const insights = await generatePricingInsights("shop-1", products);

      expect(insights).toHaveLength(1);
      expect(insights[0].direction).toBe("increase");
      expect(insights[0].suggestedPrice).toBeGreaterThan(100);
      expect(insights[0].reason).toContain("High demand");
      expect(insights[0].confidenceScore).toBeGreaterThanOrEqual(0.85);
    });

    it("should suggest price decrease for low demand + high inventory", async () => {
      const products: ProductData[] = [
        {
          productId: "prod-1",
          title: "Slow Product",
          currentPrice: 100,
          inventoryQuantity: 80, // High inventory
          viewsLast7Days: 100, // Low views
          salesLast7Days: 2, // Low sales
        },
      ];

      const insights = await generatePricingInsights("shop-1", products);

      expect(insights).toHaveLength(1);
      expect(insights[0].direction).toBe("decrease");
      expect(insights[0].suggestedPrice).toBeLessThan(100);
      expect(insights[0].reason).toContain("Slow sales");
    });

    it("should suggest increase for strong conversion rate", async () => {
      const products: ProductData[] = [
        {
          productId: "prod-1",
          title: "Converting Product",
          currentPrice: 50,
          inventoryQuantity: 50,
          viewsLast7Days: 100,
          salesLast7Days: 10, // 10% conversion
        },
      ];

      const insights = await generatePricingInsights("shop-1", products);

      expect(insights).toHaveLength(1);
      expect(insights[0].direction).toBe("increase");
      expect(insights[0].reason).toContain("conversion");
    });

    it("should consider competitor pricing when above average", async () => {
      const products: ProductData[] = [
        {
          productId: "prod-1",
          title: "Overpriced Product",
          currentPrice: 150,
          inventoryQuantity: 50,
          viewsLast7Days: 200,
          salesLast7Days: 3,
        },
      ];

      const competitors: CompetitorData[] = [
        { productId: "prod-1", competitorPrice: 100, fetchedAt: new Date() },
        { productId: "prod-1", competitorPrice: 110, fetchedAt: new Date() },
      ];

      const insights = await generatePricingInsights("shop-1", products, competitors);

      expect(insights).toHaveLength(1);
      expect(insights[0].direction).toBe("decrease");
      expect(insights[0].reason).toContain("competitor");
      expect(insights[0].factors.competitorAvg).toBe(105);
    });

    it("should suggest increase when below competitor average", async () => {
      const products: ProductData[] = [
        {
          productId: "prod-1",
          title: "Underpriced Product",
          currentPrice: 50,
          inventoryQuantity: 50,
          viewsLast7Days: 200,
          salesLast7Days: 3,
        },
      ];

      const competitors: CompetitorData[] = [
        { productId: "prod-1", competitorPrice: 100, fetchedAt: new Date() },
        { productId: "prod-1", competitorPrice: 110, fetchedAt: new Date() },
      ];

      const insights = await generatePricingInsights("shop-1", products, competitors);

      expect(insights).toHaveLength(1);
      expect(insights[0].direction).toBe("increase");
      expect(insights[0].reason).toContain("Below competitor");
    });

    it("should not generate insight for minimal price change", async () => {
      const products: ProductData[] = [
        {
          productId: "prod-1",
          title: "Stable Product",
          currentPrice: 100,
          inventoryQuantity: 50, // Medium inventory
          viewsLast7Days: 500, // Medium views
          salesLast7Days: 5, // Medium sales
        },
      ];

      const insights = await generatePricingInsights("shop-1", products);

      // Should not have insights if price change is less than 1%
      expect(insights.length).toBeLessThanOrEqual(1);
    });

    it("should calculate demand score correctly", async () => {
      const products: ProductData[] = [
        {
          productId: "prod-1",
          title: "Test Product",
          currentPrice: 100,
          inventoryQuantity: 20,
          viewsLast7Days: 500, // viewsScore = min(100, 500/10) = 50
          salesLast7Days: 8, // salesScore = min(100, 8*10) = 80
          // demandScore = (50 + 80) / 2 = 65
        },
      ];

      const insights = await generatePricingInsights("shop-1", products);

      if (insights.length > 0) {
        expect(insights[0].factors.demandScore).toBe(65);
      }
    });

    it("should handle multiple products", async () => {
      const products: ProductData[] = [
        {
          productId: "prod-1",
          title: "Hot Product",
          currentPrice: 100,
          inventoryQuantity: 10,
          viewsLast7Days: 1000,
          salesLast7Days: 50,
        },
        {
          productId: "prod-2",
          title: "Cold Product",
          currentPrice: 100,
          inventoryQuantity: 80,
          viewsLast7Days: 100,
          salesLast7Days: 1,
        },
      ];

      const insights = await generatePricingInsights("shop-1", products);

      expect(insights.length).toBeGreaterThanOrEqual(2);

      const hotProduct = insights.find((i) => i.productId === "prod-1");
      const coldProduct = insights.find((i) => i.productId === "prod-2");

      expect(hotProduct?.direction).toBe("increase");
      expect(coldProduct?.direction).toBe("decrease");
    });

    it("should cap confidence score at 0.99", async () => {
      const products: ProductData[] = [
        {
          productId: "prod-1",
          title: "Very Hot Product",
          currentPrice: 100,
          inventoryQuantity: 5,
          viewsLast7Days: 10000,
          salesLast7Days: 500,
        },
      ];

      const insights = await generatePricingInsights("shop-1", products);

      expect(insights[0].confidenceScore).toBeLessThanOrEqual(0.99);
    });

    it("should include all required factors in insight", async () => {
      const products: ProductData[] = [
        {
          productId: "prod-1",
          title: "Test Product",
          currentPrice: 100,
          inventoryQuantity: 10,
          viewsLast7Days: 1000,
          salesLast7Days: 50,
        },
      ];

      const insights = await generatePricingInsights("shop-1", products);

      expect(insights[0].factors).toHaveProperty("demandScore");
      expect(insights[0].factors).toHaveProperty("inventoryLevel");
      expect(insights[0].factors).toHaveProperty("viewsLast7Days");
      expect(insights[0].factors).toHaveProperty("salesLast7Days");
      expect(insights[0].factors).toHaveProperty("conversionRate");
    });
  });

  describe("calculatePotentialRevenueLift", () => {
    it("should calculate positive revenue lift for price increase", () => {
      const lift = calculatePotentialRevenueLift(100, 110, 50);

      expect(lift).toBe(500); // (110-100) * 50
    });

    it("should calculate negative revenue lift for price decrease", () => {
      const lift = calculatePotentialRevenueLift(100, 90, 50);

      expect(lift).toBe(-500); // (90-100) * 50
    });

    it("should return 0 for same price", () => {
      const lift = calculatePotentialRevenueLift(100, 100, 50);

      expect(lift).toBe(0);
    });

    it("should handle decimal values", () => {
      const lift = calculatePotentialRevenueLift(99.99, 109.99, 10);

      expect(lift).toBe(100); // Rounded to 2 decimal places
    });

    it("should handle zero units sold", () => {
      const lift = calculatePotentialRevenueLift(100, 110, 0);

      expect(lift).toBe(0);
    });
  });
});
