/**
 * Settings Route Tests (app.settings.tsx)
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
  getPlanFeatures: vi.fn(),
  getPOSSettings: vi.fn(),
  updatePOSSettings: vi.fn(),
  getLocaleSettings: vi.fn(),
}));

vi.mock("~/services/billing.server", () => ({
  PLANS: {
    FREE: { price: 0, features: ["1 pricing rule", "Basic support"] },
    GROWTH: { price: 9.99, features: ["Unlimited rules", "Customer tags"] },
    PROFESSIONAL: { price: 29.99, features: ["Everything in Growth", "Priority support"] },
  },
  createSubscription: vi.fn(),
  getSubscriptionStatus: vi.fn(),
  cancelSubscription: vi.fn(),
}));

vi.mock("~/models/sync-log.server", () => ({
  getSyncStats: vi.fn(),
}));

// Mock Remix hooks
const mockNavigate = vi.fn();
const mockSubmit = vi.fn();
let mockLoaderData: Record<string, unknown> = {};
let mockActionData: Record<string, unknown> | null = null;

vi.mock("@remix-run/react", async () => {
  const actual = await vi.importActual("@remix-run/react");
  return {
    ...actual,
    useLoaderData: () => mockLoaderData,
    useActionData: () => mockActionData,
    useNavigate: () => mockNavigate,
    useSubmit: () => mockSubmit,
  };
});

import { authenticate } from "~/shopify.server";
import { getShopByDomain, getPlanFeatures, getPOSSettings, updatePOSSettings, getLocaleSettings } from "~/models/shop.server";
import { createSubscription, getSubscriptionStatus, cancelSubscription } from "~/services/billing.server";
import { getSyncStats } from "~/models/sync-log.server";
import { loader, action } from "~/routes/app.settings";
import Settings from "~/routes/app.settings";
import { mockTranslations, mockLocaleSettings } from "../helpers/mock-translations";

const renderWithPolaris = (component: React.ReactElement) => {
  return render(<PolarisTestProvider>{component}</PolarisTestProvider>);
};

describe("Settings Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getLocaleSettings).mockResolvedValue(mockLocaleSettings);
    mockActionData = null;
    mockLoaderData = {
      shop: {
        domain: "test.myshopify.com",
        name: "Test Store",
        email: "test@example.com",
        plan: "FREE",
      },
      subscription: null,
      planFeatures: {
        ruleLimit: 1,
        customerTags: false,
        cssEditor: false,
        prioritySupport: false,
        multiCurrency: false,
        posIntegration: true,
      },
      syncStats: {
        totalSyncs: 10,
        successCount: 9,
        failedCount: 1,
        lastSync: "2024-01-15T10:00:00Z",
      },
      plans: {
        FREE: { price: 0, features: ["1 pricing rule"] },
        GROWTH: { price: 9.99, features: ["Unlimited rules"] },
        PROFESSIONAL: { price: 29.99, features: ["Everything"] },
      },
      posSettings: {
        posEnabled: true,
        posShowTierInfo: true,
        posStaffOverride: false,
      },
      localeSettings: mockLocaleSettings,
      supportedLocales: [
        { code: "en", name: "English", flag: "🇬🇧" },
        { code: "tr", name: "Türkçe", flag: "🇹🇷" },
      ],
      featureAccess: {
        aiPricing: true,
        abTesting: true,
        multiCurrency: true,
      },
      t: mockTranslations,
    };
  });

  // ============================================================================
  // LOADER TESTS
  // ============================================================================

  describe("loader", () => {
    it("should load shop settings", async () => {
      vi.mocked(authenticate.admin).mockResolvedValue({
        session: { shop: "test.myshopify.com" },
        admin: {},
      } as never);

      vi.mocked(getShopByDomain).mockResolvedValue({
        id: "shop-1",
        shopDomain: "test.myshopify.com",
        shopName: "Test Store",
        email: "test@example.com",
        plan: "GROWTH",
      } as never);

      vi.mocked(getSubscriptionStatus).mockResolvedValue({
        active: true,
        plan: "GROWTH",
      });

      vi.mocked(getSyncStats).mockResolvedValue({
        totalSyncs: 50,
        successCount: 48,
        failedCount: 2,
        lastSync: new Date("2024-01-15"),
        averageDuration: 1000,
      });

      vi.mocked(getPOSSettings).mockResolvedValue({
        posEnabled: true,
        posShowTierInfo: true,
        posStaffOverride: false,
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

      const request = new Request("http://localhost/app/settings");
      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      expect(data.shop.plan).toBe("GROWTH");
      expect(data.planFeatures.customerTags).toBe(true);
      expect(data.posSettings.posEnabled).toBe(true);
    });

    it("should return 404 if shop not found", async () => {
      vi.mocked(authenticate.admin).mockResolvedValue({
        session: { shop: "test.myshopify.com" },
        admin: {},
      } as never);

      vi.mocked(getShopByDomain).mockResolvedValue(null);

      const request = new Request("http://localhost/app/settings");

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
    });

    it("should handle upgrade action", async () => {
      vi.mocked(createSubscription).mockResolvedValue({
        confirmationUrl: "https://shopify.com/billing/confirm",
      });

      const formData = new FormData();
      formData.append("action", "upgrade");
      formData.append("plan", "GROWTH");

      const request = new Request("http://localhost/app/settings", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {} });
      const data = await response.json() as { confirmationUrl?: string };

      expect(data.confirmationUrl).toBe("https://shopify.com/billing/confirm");
      expect(createSubscription).toHaveBeenCalled();
    });

    it("should handle upgrade error", async () => {
      vi.mocked(createSubscription).mockResolvedValue({
        error: "Billing not available",
      });

      const formData = new FormData();
      formData.append("action", "upgrade");
      formData.append("plan", "PROFESSIONAL");

      const request = new Request("http://localhost/app/settings", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {} });

      expect(response.status).toBe(400);
    });

    it("should handle cancel action", async () => {
      vi.mocked(cancelSubscription).mockResolvedValue({
        success: true,
      });

      const formData = new FormData();
      formData.append("action", "cancel");

      const request = new Request("http://localhost/app/settings", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {} });
      const data = await response.json() as { success?: boolean; message?: string };

      expect(data.success).toBe(true);
      expect(data.message).toBe("Subscription cancelled");
    });

    it("should handle cancel error", async () => {
      vi.mocked(cancelSubscription).mockResolvedValue({
        success: false,
        error: "Cannot cancel",
      });

      const formData = new FormData();
      formData.append("action", "cancel");

      const request = new Request("http://localhost/app/settings", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {} });

      expect(response.status).toBe(400);
    });

    it("should handle updatePOS action", async () => {
      vi.mocked(updatePOSSettings).mockResolvedValue({} as never);

      const formData = new FormData();
      formData.append("action", "updatePOS");
      formData.append("posEnabled", "true");
      formData.append("posShowTierInfo", "false");
      formData.append("posStaffOverride", "true");

      const request = new Request("http://localhost/app/settings", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {} });
      const data = await response.json() as { success?: boolean };

      expect(data.success).toBe(true);
      expect(updatePOSSettings).toHaveBeenCalledWith("test.myshopify.com", {
        posEnabled: true,
        posShowTierInfo: false,
        posStaffOverride: true,
      });
    });

    it("should handle unknown action", async () => {
      const formData = new FormData();
      formData.append("action", "unknown");

      const request = new Request("http://localhost/app/settings", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {} });

      expect(response.status).toBe(400);
    });
  });

  // ============================================================================
  // COMPONENT RENDER TESTS
  // ============================================================================

  describe("Settings component", () => {
    it("should render settings page title", () => {
      renderWithPolaris(<Settings />);

      expect(screen.getByText("Settings")).toBeInTheDocument();
    });

    it("should render current plan section", () => {
      renderWithPolaris(<Settings />);

      expect(screen.getByRole("heading", { name: "Current Plan" })).toBeInTheDocument();
      expect(screen.getByText("FREE")).toBeInTheDocument();
    });

    it("should render plan features", () => {
      renderWithPolaris(<Settings />);

      expect(screen.getByText(/Rule Limit:/)).toBeInTheDocument();
      expect(screen.getByText(/Customer Tags:/)).toBeInTheDocument();
      expect(screen.getByText(/CSS Editor:/)).toBeInTheDocument();
    });

    it("should render available plans", () => {
      renderWithPolaris(<Settings />);

      expect(screen.getByText("Available Plans")).toBeInTheDocument();
      expect(screen.getByText("Free")).toBeInTheDocument();
      expect(screen.getByText("Growth")).toBeInTheDocument();
      expect(screen.getByText("Professional")).toBeInTheDocument();
    });

    it("should render sync statistics", () => {
      renderWithPolaris(<Settings />);

      expect(screen.getByText("Sync Statistics")).toBeInTheDocument();
      expect(screen.getByText("Total Syncs")).toBeInTheDocument();
      expect(screen.getByText("Success Rate")).toBeInTheDocument();
      expect(screen.getByText("Last Sync")).toBeInTheDocument();
    });

    it("should render POS settings", () => {
      renderWithPolaris(<Settings />);

      expect(screen.getByText("POS Integration")).toBeInTheDocument();
      expect(screen.getByText("Enable POS Integration")).toBeInTheDocument();
      expect(screen.getByText("Show Tier Information")).toBeInTheDocument();
      expect(screen.getByText("Allow Staff Override")).toBeInTheDocument();
    });

    it("should render shop information", () => {
      renderWithPolaris(<Settings />);

      expect(screen.getByText("Shop Information")).toBeInTheDocument();
      expect(screen.getByText(/Domain:/)).toBeInTheDocument();
    });

    it("should show upgrade buttons for free plan", () => {
      renderWithPolaris(<Settings />);

      expect(screen.getByText("Upgrade to Growth")).toBeInTheDocument();
      expect(screen.getByText("Upgrade to Pro")).toBeInTheDocument();
    });

    it("should show cancel button for paid plans", () => {
      mockLoaderData = {
        ...mockLoaderData,
        shop: {
          domain: "test.myshopify.com",
          name: "Test Store",
          email: "test@example.com",
          plan: "GROWTH",
        },
      };

      renderWithPolaris(<Settings />);

      expect(screen.getByText("Cancel Subscription")).toBeInTheDocument();
    });

    it("should show error banner on action error", () => {
      mockActionData = { error: "Something went wrong" };

      renderWithPolaris(<Settings />);

      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });

    it("should show success banner on successful action", () => {
      mockActionData = { success: true, message: "Settings saved" };

      renderWithPolaris(<Settings />);

      expect(screen.getByText("Settings saved")).toBeInTheDocument();
    });

    it("should handle POS checkbox toggle", () => {
      renderWithPolaris(<Settings />);

      const posEnabledCheckbox = screen.getByLabelText("Enable POS Integration");
      expect(posEnabledCheckbox).toBeChecked();

      fireEvent.click(posEnabledCheckbox);
      // State updates internally
    });

    it("should call submit on Save POS Settings click", () => {
      renderWithPolaris(<Settings />);

      const saveButton = screen.getByText("Save POS Settings");
      fireEvent.click(saveButton);

      expect(mockSubmit).toHaveBeenCalled();
    });
  });
});
