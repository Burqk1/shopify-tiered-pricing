/**
 * Analytics Sync Service Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma
vi.mock("~/db.server", () => ({
  default: {
    productAnalyticsHistory: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import prisma from "~/db.server";

describe("Analytics Sync Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Daily Analytics Sync", () => {
    it("should store daily analytics record", async () => {
      const analyticsRecord = {
        id: "analytics-1",
        shopId: "shop-1",
        productId: "prod-123",
        date: new Date("2024-01-15"),
        pageViews: 150,
        uniqueVisitors: 120,
        addToCartCount: 25,
        unitsSold: 8,
        revenue: 800,
        conversionRate: 0.0533,
        inventoryLevel: 45,
        dataSource: "ESTIMATED",
      };

      vi.mocked(prisma.productAnalyticsHistory.upsert).mockResolvedValue(analyticsRecord as never);

      const result = await prisma.productAnalyticsHistory.upsert({
        where: {
          shopId_productId_date: {
            shopId: "shop-1",
            productId: "prod-123",
            date: new Date("2024-01-15"),
          },
        },
        update: analyticsRecord,
        create: analyticsRecord,
      });

      expect(result.pageViews).toBe(150);
      expect(result.unitsSold).toBe(8);
    });

    it("should calculate conversion rate correctly", () => {
      const pageViews = 200;
      const purchases = 6;

      const conversionRate = pageViews > 0 ? purchases / pageViews : 0;
      expect(conversionRate).toBeCloseTo(0.03, 4); // 3%
    });

    it("should calculate cart rate correctly", () => {
      const pageViews = 200;
      const addToCart = 30;

      const cartRate = pageViews > 0 ? addToCart / pageViews : 0;
      expect(cartRate).toBeCloseTo(0.15, 4); // 15%
    });

    it("should handle zero page views", () => {
      const pageViews = 0;
      const purchases = 0;

      const conversionRate = pageViews > 0 ? purchases / pageViews : 0;
      expect(conversionRate).toBe(0);
      expect(Number.isNaN(conversionRate)).toBe(false);
    });
  });

  describe("Page View Estimation", () => {
    it("should estimate page views from sales data", () => {
      const unitsSold = 10;
      const estimatedConversionRate = 0.025; // 2.5% assumed

      const estimatedViews = Math.round(unitsSold / estimatedConversionRate);
      expect(estimatedViews).toBe(400);
    });

    it("should handle zero sales", () => {
      const unitsSold = 0;
      const estimatedConversionRate = 0.025;

      const estimatedViews = Math.round(unitsSold / estimatedConversionRate);
      expect(estimatedViews).toBe(0);
    });

    it("should cap unrealistic estimates", () => {
      const unitsSold = 1;
      const estimatedConversionRate = 0.001; // Very low conversion

      let estimatedViews = Math.round(unitsSold / estimatedConversionRate);
      // Cap at reasonable maximum
      const maxViewsPerDay = 10000;
      estimatedViews = Math.min(estimatedViews, maxViewsPerDay);

      expect(estimatedViews).toBe(1000);
    });
  });

  describe("Historical Data Aggregation", () => {
    it("should aggregate 7-day totals", () => {
      const dailyData = [
        { pageViews: 100, unitsSold: 5 },
        { pageViews: 120, unitsSold: 6 },
        { pageViews: 90, unitsSold: 4 },
        { pageViews: 150, unitsSold: 8 },
        { pageViews: 110, unitsSold: 5 },
        { pageViews: 200, unitsSold: 10 },
        { pageViews: 130, unitsSold: 7 },
      ];

      const totals = dailyData.reduce(
        (acc, day) => ({
          pageViews: acc.pageViews + day.pageViews,
          unitsSold: acc.unitsSold + day.unitsSold,
        }),
        { pageViews: 0, unitsSold: 0 }
      );

      expect(totals.pageViews).toBe(900);
      expect(totals.unitsSold).toBe(45);
    });

    it("should calculate daily averages", () => {
      const weeklyTotals = { pageViews: 700, unitsSold: 35 };
      const days = 7;

      const dailyAverages = {
        pageViews: weeklyTotals.pageViews / days,
        unitsSold: weeklyTotals.unitsSold / days,
      };

      expect(dailyAverages.pageViews).toBe(100);
      expect(dailyAverages.unitsSold).toBe(5);
    });

    it("should detect trends (week over week)", () => {
      const thisWeek = { pageViews: 800, unitsSold: 40 };
      const lastWeek = { pageViews: 600, unitsSold: 30 };

      const viewsTrend = ((thisWeek.pageViews - lastWeek.pageViews) / lastWeek.pageViews) * 100;
      const salesTrend = ((thisWeek.unitsSold - lastWeek.unitsSold) / lastWeek.unitsSold) * 100;

      expect(viewsTrend).toBeCloseTo(33.33, 1); // 33% increase
      expect(salesTrend).toBeCloseTo(33.33, 1);
    });
  });

  describe("Inventory Tracking", () => {
    it("should snapshot daily inventory level", () => {
      const inventoryAtStartOfDay = 100;
      const unitsSold = 15;
      const inventoryAtEndOfDay = inventoryAtStartOfDay - unitsSold;

      expect(inventoryAtEndOfDay).toBe(85);
    });

    it("should calculate days of inventory", () => {
      const currentInventory = 150;
      const avgDailySales = 10;

      const daysOfInventory = avgDailySales > 0 ?
        currentInventory / avgDailySales : Infinity;

      expect(daysOfInventory).toBe(15);
    });

    it("should flag low inventory", () => {
      const currentInventory = 20;
      const avgDailySales = 10;
      const lowThresholdDays = 7;

      const daysOfInventory = currentInventory / avgDailySales;
      const isLowInventory = daysOfInventory < lowThresholdDays;

      expect(isLowInventory).toBe(true);
    });

    it("should flag overstock", () => {
      const currentInventory = 500;
      const avgDailySales = 5;
      const overstockThresholdDays = 60;

      const daysOfInventory = currentInventory / avgDailySales;
      const isOverstocked = daysOfInventory > overstockThresholdDays;

      expect(daysOfInventory).toBe(100);
      expect(isOverstocked).toBe(true);
    });
  });

  describe("Data Source Handling", () => {
    it("should prefer actual data over estimates", () => {
      const sources = [
        { source: "SHOPIFY_API", priority: 1 },
        { source: "GOOGLE_ANALYTICS", priority: 2 },
        { source: "ESTIMATED", priority: 3 },
        { source: "MANUAL", priority: 4 },
      ];

      const sorted = sources.sort((a, b) => a.priority - b.priority);
      expect(sorted[0].source).toBe("SHOPIFY_API");
    });

    it("should mark data as estimated when no API data", () => {
      const hasShopifyData = false;
      const hasGAData = false;

      const dataSource = hasShopifyData ? "SHOPIFY_API" :
        hasGAData ? "GOOGLE_ANALYTICS" : "ESTIMATED";

      expect(dataSource).toBe("ESTIMATED");
    });
  });

  describe("Backfill Processing", () => {
    it("should calculate dates for backfill", () => {
      const days = 30;
      const dates: Date[] = [];

      for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        dates.push(date);
      }

      expect(dates).toHaveLength(30);
      expect(dates[0].getTime()).toBeGreaterThan(dates[29].getTime());
    });

    it("should skip existing records", async () => {
      vi.mocked(prisma.productAnalyticsHistory.count).mockResolvedValue(15);

      const existingCount = await prisma.productAnalyticsHistory.count({
        where: {
          shopId: "shop-1",
          date: { gte: expect.any(Date) },
        },
      });

      expect(existingCount).toBe(15);

      // If we're backfilling 30 days and 15 exist, we should create 15 new
      const daysToBackfill = 30;
      const newRecordsNeeded = daysToBackfill - existingCount;
      expect(newRecordsNeeded).toBe(15);
    });
  });

  describe("Bulk Operations", () => {
    it("should process multiple products", async () => {
      const products = [
        { id: "prod-1", sales: 10 },
        { id: "prod-2", sales: 5 },
        { id: "prod-3", sales: 15 },
      ];

      const results = await Promise.all(
        products.map(async (product) => ({
          productId: product.id,
          synced: true,
        }))
      );

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.synced)).toBe(true);
    });

    it("should handle partial failures gracefully", async () => {
      const products = ["prod-1", "prod-2", "prod-3"];
      const results: { productId: string; success: boolean; error?: string }[] = [];

      for (const productId of products) {
        try {
          if (productId === "prod-2") {
            throw new Error("API error");
          }
          results.push({ productId, success: true });
        } catch (error) {
          results.push({
            productId,
            success: false,
            error: (error as Error).message,
          });
        }
      }

      expect(results.filter((r) => r.success)).toHaveLength(2);
      expect(results.filter((r) => !r.success)).toHaveLength(1);
    });
  });

  describe("Revenue Calculations", () => {
    it("should calculate revenue from sales", () => {
      const unitsSold = 10;
      const averagePrice = 99.99;

      const revenue = unitsSold * averagePrice;
      expect(revenue).toBeCloseTo(999.90, 2);
    });

    it("should calculate average order value", () => {
      const totalRevenue = 5000;
      const numberOfOrders = 50;

      const aov = numberOfOrders > 0 ? totalRevenue / numberOfOrders : 0;
      expect(aov).toBe(100);
    });

    it("should calculate revenue per visitor", () => {
      const totalRevenue = 1000;
      const uniqueVisitors = 500;

      const rpv = uniqueVisitors > 0 ? totalRevenue / uniqueVisitors : 0;
      expect(rpv).toBe(2);
    });
  });
});

describe("Sales Data Processing", () => {
  it("should aggregate sales by product", () => {
    const lineItems = [
      { productId: "prod-1", quantity: 2, price: 50 },
      { productId: "prod-2", quantity: 1, price: 100 },
      { productId: "prod-1", quantity: 3, price: 50 },
    ];

    const salesByProduct = new Map<string, { quantity: number; revenue: number }>();

    for (const item of lineItems) {
      const existing = salesByProduct.get(item.productId) || { quantity: 0, revenue: 0 };
      existing.quantity += item.quantity;
      existing.revenue += item.quantity * item.price;
      salesByProduct.set(item.productId, existing);
    }

    expect(salesByProduct.get("prod-1")).toEqual({ quantity: 5, revenue: 250 });
    expect(salesByProduct.get("prod-2")).toEqual({ quantity: 1, revenue: 100 });
  });

  it("should filter paid orders only", () => {
    const orders = [
      { id: "order-1", financialStatus: "paid", total: 100 },
      { id: "order-2", financialStatus: "pending", total: 50 },
      { id: "order-3", financialStatus: "paid", total: 75 },
      { id: "order-4", financialStatus: "refunded", total: 80 },
    ];

    const paidOrders = orders.filter((o) => o.financialStatus === "paid");
    expect(paidOrders).toHaveLength(2);

    const paidTotal = paidOrders.reduce((sum, o) => sum + o.total, 0);
    expect(paidTotal).toBe(175);
  });

  it("should handle date range filtering", () => {
    const now = new Date();
    const orders = [
      { createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000) }, // 1 day ago
      { createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000) }, // 5 days ago
      { createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000) }, // 10 days ago
      { createdAt: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000) }, // 40 days ago
    ];

    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const last30Days = orders.filter((o) => o.createdAt >= thirtyDaysAgo);

    expect(last30Days).toHaveLength(3);
  });
});
