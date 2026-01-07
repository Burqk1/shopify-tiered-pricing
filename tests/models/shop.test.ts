/**
 * Shop Model Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma
vi.mock("~/db.server", () => ({
  default: {
    shop: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import prisma from "~/db.server";
import {
  getPlanFeatures,
  getOrCreateShop,
  getShopByDomain,
  getShopWithRules,
  getShopWithRuleCount,
  updateShopPlan,
  updateShopToken,
  deleteShop,
  canCreateRule,
  getCurrencySettings,
  updateCurrencySettings,
  getPOSSettings,
  updatePOSSettings,
} from "~/models/shop.server";

describe("Shop Model", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // PLAN FEATURES
  // ============================================================================

  describe("getPlanFeatures", () => {
    it("should return correct FREE plan features", () => {
      const features = getPlanFeatures("FREE");

      expect(features.ruleLimit).toBe(1);
      expect(features.customerTags).toBe(false);
      expect(features.cssEditor).toBe(false);
      expect(features.prioritySupport).toBe(false);
      expect(features.multiCurrency).toBe(false);
      expect(features.posIntegration).toBe(true);
    });

    it("should return correct GROWTH plan features", () => {
      const features = getPlanFeatures("GROWTH");

      expect(features.ruleLimit).toBe("unlimited");
      expect(features.customerTags).toBe(true);
      expect(features.cssEditor).toBe(true);
      expect(features.prioritySupport).toBe(false);
      expect(features.multiCurrency).toBe(false);
      expect(features.posIntegration).toBe(true);
    });

    it("should return correct PROFESSIONAL plan features", () => {
      const features = getPlanFeatures("PROFESSIONAL");

      expect(features.ruleLimit).toBe("unlimited");
      expect(features.customerTags).toBe(true);
      expect(features.cssEditor).toBe(true);
      expect(features.prioritySupport).toBe(true);
      expect(features.multiCurrency).toBe(true);
      expect(features.posIntegration).toBe(true);
    });
  });

  // ============================================================================
  // SHOP QUERIES
  // ============================================================================

  describe("getOrCreateShop", () => {
    it("should create new shop if not exists", async () => {
      const mockShop = {
        id: "shop-1",
        shopDomain: "test.myshopify.com",
        shopName: "Test Store",
      };

      vi.mocked(prisma.shop.upsert).mockResolvedValue(mockShop as never);

      const result = await getOrCreateShop("test.myshopify.com", {
        shopName: "Test Store",
        email: "test@example.com",
      });

      expect(prisma.shop.upsert).toHaveBeenCalledWith({
        where: { shopDomain: "test.myshopify.com" },
        update: {
          shopName: "Test Store",
          email: "test@example.com",
        },
        create: {
          shopDomain: "test.myshopify.com",
          shopName: "Test Store",
          email: "test@example.com",
          accessToken: undefined,
        },
      });
      expect(result.shopDomain).toBe("test.myshopify.com");
    });

    it("should update existing shop", async () => {
      vi.mocked(prisma.shop.upsert).mockResolvedValue({
        id: "shop-1",
        shopDomain: "test.myshopify.com",
        accessToken: "new-token",
      } as never);

      await getOrCreateShop("test.myshopify.com", {
        accessToken: "new-token",
      });

      expect(prisma.shop.upsert).toHaveBeenCalledWith({
        where: { shopDomain: "test.myshopify.com" },
        update: {
          accessToken: "new-token",
        },
        create: expect.any(Object),
      });
    });

    it("should handle minimal data", async () => {
      vi.mocked(prisma.shop.upsert).mockResolvedValue({
        id: "shop-1",
        shopDomain: "test.myshopify.com",
      } as never);

      await getOrCreateShop("test.myshopify.com");

      expect(prisma.shop.upsert).toHaveBeenCalledWith({
        where: { shopDomain: "test.myshopify.com" },
        update: {},
        create: {
          shopDomain: "test.myshopify.com",
          shopName: undefined,
          email: undefined,
          accessToken: undefined,
        },
      });
    });
  });

  describe("getShopByDomain", () => {
    it("should return shop by domain", async () => {
      const mockShop = {
        id: "shop-1",
        shopDomain: "test.myshopify.com",
        plan: "FREE",
      };

      vi.mocked(prisma.shop.findUnique).mockResolvedValue(mockShop as never);

      const result = await getShopByDomain("test.myshopify.com");

      expect(prisma.shop.findUnique).toHaveBeenCalledWith({
        where: { shopDomain: "test.myshopify.com" },
      });
      expect(result?.id).toBe("shop-1");
    });

    it("should return null for non-existent shop", async () => {
      vi.mocked(prisma.shop.findUnique).mockResolvedValue(null);

      const result = await getShopByDomain("nonexistent.myshopify.com");

      expect(result).toBeNull();
    });
  });

  describe("getShopWithRules", () => {
    it("should return shop with active rules", async () => {
      const mockShop = {
        id: "shop-1",
        shopDomain: "test.myshopify.com",
        rules: [
          {
            id: "rule-1",
            status: "ACTIVE",
            conditions: [],
            tiers: [],
          },
        ],
      };

      vi.mocked(prisma.shop.findUnique).mockResolvedValue(mockShop as never);

      const result = await getShopWithRules("test.myshopify.com");

      expect(prisma.shop.findUnique).toHaveBeenCalledWith({
        where: { shopDomain: "test.myshopify.com" },
        include: {
          rules: {
            where: { status: { not: "ARCHIVED" } },
            include: {
              conditions: true,
              tiers: { orderBy: { minQuantity: "asc" } },
            },
            orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
          },
        },
      });
      expect(result?.rules).toHaveLength(1);
    });
  });

  describe("getShopWithRuleCount", () => {
    it("should return shop with rule count", async () => {
      vi.mocked(prisma.shop.findUnique).mockResolvedValue({
        id: "shop-1",
        shopDomain: "test.myshopify.com",
        ruleLimit: 1,
        _count: { rules: 0 },
      } as never);

      const result = await getShopWithRuleCount("test.myshopify.com");

      expect(result?.activeRuleCount).toBe(0);
    });

    it("should return null for non-existent shop", async () => {
      vi.mocked(prisma.shop.findUnique).mockResolvedValue(null);

      const result = await getShopWithRuleCount("nonexistent.myshopify.com");

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // SHOP MUTATIONS
  // ============================================================================

  describe("updateShopPlan", () => {
    it("should update plan to FREE with limit 1", async () => {
      vi.mocked(prisma.shop.update).mockResolvedValue({
        id: "shop-1",
        plan: "FREE",
        ruleLimit: 1,
      } as never);

      await updateShopPlan("test.myshopify.com", "FREE");

      expect(prisma.shop.update).toHaveBeenCalledWith({
        where: { shopDomain: "test.myshopify.com" },
        data: { plan: "FREE", ruleLimit: 1 },
      });
    });

    it("should update plan to GROWTH with unlimited rules", async () => {
      vi.mocked(prisma.shop.update).mockResolvedValue({
        id: "shop-1",
        plan: "GROWTH",
        ruleLimit: -1,
      } as never);

      await updateShopPlan("test.myshopify.com", "GROWTH");

      expect(prisma.shop.update).toHaveBeenCalledWith({
        where: { shopDomain: "test.myshopify.com" },
        data: { plan: "GROWTH", ruleLimit: -1 },
      });
    });

    it("should update plan to PROFESSIONAL with unlimited rules", async () => {
      vi.mocked(prisma.shop.update).mockResolvedValue({
        id: "shop-1",
        plan: "PROFESSIONAL",
        ruleLimit: -1,
      } as never);

      await updateShopPlan("test.myshopify.com", "PROFESSIONAL");

      expect(prisma.shop.update).toHaveBeenCalledWith({
        where: { shopDomain: "test.myshopify.com" },
        data: { plan: "PROFESSIONAL", ruleLimit: -1 },
      });
    });
  });

  describe("updateShopToken", () => {
    it("should update access token", async () => {
      vi.mocked(prisma.shop.update).mockResolvedValue({
        id: "shop-1",
        accessToken: "new-token",
      } as never);

      await updateShopToken("test.myshopify.com", "new-token");

      expect(prisma.shop.update).toHaveBeenCalledWith({
        where: { shopDomain: "test.myshopify.com" },
        data: { accessToken: "new-token" },
      });
    });
  });

  describe("deleteShop", () => {
    it("should delete shop by domain", async () => {
      vi.mocked(prisma.shop.delete).mockResolvedValue({ id: "shop-1" } as never);

      await deleteShop("test.myshopify.com");

      expect(prisma.shop.delete).toHaveBeenCalledWith({
        where: { shopDomain: "test.myshopify.com" },
      });
    });
  });

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  describe("canCreateRule", () => {
    it("should return true for paid plan (unlimited)", async () => {
      vi.mocked(prisma.shop.findUnique).mockResolvedValue({
        id: "shop-1",
        ruleLimit: -1,
        _count: { rules: 10 },
      } as never);

      const result = await canCreateRule("test.myshopify.com");

      expect(result).toBe(true);
    });

    it("should return true for free plan under limit", async () => {
      vi.mocked(prisma.shop.findUnique).mockResolvedValue({
        id: "shop-1",
        ruleLimit: 1,
        _count: { rules: 0 },
      } as never);

      const result = await canCreateRule("test.myshopify.com");

      expect(result).toBe(true);
    });

    it("should return false for free plan at limit", async () => {
      vi.mocked(prisma.shop.findUnique).mockResolvedValue({
        id: "shop-1",
        ruleLimit: 1,
        _count: { rules: 1 },
      } as never);

      const result = await canCreateRule("test.myshopify.com");

      expect(result).toBe(false);
    });

    it("should return false for non-existent shop", async () => {
      vi.mocked(prisma.shop.findUnique).mockResolvedValue(null);

      const result = await canCreateRule("nonexistent.myshopify.com");

      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // CURRENCY SETTINGS
  // ============================================================================

  describe("getCurrencySettings", () => {
    it("should return currency settings", async () => {
      vi.mocked(prisma.shop.findUnique).mockResolvedValue({
        currency: "USD",
        currencySymbol: "$",
      } as never);

      const result = await getCurrencySettings("test.myshopify.com");

      expect(prisma.shop.findUnique).toHaveBeenCalledWith({
        where: { shopDomain: "test.myshopify.com" },
        select: { currency: true, currencySymbol: true },
      });
      expect(result?.currency).toBe("USD");
      expect(result?.currencySymbol).toBe("$");
    });

    it("should return null for non-existent shop", async () => {
      vi.mocked(prisma.shop.findUnique).mockResolvedValue(null);

      const result = await getCurrencySettings("nonexistent.myshopify.com");

      expect(result).toBeNull();
    });
  });

  describe("updateCurrencySettings", () => {
    it("should update currency settings", async () => {
      vi.mocked(prisma.shop.update).mockResolvedValue({
        id: "shop-1",
        currency: "EUR",
        currencySymbol: "€",
      } as never);

      await updateCurrencySettings("test.myshopify.com", {
        currency: "EUR",
        currencySymbol: "€",
      });

      expect(prisma.shop.update).toHaveBeenCalledWith({
        where: { shopDomain: "test.myshopify.com" },
        data: { currency: "EUR", currencySymbol: "€" },
      });
    });

    it("should update partial currency settings", async () => {
      vi.mocked(prisma.shop.update).mockResolvedValue({
        id: "shop-1",
        currency: "GBP",
      } as never);

      await updateCurrencySettings("test.myshopify.com", {
        currency: "GBP",
      });

      expect(prisma.shop.update).toHaveBeenCalledWith({
        where: { shopDomain: "test.myshopify.com" },
        data: { currency: "GBP" },
      });
    });
  });

  // ============================================================================
  // POS SETTINGS
  // ============================================================================

  describe("getPOSSettings", () => {
    it("should return POS settings", async () => {
      vi.mocked(prisma.shop.findUnique).mockResolvedValue({
        posEnabled: true,
        posShowTierInfo: true,
        posStaffOverride: false,
      } as never);

      const result = await getPOSSettings("test.myshopify.com");

      expect(prisma.shop.findUnique).toHaveBeenCalledWith({
        where: { shopDomain: "test.myshopify.com" },
        select: { posEnabled: true, posShowTierInfo: true, posStaffOverride: true },
      });
      expect(result?.posEnabled).toBe(true);
      expect(result?.posShowTierInfo).toBe(true);
      expect(result?.posStaffOverride).toBe(false);
    });

    it("should return null for non-existent shop", async () => {
      vi.mocked(prisma.shop.findUnique).mockResolvedValue(null);

      const result = await getPOSSettings("nonexistent.myshopify.com");

      expect(result).toBeNull();
    });
  });

  describe("updatePOSSettings", () => {
    it("should update POS settings", async () => {
      vi.mocked(prisma.shop.update).mockResolvedValue({
        id: "shop-1",
        posEnabled: true,
        posShowTierInfo: false,
        posStaffOverride: true,
      } as never);

      await updatePOSSettings("test.myshopify.com", {
        posEnabled: true,
        posShowTierInfo: false,
        posStaffOverride: true,
      });

      expect(prisma.shop.update).toHaveBeenCalledWith({
        where: { shopDomain: "test.myshopify.com" },
        data: {
          posEnabled: true,
          posShowTierInfo: false,
          posStaffOverride: true,
        },
      });
    });

    it("should update partial POS settings", async () => {
      vi.mocked(prisma.shop.update).mockResolvedValue({
        id: "shop-1",
        posEnabled: false,
      } as never);

      await updatePOSSettings("test.myshopify.com", {
        posEnabled: false,
      });

      expect(prisma.shop.update).toHaveBeenCalledWith({
        where: { shopDomain: "test.myshopify.com" },
        data: { posEnabled: false },
      });
    });
  });
});
