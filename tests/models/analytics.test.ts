/**
 * Analytics Model Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma
vi.mock("~/db.server", () => ({
  default: {
    discountUsage: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import prisma from "~/db.server";
import {
  recordDiscountUsage,
  getAnalyticsSummary,
  getRuleAnalytics,
  exportAnalyticsCSV,
  getAnalyticsSummaryCSV,
} from "~/models/analytics.server";

describe("Analytics Model", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("recordDiscountUsage", () => {
    it("should record a discount usage event", async () => {
      const mockUsage = { id: "usage-1" };
      vi.mocked(prisma.discountUsage.create).mockResolvedValue(mockUsage as never);

      await recordDiscountUsage({
        shopId: "shop-1",
        ruleId: "rule-1",
        orderId: "order-1",
        orderNumber: "1001",
        discountType: "TIERED",
        originalPrice: 100,
        discountedPrice: 90,
        discountAmount: 10,
        discountPercent: 10,
        quantity: 5,
        productId: "prod-1",
        productTitle: "T-Shirt",
      });

      expect(prisma.discountUsage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          shopId: "shop-1",
          ruleId: "rule-1",
          orderId: "order-1",
          orderNumber: "1001",
          discountType: "TIERED",
          originalPrice: 100,
          discountedPrice: 90,
          discountAmount: 10,
          discountPercent: 10,
          quantity: 5,
        }),
      });
    });

    it("should use default currency USD", async () => {
      vi.mocked(prisma.discountUsage.create).mockResolvedValue({ id: "usage-1" } as never);

      await recordDiscountUsage({
        shopId: "shop-1",
        orderId: "order-1",
        orderNumber: "1001",
        discountType: "TIERED",
        originalPrice: 100,
        discountedPrice: 90,
        discountAmount: 10,
        discountPercent: 10,
        quantity: 5,
      });

      expect(prisma.discountUsage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          currency: "USD",
        }),
      });
    });

    it("should support bundle discount type", async () => {
      vi.mocked(prisma.discountUsage.create).mockResolvedValue({ id: "usage-1" } as never);

      await recordDiscountUsage({
        shopId: "shop-1",
        bundleId: "bundle-1",
        orderId: "order-1",
        orderNumber: "1001",
        discountType: "BUNDLE",
        originalPrice: 200,
        discountedPrice: 170,
        discountAmount: 30,
        discountPercent: 15,
        quantity: 2,
      });

      expect(prisma.discountUsage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          bundleId: "bundle-1",
          discountType: "BUNDLE",
        }),
      });
    });
  });

  describe("getAnalyticsSummary", () => {
    it("should calculate correct totals", async () => {
      const mockUsages = [
        {
          id: "u1",
          orderId: "o1",
          ruleId: "r1",
          discountedPrice: 90,
          discountAmount: 10,
          originalPrice: 100,
          discountPercent: 10,
          tierApplied: "Tier 1",
          productId: "p1",
          productTitle: "Product 1",
          quantity: 5,
          createdAt: new Date(),
        },
        {
          id: "u2",
          orderId: "o2",
          ruleId: "r1",
          discountedPrice: 170,
          discountAmount: 30,
          originalPrice: 200,
          discountPercent: 15,
          tierApplied: "Tier 2",
          productId: "p2",
          productTitle: "Product 2",
          quantity: 10,
          createdAt: new Date(),
        },
      ];

      vi.mocked(prisma.discountUsage.findMany).mockResolvedValue(mockUsages as never);

      const result = await getAnalyticsSummary("shop-1", 30);

      expect(result.summary.totalOrders).toBe(2);
      expect(result.summary.totalRevenue).toBe(260); // 90 + 170
      expect(result.summary.totalDiscount).toBe(40); // 10 + 30
      expect(result.summary.averageDiscount).toBe(12.5); // (10 + 15) / 2
    });

    it("should handle empty data", async () => {
      vi.mocked(prisma.discountUsage.findMany).mockResolvedValue([]);

      const result = await getAnalyticsSummary("shop-1", 30);

      expect(result.summary.totalOrders).toBe(0);
      expect(result.summary.totalRevenue).toBe(0);
      expect(result.summary.averageDiscount).toBe(0);
      expect(result.dailyStats).toHaveLength(0);
      expect(result.topProducts).toHaveLength(0);
    });

    it("should group by rule correctly", async () => {
      const mockUsages = [
        { id: "u1", orderId: "o1", ruleId: "r1", discountedPrice: 90, discountAmount: 10, originalPrice: 100, discountPercent: 10, createdAt: new Date() },
        { id: "u2", orderId: "o2", ruleId: "r1", discountedPrice: 80, discountAmount: 20, originalPrice: 100, discountPercent: 20, createdAt: new Date() },
        { id: "u3", orderId: "o3", ruleId: "r2", discountedPrice: 70, discountAmount: 30, originalPrice: 100, discountPercent: 30, createdAt: new Date() },
      ];

      vi.mocked(prisma.discountUsage.findMany).mockResolvedValue(mockUsages as never);

      const result = await getAnalyticsSummary("shop-1", 30);

      expect(result.byRule).toHaveLength(2);
      const rule1 = result.byRule.find((r) => r.ruleId === "r1");
      expect(rule1?.count).toBe(2);
      expect(rule1?.revenue).toBe(170); // 90 + 80
    });

    it("should group by tier correctly", async () => {
      const mockUsages = [
        { id: "u1", orderId: "o1", tierApplied: "5-9 items", discountedPrice: 90, discountAmount: 10, originalPrice: 100, discountPercent: 10, createdAt: new Date() },
        { id: "u2", orderId: "o2", tierApplied: "10+ items", discountedPrice: 80, discountAmount: 20, originalPrice: 100, discountPercent: 20, createdAt: new Date() },
        { id: "u3", orderId: "o3", tierApplied: "5-9 items", discountedPrice: 85, discountAmount: 15, originalPrice: 100, discountPercent: 15, createdAt: new Date() },
      ];

      vi.mocked(prisma.discountUsage.findMany).mockResolvedValue(mockUsages as never);

      const result = await getAnalyticsSummary("shop-1", 30);

      expect(result.byTier).toHaveLength(2);
      const tier1 = result.byTier.find((t) => t.tier === "5-9 items");
      expect(tier1?.count).toBe(2);
    });

    it("should return top 10 products", async () => {
      const mockUsages = Array.from({ length: 15 }, (_, i) => ({
        id: `u${i}`,
        orderId: `o${i}`,
        productId: `p${i}`,
        productTitle: `Product ${i}`,
        discountedPrice: 100 - i,
        discountAmount: i,
        originalPrice: 100,
        discountPercent: i,
        quantity: 1,
        createdAt: new Date(),
      }));

      vi.mocked(prisma.discountUsage.findMany).mockResolvedValue(mockUsages as never);

      const result = await getAnalyticsSummary("shop-1", 30);

      expect(result.topProducts).toHaveLength(10);
    });

    it("should return recent 20 usages", async () => {
      const mockUsages = Array.from({ length: 25 }, (_, i) => ({
        id: `u${i}`,
        orderId: `o${i}`,
        orderNumber: `100${i}`,
        discountedPrice: 90,
        discountAmount: 10,
        originalPrice: 100,
        discountPercent: 10,
        quantity: 1,
        createdAt: new Date(),
      }));

      vi.mocked(prisma.discountUsage.findMany).mockResolvedValue(mockUsages as never);

      const result = await getAnalyticsSummary("shop-1", 30);

      expect(result.recentUsages).toHaveLength(20);
    });
  });

  describe("getRuleAnalytics", () => {
    it("should return analytics for specific rule", async () => {
      const mockUsages = [
        { id: "u1", orderId: "o1", discountedPrice: 90, discountAmount: 10 },
        { id: "u2", orderId: "o2", discountedPrice: 80, discountAmount: 20 },
      ];

      vi.mocked(prisma.discountUsage.findMany).mockResolvedValue(mockUsages as never);

      const result = await getRuleAnalytics("rule-1", 30);

      expect(result.ruleId).toBe("rule-1");
      expect(result.totalOrders).toBe(2);
      expect(result.totalRevenue).toBe(170);
      expect(result.totalDiscount).toBe(30);
      expect(result.usageCount).toBe(2);
    });
  });

  describe("exportAnalyticsCSV", () => {
    it("should generate valid CSV format", async () => {
      const mockUsages = [
        {
          id: "u1",
          orderNumber: "1001",
          productTitle: "T-Shirt",
          variantTitle: "Large",
          quantity: 5,
          originalPrice: 100,
          discountedPrice: 90,
          discountAmount: 10,
          discountPercent: 10,
          tierApplied: "Tier 1",
          discountType: "TIERED",
          customerEmail: "test@example.com",
          currency: "USD",
          createdAt: new Date("2024-01-15"),
        },
      ];

      vi.mocked(prisma.discountUsage.findMany).mockResolvedValue(mockUsages as never);

      const csv = await exportAnalyticsCSV("shop-1", 30);

      expect(csv).toContain("Date,Order Number,Product");
      expect(csv).toContain("2024-01-15");
      expect(csv).toContain("1001");
      expect(csv).toContain("T-Shirt");
      expect(csv).toContain("test@example.com");
    });

    it("should escape CSV special characters", async () => {
      const mockUsages = [
        {
          id: "u1",
          orderNumber: "1001",
          productTitle: 'Product with "quotes" and, commas',
          variantTitle: "",
          quantity: 1,
          originalPrice: 100,
          discountedPrice: 90,
          discountAmount: 10,
          discountPercent: 10,
          tierApplied: "",
          discountType: "TIERED",
          customerEmail: "",
          currency: "USD",
          createdAt: new Date("2024-01-15"),
        },
      ];

      vi.mocked(prisma.discountUsage.findMany).mockResolvedValue(mockUsages as never);

      const csv = await exportAnalyticsCSV("shop-1", 30);

      expect(csv).toContain('"Product with ""quotes"" and, commas"');
    });
  });

  describe("getAnalyticsSummaryCSV", () => {
    it("should generate summary report CSV", async () => {
      vi.mocked(prisma.discountUsage.findMany).mockResolvedValue([]);

      const csv = await getAnalyticsSummaryCSV("shop-1", 30);

      expect(csv).toContain("Analytics Summary Report");
      expect(csv).toContain("Period: Last 30 days");
      expect(csv).toContain("SUMMARY");
      expect(csv).toContain("Total Orders with Discount");
      expect(csv).toContain("DAILY BREAKDOWN");
      expect(csv).toContain("TOP PRODUCTS");
      expect(csv).toContain("BY TIER");
    });
  });
});
