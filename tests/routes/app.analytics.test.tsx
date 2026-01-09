/**
 * Analytics Route Tests (app.analytics.tsx)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PolarisTestProvider } from "@shopify/polaris";

// Mock dependencies
vi.mock("~/shopify.server", () => ({
  authenticate: {
    admin: vi.fn(),
  },
}));

vi.mock("~/models/shop.server", () => ({
  getShopByDomain: vi.fn(),
  getLocaleSettings: vi.fn(),
}));

vi.mock("~/models/analytics.server", () => ({
  getAnalyticsSummary: vi.fn(),
}));

// Mock Remix hooks
let mockLoaderData: Record<string, unknown> = {};

vi.mock("@remix-run/react", async () => {
  const actual = await vi.importActual("@remix-run/react");
  return {
    ...actual,
    useLoaderData: () => mockLoaderData,
  };
});

import { authenticate } from "~/shopify.server";
import { getShopByDomain, getLocaleSettings } from "~/models/shop.server";
import { getAnalyticsSummary } from "~/models/analytics.server";
import { loader } from "~/routes/app.analytics";
import Analytics from "~/routes/app.analytics";
import { mockTranslations, mockLocaleSettings } from "../helpers/mock-translations";

const renderWithPolaris = (component: React.ReactElement) => {
  return render(<PolarisTestProvider>{component}</PolarisTestProvider>);
};

describe("Analytics Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getLocaleSettings).mockResolvedValue(mockLocaleSettings);
    mockLoaderData = {
      analytics: {
        summary: {
          totalOrders: 150,
          totalRevenue: 12500.00,
          totalDiscount: 1875.00,
          averageDiscount: 15.0,
        },
        dailyStats: [
          { date: "2024-01-14", revenue: 500, orders: 5 },
          { date: "2024-01-15", revenue: 750, orders: 8 },
        ],
        byTier: [
          { tier: "5-9 items", count: 50, revenue: 5000 },
          { tier: "10+ items", count: 30, revenue: 7500 },
        ],
        byRule: [
          { ruleId: "rule-123456", count: 80, revenue: 10000 },
        ],
        topProducts: [
          { productId: "prod-1", title: "T-Shirt", count: 100, quantity: 500, revenue: 5000 },
          { productId: "prod-2", title: "Jeans", count: 50, quantity: 200, revenue: 4000 },
        ],
        recentUsages: [
          {
            orderNumber: "1001",
            productTitle: "T-Shirt",
            quantity: 10,
            discountPercent: 15,
            discountAmount: 15.00,
            createdAt: "2024-01-15T10:00:00Z",
          },
        ],
      },
      days: 30,
      currency: "USD",
      t: mockTranslations,
    };
  });

  // ============================================================================
  // LOADER TESTS
  // ============================================================================

  describe("loader", () => {
    it("should load analytics data with default 30 days", async () => {
      vi.mocked(authenticate.admin).mockResolvedValue({
        session: { shop: "test.myshopify.com" },
      } as never);

      vi.mocked(getShopByDomain).mockResolvedValue({
        id: "shop-1",
        shopDomain: "test.myshopify.com",
      } as never);

      vi.mocked(getAnalyticsSummary).mockResolvedValue({
        period: { days: 30, startDate: new Date(), endDate: new Date() },
        summary: {
          totalOrders: 100,
          totalRevenue: 10000,
          totalDiscount: 1500,
          totalOriginal: 11500,
          averageDiscount: 15,
          conversionLift: 5,
        },
        dailyStats: [],
        byTier: [],
        byRule: [],
        topProducts: [],
        recentUsages: [],
      });

      const request = new Request("http://localhost/app/analytics");
      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      expect(data.days).toBe(30);
      expect(getAnalyticsSummary).toHaveBeenCalledWith("shop-1", 30);
    });

    it("should load analytics with custom days parameter", async () => {
      vi.mocked(authenticate.admin).mockResolvedValue({
        session: { shop: "test.myshopify.com" },
      } as never);

      vi.mocked(getShopByDomain).mockResolvedValue({
        id: "shop-1",
        shopDomain: "test.myshopify.com",
      } as never);

      vi.mocked(getAnalyticsSummary).mockResolvedValue({
        period: { days: 7, startDate: new Date(), endDate: new Date() },
        summary: { totalOrders: 50, totalRevenue: 5000, totalDiscount: 750, totalOriginal: 5750, averageDiscount: 15, conversionLift: 3 },
        dailyStats: [],
        byTier: [],
        byRule: [],
        topProducts: [],
        recentUsages: [],
      });

      const request = new Request("http://localhost/app/analytics?days=7");
      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      expect(data.days).toBe(7);
      expect(getAnalyticsSummary).toHaveBeenCalledWith("shop-1", 7);
    });

    it("should return 404 if shop not found", async () => {
      vi.mocked(authenticate.admin).mockResolvedValue({
        session: { shop: "test.myshopify.com" },
      } as never);

      vi.mocked(getShopByDomain).mockResolvedValue(null);

      const request = new Request("http://localhost/app/analytics");

      await expect(loader({ request, params: {}, context: {} })).rejects.toThrow();
    });
  });

  // ============================================================================
  // COMPONENT RENDER TESTS
  // ============================================================================

  describe("Analytics component", () => {
    it("should render analytics dashboard title", () => {
      renderWithPolaris(<Analytics />);

      expect(screen.getByText("Analytics Dashboard")).toBeInTheDocument();
    });

    it("should render time period selector", () => {
      renderWithPolaris(<Analytics />);

      expect(screen.getByText("Time Period")).toBeInTheDocument();
    });

    it("should render summary cards", () => {
      renderWithPolaris(<Analytics />);

      expect(screen.getByText(mockTranslations.analyticsPage.totalOrders)).toBeInTheDocument();
      expect(screen.getByText(mockTranslations.analyticsPage.revenue)).toBeInTheDocument();
      expect(screen.getByText(mockTranslations.analyticsPage.avgDiscount)).toBeInTheDocument();
    });

    it("should display summary values", () => {
      renderWithPolaris(<Analytics />);

      expect(screen.getByText("150")).toBeInTheDocument();
      expect(screen.getByText("$12,500.00")).toBeInTheDocument();
      expect(screen.getByText("15.0%")).toBeInTheDocument();
    });

    it("should display total discount saved", () => {
      renderWithPolaris(<Analytics />);

      expect(screen.getByText(/\$1,875\.00/)).toBeInTheDocument();
      expect(screen.getByText(new RegExp(mockTranslations.analyticsPage.savedByCustomers))).toBeInTheDocument();
    });

    it("should render daily revenue trend section", () => {
      renderWithPolaris(<Analytics />);

      expect(screen.getByText(mockTranslations.analyticsPage.dailyTrend)).toBeInTheDocument();
    });

    it("should render performance by tier section", () => {
      renderWithPolaris(<Analytics />);

      expect(screen.getByText(mockTranslations.analyticsPage.byTier)).toBeInTheDocument();
    });

    it("should render performance by rule section", () => {
      renderWithPolaris(<Analytics />);

      expect(screen.getByText(mockTranslations.analyticsPage.byRule)).toBeInTheDocument();
    });

    it("should render top products section", () => {
      renderWithPolaris(<Analytics />);

      expect(screen.getByText(mockTranslations.analyticsPage.topProducts)).toBeInTheDocument();
    });

    it("should render recent activity section", () => {
      renderWithPolaris(<Analytics />);

      expect(screen.getByText(mockTranslations.analyticsPage.recentActivity)).toBeInTheDocument();
    });

    it("should render optimization tips", () => {
      renderWithPolaris(<Analytics />);

      expect(screen.getByText(mockTranslations.analyticsPage.tips)).toBeInTheDocument();
    });

    it("should show empty state for daily stats when no data", () => {
      mockLoaderData = {
        analytics: {
          summary: { totalOrders: 0, totalRevenue: 0, totalDiscount: 0, averageDiscount: 0 },
          dailyStats: [],
          byTier: [],
          byRule: [],
          topProducts: [],
          recentUsages: [],
        },
        days: 30,
        currency: "USD",
        t: mockTranslations,
      };

      renderWithPolaris(<Analytics />);

      expect(screen.getByText(mockTranslations.analyticsPage.noData)).toBeInTheDocument();
    });

    it("should show empty state for tier data when no data", () => {
      mockLoaderData = {
        analytics: {
          summary: { totalOrders: 0, totalRevenue: 0, totalDiscount: 0, averageDiscount: 0 },
          dailyStats: [],
          byTier: [],
          byRule: [],
          topProducts: [],
          recentUsages: [],
        },
        days: 30,
        currency: "USD",
        t: mockTranslations,
      };

      renderWithPolaris(<Analytics />);

      expect(screen.getByText(mockTranslations.analyticsPage.noTierData)).toBeInTheDocument();
    });

    it("should show empty state for rule data when no data", () => {
      mockLoaderData = {
        analytics: {
          summary: { totalOrders: 0, totalRevenue: 0, totalDiscount: 0, averageDiscount: 0 },
          dailyStats: [],
          byTier: [],
          byRule: [],
          topProducts: [],
          recentUsages: [],
        },
        days: 30,
        currency: "USD",
        t: mockTranslations,
      };

      renderWithPolaris(<Analytics />);

      expect(screen.getByText(mockTranslations.analyticsPage.noRuleData)).toBeInTheDocument();
    });

    it("should show empty state for products when no data", () => {
      mockLoaderData = {
        analytics: {
          summary: { totalOrders: 0, totalRevenue: 0, totalDiscount: 0, averageDiscount: 0 },
          dailyStats: [],
          byTier: [],
          byRule: [],
          topProducts: [],
          recentUsages: [],
        },
        days: 30,
        currency: "USD",
        t: mockTranslations,
      };

      renderWithPolaris(<Analytics />);

      expect(screen.getByText(mockTranslations.analyticsPage.noProductData)).toBeInTheDocument();
    });

    it("should show empty state for recent activity when no data", () => {
      mockLoaderData = {
        analytics: {
          summary: { totalOrders: 0, totalRevenue: 0, totalDiscount: 0, averageDiscount: 0 },
          dailyStats: [],
          byTier: [],
          byRule: [],
          topProducts: [],
          recentUsages: [],
        },
        days: 30,
        currency: "USD",
        t: mockTranslations,
      };

      renderWithPolaris(<Analytics />);

      expect(screen.getByText(mockTranslations.analyticsPage.noRecentActivity)).toBeInTheDocument();
    });

    it("should display tier data in table", () => {
      renderWithPolaris(<Analytics />);

      expect(screen.getByText("5-9 items")).toBeInTheDocument();
      expect(screen.getByText("10+ items")).toBeInTheDocument();
    });

    it("should display top products in table", () => {
      renderWithPolaris(<Analytics />);

      expect(screen.getAllByText("T-Shirt").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Jeans").length).toBeGreaterThan(0);
    });

    it("should display recent usage data", () => {
      renderWithPolaris(<Analytics />);

      expect(screen.getByText("#1001")).toBeInTheDocument();
    });

    it("should have export buttons", () => {
      renderWithPolaris(<Analytics />);

      expect(screen.getAllByText(mockTranslations.analyticsPage.exportDetailed).length).toBeGreaterThan(0);
      expect(screen.getAllByText(mockTranslations.analyticsPage.exportSummary).length).toBeGreaterThan(0);
    });

    it("should render daily stats bars", () => {
      renderWithPolaris(<Analytics />);

      // Check for formatted dates
      expect(screen.getByText("Jan 14")).toBeInTheDocument();
      expect(screen.getByText("Jan 15")).toBeInTheDocument();
    });
  });
});
