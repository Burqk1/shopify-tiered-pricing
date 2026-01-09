/**
 * Dashboard Route Tests (app._index.tsx)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { json } from "@remix-run/node";
import { PolarisTestProvider } from "@shopify/polaris";

// Mock dependencies
vi.mock("~/shopify.server", () => ({
  authenticate: {
    admin: vi.fn(),
  },
}));

vi.mock("~/models/shop.server", () => ({
  getShopWithRules: vi.fn(),
  canCreateRule: vi.fn(),
  getPlanFeatures: vi.fn(),
  getLocaleSettings: vi.fn(),
}));

vi.mock("~/models/pricing-rule.server", () => ({
  updateRuleStatus: vi.fn(),
  deletePricingRule: vi.fn(),
}));

vi.mock("~/services/sync-engine.server", () => ({
  syncRulesToShopify: vi.fn(),
}));

vi.mock("~/models/sync-log.server", () => ({
  getSyncStats: vi.fn(),
}));

// Mock Remix hooks
const mockNavigate = vi.fn();
const mockSubmit = vi.fn();
let mockLoaderData: Record<string, unknown> = {};

vi.mock("@remix-run/react", async () => {
  const actual = await vi.importActual("@remix-run/react");
  return {
    ...actual,
    useLoaderData: () => mockLoaderData,
    useNavigate: () => mockNavigate,
    useSubmit: () => mockSubmit,
  };
});

import { authenticate } from "~/shopify.server";
import { getShopWithRules, canCreateRule, getPlanFeatures, getLocaleSettings } from "~/models/shop.server";
import { updateRuleStatus, deletePricingRule } from "~/models/pricing-rule.server";
import { syncRulesToShopify } from "~/services/sync-engine.server";
import { getSyncStats } from "~/models/sync-log.server";
import { loader, action } from "~/routes/app._index";
import Dashboard from "~/routes/app._index";
import { mockTranslations, mockLocaleSettings } from "../helpers/mock-translations";

const renderWithPolaris = (component: React.ReactElement) => {
  return render(<PolarisTestProvider>{component}</PolarisTestProvider>);
};

describe("Dashboard Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getLocaleSettings).mockResolvedValue(mockLocaleSettings);
    mockLoaderData = {
      shop: {
        domain: "test.myshopify.com",
        plan: "FREE",
        ruleLimit: 1,
      },
      rules: [],
      canCreate: true,
      syncStats: {
        totalSyncs: 10,
        successRate: 90,
        lastSync: "2024-01-15T10:00:00Z",
      },
      t: mockTranslations,
    };
  });

  // ============================================================================
  // LOADER TESTS
  // ============================================================================

  describe("loader", () => {
    it("should load shop data with rules", async () => {
      vi.mocked(authenticate.admin).mockResolvedValue({
        session: { shop: "test.myshopify.com" },
        admin: {},
      } as never);

      vi.mocked(getShopWithRules).mockResolvedValue({
        id: "shop-1",
        shopDomain: "test.myshopify.com",
        plan: "GROWTH",
        rules: [
          {
            id: "rule-1",
            name: "Bulk Discount",
            status: "ACTIVE",
            priority: 10,
            conditions: [{ id: "cond-1" }],
            tiers: [{ id: "tier-1" }, { id: "tier-2" }],
            syncedAt: new Date("2024-01-15"),
            syncError: null,
            createdAt: new Date("2024-01-01"),
          },
        ],
      } as never);

      vi.mocked(canCreateRule).mockResolvedValue(true);
      vi.mocked(getSyncStats).mockResolvedValue({
        totalSyncs: 50,
        successCount: 45,
        failedCount: 5,
        lastSync: new Date("2024-01-15"),
        averageDuration: 1200,
      });
      vi.mocked(getPlanFeatures).mockReturnValue({
        ruleLimit: "unlimited",
        customerTags: true,
        cssEditor: true,
        prioritySupport: false,
        multiCurrency: false,
        posIntegration: true,
        aiPricing: false,
        abTesting: true,
        competitorTracking: false,
      });

      const request = new Request("http://localhost/app");
      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      expect(data.shop.plan).toBe("GROWTH");
      expect(data.rules).toHaveLength(1);
      expect(data.rules[0].name).toBe("Bulk Discount");
      expect(data.rules[0].conditionCount).toBe(1);
      expect(data.rules[0].tierCount).toBe(2);
      expect(data.canCreate).toBe(true);
      expect(data.syncStats.successRate).toBe(90);
    });

    it("should return 404 if shop not found", async () => {
      vi.mocked(authenticate.admin).mockResolvedValue({
        session: { shop: "test.myshopify.com" },
        admin: {},
      } as never);

      vi.mocked(getShopWithRules).mockResolvedValue(null);

      const request = new Request("http://localhost/app");

      await expect(loader({ request, params: {}, context: {} })).rejects.toThrow();
    });
  });

  // ============================================================================
  // ACTION TESTS
  // ============================================================================

  describe("action", () => {
    beforeEach(() => {
      vi.mocked(authenticate.admin).mockResolvedValue({
        session: { shop: "test.myshopify.com" },
        admin: {},
      } as never);

      vi.mocked(getShopWithRules).mockResolvedValue({
        id: "shop-1",
        shopDomain: "test.myshopify.com",
        rules: [],
      } as never);
    });

    it("should handle sync action", async () => {
      vi.mocked(syncRulesToShopify).mockResolvedValue({
        success: true,
        rulesCount: 5,
      });

      const formData = new FormData();
      formData.append("action", "sync");

      const request = new Request("http://localhost/app", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {} });
      const data = await response.json() as { success?: boolean; message?: string; error?: string };

      expect(data.success).toBe(true);
      expect(data.message).toContain("5 rules");
    });

    it("should handle sync failure", async () => {
      vi.mocked(syncRulesToShopify).mockResolvedValue({
        success: false,
        error: "API Error",
        rulesCount: 0,
      });

      const formData = new FormData();
      formData.append("action", "sync");

      const request = new Request("http://localhost/app", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {} });
      const data = await response.json() as { success?: boolean; message?: string; error?: string };

      expect(data.success).toBe(false);
      expect(data.message).toContain("API Error");
    });

    it("should handle updateStatus action", async () => {
      vi.mocked(updateRuleStatus).mockResolvedValue({ id: "rule-1" } as never);

      const formData = new FormData();
      formData.append("action", "updateStatus");
      formData.append("ruleId", "rule-1");
      formData.append("status", "ACTIVE");

      const request = new Request("http://localhost/app", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {} });
      const data = await response.json() as { success?: boolean };

      expect(data.success).toBe(true);
      expect(updateRuleStatus).toHaveBeenCalledWith("rule-1", "ACTIVE");
    });

    it("should handle delete action", async () => {
      vi.mocked(deletePricingRule).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("action", "delete");
      formData.append("ruleId", "rule-1");

      const request = new Request("http://localhost/app", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {} });
      const data = await response.json() as { success?: boolean };

      expect(data.success).toBe(true);
      expect(deletePricingRule).toHaveBeenCalledWith("rule-1");
    });

    it("should handle unknown action", async () => {
      const formData = new FormData();
      formData.append("action", "unknown");

      const request = new Request("http://localhost/app", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {} });

      expect(response.status).toBe(400);
    });

    it("should return 404 if shop not found in action", async () => {
      vi.mocked(getShopWithRules).mockResolvedValue(null);

      const formData = new FormData();
      formData.append("action", "sync");

      const request = new Request("http://localhost/app", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {} });

      expect(response.status).toBe(404);
    });
  });

  // ============================================================================
  // COMPONENT RENDER TESTS
  // ============================================================================

  describe("Dashboard component", () => {
    it("should render dashboard title", () => {
      renderWithPolaris(<Dashboard />);

      expect(screen.getByText(mockTranslations.dashboard.title)).toBeInTheDocument();
    });

    it("should render stats cards", () => {
      mockLoaderData = {
        shop: { domain: "test.myshopify.com", plan: "FREE", ruleLimit: 1 },
        rules: [
          { id: "rule-1", name: "Rule 1", status: "ACTIVE", priority: 10 },
          { id: "rule-2", name: "Rule 2", status: "DRAFT", priority: 5 },
        ],
        canCreate: true,
        syncStats: { totalSyncs: 10, successRate: 90, lastSync: null },
        t: mockTranslations,
      };

      renderWithPolaris(<Dashboard />);

      expect(screen.getByText(mockTranslations.dashboard.activeRules)).toBeInTheDocument();
      expect(screen.getByText(mockTranslations.dashboard.totalSyncs)).toBeInTheDocument();
    });

    it("should render empty state when no rules", () => {
      mockLoaderData = {
        shop: { domain: "test.myshopify.com", plan: "FREE", ruleLimit: 1 },
        rules: [],
        canCreate: true,
        syncStats: { totalSyncs: 0, successRate: 100, lastSync: null },
        t: mockTranslations,
      };

      renderWithPolaris(<Dashboard />);

      expect(screen.getByText(mockTranslations.dashboard.createFirstRuleDesc)).toBeInTheDocument();
    });

    it("should render rules in table", () => {
      mockLoaderData = {
        shop: { domain: "test.myshopify.com", plan: "GROWTH", ruleLimit: "unlimited" },
        rules: [
          {
            id: "rule-1",
            name: "Bulk Discount",
            status: "ACTIVE",
            priority: 10,
            conditionCount: 2,
            tierCount: 3,
            syncedAt: "2024-01-15T10:00:00Z",
            syncError: null,
          },
        ],
        canCreate: true,
        syncStats: { totalSyncs: 5, successRate: 100, lastSync: "2024-01-15T10:00:00Z" },
        t: mockTranslations,
      };

      renderWithPolaris(<Dashboard />);

      expect(screen.getByText("Bulk Discount")).toBeInTheDocument();
      expect(screen.getByText(mockTranslations.rules.active)).toBeInTheDocument();
    });

    it("should show rule limit banner when cannot create", () => {
      mockLoaderData = {
        shop: { domain: "test.myshopify.com", plan: "FREE", ruleLimit: 1 },
        rules: [{ id: "rule-1", name: "Rule 1", status: "ACTIVE" }],
        canCreate: false,
        syncStats: { totalSyncs: 0, successRate: 100, lastSync: null },
        t: mockTranslations,
      };

      renderWithPolaris(<Dashboard />);

      expect(screen.getByText(/limit/i)).toBeInTheDocument();
    });

    it("should show sync error badge for rules with sync error", () => {
      mockLoaderData = {
        shop: { domain: "test.myshopify.com", plan: "GROWTH", ruleLimit: "unlimited" },
        rules: [
          {
            id: "rule-1",
            name: "Error Rule",
            status: "ACTIVE",
            priority: 10,
            conditionCount: 1,
            tierCount: 1,
            syncedAt: null,
            syncError: "API timeout",
          },
        ],
        canCreate: true,
        syncStats: { totalSyncs: 5, successRate: 80, lastSync: null },
        t: mockTranslations,
      };

      renderWithPolaris(<Dashboard />);

      expect(screen.getByText(mockTranslations.rules.syncError)).toBeInTheDocument();
    });

    it("should show not synced badge for new rules", () => {
      mockLoaderData = {
        shop: { domain: "test.myshopify.com", plan: "GROWTH", ruleLimit: "unlimited" },
        rules: [
          {
            id: "rule-1",
            name: "New Rule",
            status: "DRAFT",
            priority: 10,
            conditionCount: 1,
            tierCount: 1,
            syncedAt: null,
            syncError: null,
          },
        ],
        canCreate: true,
        syncStats: { totalSyncs: 0, successRate: 100, lastSync: null },
        t: mockTranslations,
      };

      renderWithPolaris(<Dashboard />);

      expect(screen.getByText(mockTranslations.rules.notSynced)).toBeInTheDocument();
    });

    it("should show plan info", () => {
      mockLoaderData = {
        shop: { domain: "test.myshopify.com", plan: "PROFESSIONAL", ruleLimit: "unlimited" },
        rules: [],
        canCreate: true,
        syncStats: { totalSyncs: 0, successRate: 100, lastSync: null },
        t: mockTranslations,
      };

      renderWithPolaris(<Dashboard />);

      expect(screen.getByText(/PROFESSIONAL/)).toBeInTheDocument();
    });

    it("should navigate to create rule on button click", () => {
      mockLoaderData = {
        shop: { domain: "test.myshopify.com", plan: "GROWTH", ruleLimit: "unlimited" },
        rules: [],
        canCreate: true,
        syncStats: { totalSyncs: 0, successRate: 100, lastSync: null },
        t: mockTranslations,
      };

      renderWithPolaris(<Dashboard />);

      const createButtons = screen.getAllByText(mockTranslations.rules.createRule);
      fireEvent.click(createButtons[0]);

      expect(mockNavigate).toHaveBeenCalledWith("/app/rules/new");
    });
  });
});
