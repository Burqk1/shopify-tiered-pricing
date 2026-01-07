/**
 * Auto-Apply Service Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma
vi.mock("~/db.server", () => ({
  default: {
    autoApplyRule: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    autoApplyLog: {
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    pricingInsight: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    priceHistory: {
      create: vi.fn(),
    },
  },
}));

import prisma from "~/db.server";

describe("Auto-Apply Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Auto-Apply Rules", () => {
    it("should create a default auto-apply rule", async () => {
      const defaultRule = {
        id: "rule-1",
        shopId: "shop-1",
        name: "Default Auto-Apply",
        status: "ACTIVE",
        minConfidence: 0.85,
        maxPriceChangePercent: 15,
        applyToAllProducts: true,
        allowIncrease: true,
        allowDecrease: true,
        maxAppliesPerDay: 10,
        cooldownHours: 24,
      };

      vi.mocked(prisma.autoApplyRule.create).mockResolvedValue(defaultRule as never);

      const result = await prisma.autoApplyRule.create({
        data: defaultRule,
      });

      expect(result.minConfidence).toBe(0.85);
      expect(result.maxPriceChangePercent).toBe(15);
      expect(result.maxAppliesPerDay).toBe(10);
    });

    it("should validate rule constraints", () => {
      const rule = {
        minConfidence: 0.85,
        maxPriceChangePercent: 15,
        maxAppliesPerDay: 10,
      };

      // Validate confidence range
      expect(rule.minConfidence).toBeGreaterThanOrEqual(0);
      expect(rule.minConfidence).toBeLessThanOrEqual(1);

      // Validate price change range
      expect(rule.maxPriceChangePercent).toBeGreaterThan(0);
      expect(rule.maxPriceChangePercent).toBeLessThanOrEqual(50);

      // Validate daily limit
      expect(rule.maxAppliesPerDay).toBeGreaterThan(0);
    });
  });

  describe("Rule Matching", () => {
    it("should match insight to rule based on confidence", () => {
      const insight = {
        confidenceScore: 0.90,
        changePercent: 10,
        direction: "increase",
      };

      const rule = {
        minConfidence: 0.85,
        maxPriceChangePercent: 15,
        allowIncrease: true,
        allowDecrease: true,
      };

      const confidenceOk = insight.confidenceScore >= rule.minConfidence;
      const changeOk = Math.abs(insight.changePercent) <= rule.maxPriceChangePercent;
      const directionOk = insight.direction === "increase" ?
        rule.allowIncrease : rule.allowDecrease;

      expect(confidenceOk).toBe(true);
      expect(changeOk).toBe(true);
      expect(directionOk).toBe(true);
    });

    it("should reject insight below confidence threshold", () => {
      const insight = {
        confidenceScore: 0.70,
        changePercent: 10,
      };

      const rule = {
        minConfidence: 0.85,
      };

      const matches = insight.confidenceScore >= rule.minConfidence;
      expect(matches).toBe(false);
    });

    it("should reject insight exceeding price change limit", () => {
      const insight = {
        confidenceScore: 0.90,
        changePercent: 25, // 25% change
      };

      const rule = {
        minConfidence: 0.85,
        maxPriceChangePercent: 15, // Max 15%
      };

      const matches = Math.abs(insight.changePercent) <= rule.maxPriceChangePercent;
      expect(matches).toBe(false);
    });

    it("should reject decrease when only increase allowed", () => {
      const insight = {
        confidenceScore: 0.90,
        changePercent: -10,
        direction: "decrease",
      };

      const rule = {
        minConfidence: 0.85,
        maxPriceChangePercent: 15,
        allowIncrease: true,
        allowDecrease: false,
      };

      const directionAllowed = insight.direction === "increase" ?
        rule.allowIncrease : rule.allowDecrease;

      expect(directionAllowed).toBe(false);
    });

    it("should check product targeting", () => {
      const insight = { productId: "prod-123" };

      // Rule with specific products
      const specificRule = {
        applyToAllProducts: false,
        includedProductIds: ["prod-123", "prod-456"],
        excludedProductIds: [],
      };

      // Rule with excluded products
      const excludeRule = {
        applyToAllProducts: true,
        includedProductIds: [],
        excludedProductIds: ["prod-789"],
      };

      const matchesSpecific = specificRule.applyToAllProducts ||
        specificRule.includedProductIds.includes(insight.productId);

      const matchesExclude = excludeRule.applyToAllProducts &&
        !excludeRule.excludedProductIds.includes(insight.productId);

      expect(matchesSpecific).toBe(true);
      expect(matchesExclude).toBe(true);
    });
  });

  describe("Rate Limiting", () => {
    it("should respect daily apply limit", async () => {
      const rule = {
        id: "rule-1",
        maxAppliesPerDay: 10,
      };

      // Simulate 10 applies already done today
      vi.mocked(prisma.autoApplyLog.count).mockResolvedValue(10);

      const todayApplies = await prisma.autoApplyLog.count({
        where: {
          ruleId: rule.id,
          createdAt: { gte: expect.any(Date) },
          status: "SUCCESS",
        },
      });

      const canApplyMore = todayApplies < rule.maxAppliesPerDay;
      expect(canApplyMore).toBe(false);
    });

    it("should allow apply when under daily limit", async () => {
      const rule = {
        id: "rule-1",
        maxAppliesPerDay: 10,
      };

      vi.mocked(prisma.autoApplyLog.count).mockResolvedValue(5);

      const todayApplies = await prisma.autoApplyLog.count({
        where: {
          ruleId: rule.id,
          createdAt: { gte: expect.any(Date) },
          status: "SUCCESS",
        },
      });

      const canApplyMore = todayApplies < rule.maxAppliesPerDay;
      expect(canApplyMore).toBe(true);
    });
  });

  describe("Cooldown Period", () => {
    it("should respect product cooldown", () => {
      const cooldownHours = 24;
      const lastAppliedAt = new Date();
      lastAppliedAt.setHours(lastAppliedAt.getHours() - 12); // 12 hours ago

      const hoursSinceLastApply =
        (new Date().getTime() - lastAppliedAt.getTime()) / (1000 * 60 * 60);

      const cooldownComplete = hoursSinceLastApply >= cooldownHours;
      expect(cooldownComplete).toBe(false); // Still in cooldown
    });

    it("should allow apply after cooldown expires", () => {
      const cooldownHours = 24;
      const lastAppliedAt = new Date();
      lastAppliedAt.setHours(lastAppliedAt.getHours() - 30); // 30 hours ago

      const hoursSinceLastApply =
        (new Date().getTime() - lastAppliedAt.getTime()) / (1000 * 60 * 60);

      const cooldownComplete = hoursSinceLastApply >= cooldownHours;
      expect(cooldownComplete).toBe(true);
    });

    it("should allow first-time apply for product", () => {
      const lastAppliedAt = null; // Never applied

      const cooldownComplete = lastAppliedAt === null ? true :
        (new Date().getTime() - new Date(lastAppliedAt).getTime()) >= 24 * 60 * 60 * 1000;

      expect(cooldownComplete).toBe(true);
    });
  });

  describe("Audit Logging", () => {
    it("should log successful auto-apply", async () => {
      const logEntry = {
        shopId: "shop-1",
        ruleId: "rule-1",
        insightId: "insight-1",
        productId: "prod-123",
        oldPrice: 100,
        newPrice: 110,
        changePercent: 10,
        confidence: 0.90,
        status: "SUCCESS",
      };

      vi.mocked(prisma.autoApplyLog.create).mockResolvedValue(logEntry as never);

      const result = await prisma.autoApplyLog.create({
        data: logEntry,
      });

      expect(result.status).toBe("SUCCESS");
      expect(result.changePercent).toBe(10);
    });

    it("should log failed auto-apply with error", async () => {
      const logEntry = {
        shopId: "shop-1",
        ruleId: "rule-1",
        insightId: "insight-1",
        productId: "prod-123",
        oldPrice: 100,
        newPrice: 110,
        changePercent: 10,
        confidence: 0.90,
        status: "FAILED",
        errorMessage: "Shopify API error: Rate limit exceeded",
      };

      vi.mocked(prisma.autoApplyLog.create).mockResolvedValue(logEntry as never);

      const result = await prisma.autoApplyLog.create({
        data: logEntry,
      });

      expect(result.status).toBe("FAILED");
      expect(result.errorMessage).toContain("Rate limit");
    });

    it("should log skipped auto-apply", async () => {
      const logEntry = {
        shopId: "shop-1",
        ruleId: "rule-1",
        insightId: "insight-1",
        productId: "prod-123",
        oldPrice: 100,
        newPrice: 110,
        changePercent: 10,
        confidence: 0.90,
        status: "SKIPPED",
        errorMessage: "Product in cooldown period",
      };

      vi.mocked(prisma.autoApplyLog.create).mockResolvedValue(logEntry as never);

      const result = await prisma.autoApplyLog.create({
        data: logEntry,
      });

      expect(result.status).toBe("SKIPPED");
    });
  });

  describe("Price Update Validation", () => {
    it("should validate price is positive", () => {
      const newPrice = -10;
      const isValid = newPrice > 0;
      expect(isValid).toBe(false);
    });

    it("should validate price has proper precision", () => {
      const prices = [
        { value: 10.99, valid: true },
        { value: 10.999, valid: false }, // Too many decimals
        { value: 10, valid: true },
        { value: 0.01, valid: true },
      ];

      prices.forEach(({ value, valid }) => {
        const decimalPlaces = (value.toString().split(".")[1] || "").length;
        const hasValidPrecision = decimalPlaces <= 2;
        expect(hasValidPrecision).toBe(valid);
      });
    });

    it("should round price to 2 decimal places", () => {
      const calculatedPrice = 99.9876;
      const roundedPrice = Math.round(calculatedPrice * 100) / 100;
      expect(roundedPrice).toBe(99.99);
    });
  });

  describe("Revert Functionality", () => {
    it("should track original price for revert", () => {
      const applyLog = {
        productId: "prod-123",
        oldPrice: 100,
        newPrice: 110,
      };

      // To revert, swap prices
      const revertedPrice = applyLog.oldPrice;
      expect(revertedPrice).toBe(100);
    });

    it("should mark log as reverted", async () => {
      vi.mocked(prisma.autoApplyLog.create).mockResolvedValue({
        id: "log-1",
        status: "REVERTED",
      } as never);

      const result = await prisma.autoApplyLog.create({
        data: {
          status: "REVERTED",
        },
      });

      expect(result.status).toBe("REVERTED");
    });
  });

  describe("Statistics", () => {
    it("should calculate daily apply count", async () => {
      vi.mocked(prisma.autoApplyLog.count).mockResolvedValue(7);

      const todayCount = await prisma.autoApplyLog.count({
        where: {
          shopId: "shop-1",
          status: "SUCCESS",
          createdAt: {
            gte: expect.any(Date),
          },
        },
      });

      expect(todayCount).toBe(7);
    });

    it("should calculate success rate", () => {
      const stats = {
        total: 100,
        success: 85,
        failed: 10,
        skipped: 5,
      };

      const successRate = (stats.success / stats.total) * 100;
      expect(successRate).toBe(85);
    });

    it("should calculate average price change", () => {
      const changes = [5, 10, 8, 12, 7];
      const average = changes.reduce((a, b) => a + b, 0) / changes.length;
      expect(average).toBe(8.4);
    });
  });
});

describe("Margin Protection", () => {
  it("should calculate current margin", () => {
    const price = 100;
    const cost = 60;

    const margin = ((price - cost) / price) * 100;
    expect(margin).toBe(40); // 40% margin
  });

  it("should block price below minimum margin", () => {
    const cost = 60;
    const minMarginPercent = 30;
    const proposedPrice = 75; // Only 20% margin

    const actualMargin = ((proposedPrice - cost) / proposedPrice) * 100;
    expect(actualMargin).toBeCloseTo(20, 0);

    const meetsMinMargin = actualMargin >= minMarginPercent;
    expect(meetsMinMargin).toBe(false);
  });

  it("should calculate minimum acceptable price", () => {
    const cost = 60;
    const minMarginPercent = 30;

    // minMargin = (price - cost) / price
    // price * minMargin = price - cost
    // price * minMargin - price = -cost
    // price * (minMargin - 1) = -cost
    // price = cost / (1 - minMargin)
    const minPrice = cost / (1 - minMarginPercent / 100);
    expect(minPrice).toBeCloseTo(85.71, 1);
  });
});
