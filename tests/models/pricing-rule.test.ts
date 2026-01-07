/**
 * Pricing Rule Model Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma
vi.mock("~/db.server", () => ({
  default: {
    pricingRule: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    ruleCondition: {
      deleteMany: vi.fn(),
    },
    discountTier: {
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn((callback) => callback({
      ruleCondition: { deleteMany: vi.fn() },
      discountTier: { deleteMany: vi.fn() },
      pricingRule: { update: vi.fn() },
    })),
  },
}));

import prisma from "~/db.server";
import {
  validateTiers,
  getPricingRule,
  getPricingRules,
  getActiveRulesForSync,
  createPricingRule,
  updatePricingRule,
  updateRuleStatus,
  markRuleSynced,
  deletePricingRule,
  archivePricingRule,
  duplicatePricingRule,
} from "~/models/pricing-rule.server";

describe("Pricing Rule Model", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // VALIDATION TESTS
  // ============================================================================

  describe("validateTiers", () => {
    describe("validation rules", () => {
      it("should reject empty tiers array", () => {
        const result = validateTiers([]);
        expect(result.valid).toBe(false);
        expect(result.error).toBe("At least one tier is required");
      });

      it("should accept valid single tier", () => {
        const result = validateTiers([
          { minQuantity: 5, maxQuantity: null },
        ]);
        expect(result.valid).toBe(true);
      });

      it("should accept valid multiple tiers", () => {
        const result = validateTiers([
          { minQuantity: 5, maxQuantity: 9 },
          { minQuantity: 10, maxQuantity: 24 },
          { minQuantity: 25, maxQuantity: null },
        ]);
        expect(result.valid).toBe(true);
      });

      it("should reject negative minQuantity", () => {
        const result = validateTiers([
          { minQuantity: -1, maxQuantity: null },
        ]);
        expect(result.valid).toBe(false);
        expect(result.error).toBe("Minimum quantity must be at least 1");
      });

      it("should reject zero minQuantity", () => {
        const result = validateTiers([
          { minQuantity: 0, maxQuantity: null },
        ]);
        expect(result.valid).toBe(false);
        expect(result.error).toBe("Minimum quantity must be at least 1");
      });

      it("should reject maxQuantity less than minQuantity", () => {
        const result = validateTiers([
          { minQuantity: 10, maxQuantity: 5 },
        ]);
        expect(result.valid).toBe(false);
        expect(result.error).toBe("Maximum quantity cannot be less than minimum");
      });

      it("should accept maxQuantity equal to minQuantity", () => {
        const result = validateTiers([
          { minQuantity: 10, maxQuantity: 10 },
        ]);
        expect(result.valid).toBe(true);
      });

      it("should reject overlapping tiers", () => {
        const result = validateTiers([
          { minQuantity: 5, maxQuantity: 15 },
          { minQuantity: 10, maxQuantity: 20 },
        ]);
        expect(result.valid).toBe(false);
        expect(result.error).toBe("Tier ranges cannot overlap");
      });

      it("should reject adjacent overlapping tiers", () => {
        const result = validateTiers([
          { minQuantity: 5, maxQuantity: 10 },
          { minQuantity: 10, maxQuantity: 20 },
        ]);
        expect(result.valid).toBe(false);
        expect(result.error).toBe("Tier ranges cannot overlap");
      });

      it("should accept properly spaced tiers", () => {
        const result = validateTiers([
          { minQuantity: 5, maxQuantity: 9 },
          { minQuantity: 10, maxQuantity: 19 },
          { minQuantity: 20, maxQuantity: null },
        ]);
        expect(result.valid).toBe(true);
      });

      it("should handle unsorted tiers correctly", () => {
        // Tiers in reverse order should still validate correctly
        const result = validateTiers([
          { minQuantity: 25, maxQuantity: null },
          { minQuantity: 5, maxQuantity: 9 },
          { minQuantity: 10, maxQuantity: 24 },
        ]);
        expect(result.valid).toBe(true);
      });
    });

    describe("discount value validation", () => {
      it("should reject negative discount value", () => {
        const result = validateTiers([
          { minQuantity: 5, maxQuantity: null, valueType: "PERCENTAGE", value: -10 },
        ]);
        expect(result.valid).toBe(false);
        expect(result.error).toBe("Discount value cannot be negative");
      });

      it("should reject percentage discount over 100%", () => {
        const result = validateTiers([
          { minQuantity: 5, maxQuantity: null, valueType: "PERCENTAGE", value: 150 },
        ]);
        expect(result.valid).toBe(false);
        expect(result.error).toBe("Percentage discount cannot exceed 100%");
      });

      it("should accept percentage discount at 100%", () => {
        const result = validateTiers([
          { minQuantity: 5, maxQuantity: null, valueType: "PERCENTAGE", value: 100 },
        ]);
        expect(result.valid).toBe(true);
      });

      it("should accept valid percentage discount", () => {
        const result = validateTiers([
          { minQuantity: 5, maxQuantity: null, valueType: "PERCENTAGE", value: 25 },
        ]);
        expect(result.valid).toBe(true);
      });

      it("should allow fixed amount over 100", () => {
        const result = validateTiers([
          { minQuantity: 5, maxQuantity: null, valueType: "FIXED_AMOUNT", value: 150 },
        ]);
        expect(result.valid).toBe(true);
      });

      it("should accept zero discount value", () => {
        const result = validateTiers([
          { minQuantity: 5, maxQuantity: null, valueType: "PERCENTAGE", value: 0 },
        ]);
        expect(result.valid).toBe(true);
      });
    });
  });

  // ============================================================================
  // QUERY TESTS
  // ============================================================================

  describe("getPricingRule", () => {
    it("should return rule with conditions and tiers", async () => {
      const mockRule = {
        id: "rule-1",
        name: "Test Rule",
        conditions: [{ id: "cond-1", type: "PRODUCT", value: "prod-1" }],
        tiers: [{ id: "tier-1", minQuantity: 5, value: 10 }],
      };

      vi.mocked(prisma.pricingRule.findUnique).mockResolvedValue(mockRule as never);

      const result = await getPricingRule("rule-1");

      expect(prisma.pricingRule.findUnique).toHaveBeenCalledWith({
        where: { id: "rule-1" },
        include: {
          conditions: true,
          tiers: { orderBy: { minQuantity: "asc" } },
        },
      });
      expect(result?.conditions).toHaveLength(1);
      expect(result?.tiers).toHaveLength(1);
    });

    it("should return null for non-existent rule", async () => {
      vi.mocked(prisma.pricingRule.findUnique).mockResolvedValue(null);

      const result = await getPricingRule("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("getPricingRules", () => {
    it("should return all non-archived rules for shop", async () => {
      const mockRules = [
        { id: "rule-1", status: "ACTIVE", conditions: [], tiers: [] },
        { id: "rule-2", status: "DRAFT", conditions: [], tiers: [] },
      ];

      vi.mocked(prisma.pricingRule.findMany).mockResolvedValue(mockRules as never);

      const result = await getPricingRules("shop-1");

      expect(prisma.pricingRule.findMany).toHaveBeenCalledWith({
        where: {
          shopId: "shop-1",
          status: { not: "ARCHIVED" },
        },
        include: {
          conditions: true,
          tiers: { orderBy: { minQuantity: "asc" } },
        },
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      });
      expect(result).toHaveLength(2);
    });

    it("should filter by specific status", async () => {
      vi.mocked(prisma.pricingRule.findMany).mockResolvedValue([]);

      await getPricingRules("shop-1", { status: "ACTIVE" });

      expect(prisma.pricingRule.findMany).toHaveBeenCalledWith({
        where: {
          shopId: "shop-1",
          status: "ACTIVE",
        },
        include: expect.any(Object),
        orderBy: expect.any(Array),
      });
    });

    it("should filter by multiple statuses", async () => {
      vi.mocked(prisma.pricingRule.findMany).mockResolvedValue([]);

      await getPricingRules("shop-1", { status: ["ACTIVE", "PAUSED"] });

      expect(prisma.pricingRule.findMany).toHaveBeenCalledWith({
        where: {
          shopId: "shop-1",
          status: { in: ["ACTIVE", "PAUSED"] },
        },
        include: expect.any(Object),
        orderBy: expect.any(Array),
      });
    });

    it("should include archived when specified", async () => {
      vi.mocked(prisma.pricingRule.findMany).mockResolvedValue([]);

      await getPricingRules("shop-1", { includeArchived: true });

      expect(prisma.pricingRule.findMany).toHaveBeenCalledWith({
        where: {
          shopId: "shop-1",
        },
        include: expect.any(Object),
        orderBy: expect.any(Array),
      });
    });
  });

  describe("getActiveRulesForSync", () => {
    it("should return only active rules within date range", async () => {
      const mockRules = [
        { id: "rule-1", status: "ACTIVE", conditions: [], tiers: [] },
      ];

      vi.mocked(prisma.pricingRule.findMany).mockResolvedValue(mockRules as never);

      const result = await getActiveRulesForSync("shop-1");

      expect(prisma.pricingRule.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          shopId: "shop-1",
          status: "ACTIVE",
        }),
        include: {
          conditions: true,
          tiers: { orderBy: { minQuantity: "asc" } },
        },
        orderBy: { priority: "desc" },
      });
      expect(result).toHaveLength(1);
    });
  });

  // ============================================================================
  // MUTATION TESTS
  // ============================================================================

  describe("createPricingRule", () => {
    it("should create rule with conditions and tiers", async () => {
      const mockCreated = {
        id: "rule-1",
        shopId: "shop-1",
        name: "Bulk Discount",
        conditions: [],
        tiers: [],
      };

      vi.mocked(prisma.pricingRule.create).mockResolvedValue(mockCreated as never);

      const result = await createPricingRule({
        shopId: "shop-1",
        name: "Bulk Discount",
        conditions: [{ type: "PRODUCT", value: "prod-1" }],
        tiers: [{ minQuantity: 5, valueType: "PERCENTAGE", value: 10 }],
      });

      expect(prisma.pricingRule.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          shopId: "shop-1",
          name: "Bulk Discount",
          priority: 0,
          conditions: {
            create: [{ type: "PRODUCT", value: "prod-1", label: undefined }],
          },
          tiers: {
            create: expect.arrayContaining([
              expect.objectContaining({
                minQuantity: 5,
                valueType: "PERCENTAGE",
              }),
            ]),
          },
        }),
        include: expect.any(Object),
      });
      expect(result.id).toBe("rule-1");
    });

    it("should set custom priority", async () => {
      vi.mocked(prisma.pricingRule.create).mockResolvedValue({ id: "rule-1" } as never);

      await createPricingRule({
        shopId: "shop-1",
        name: "High Priority",
        priority: 100,
        conditions: [],
        tiers: [{ minQuantity: 1, valueType: "PERCENTAGE", value: 5 }],
      });

      expect(prisma.pricingRule.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          priority: 100,
        }),
        include: expect.any(Object),
      });
    });

    it("should set schedule dates", async () => {
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-12-31");

      vi.mocked(prisma.pricingRule.create).mockResolvedValue({ id: "rule-1" } as never);

      await createPricingRule({
        shopId: "shop-1",
        name: "Scheduled Rule",
        startDate,
        endDate,
        conditions: [],
        tiers: [{ minQuantity: 1, valueType: "PERCENTAGE", value: 5 }],
      });

      expect(prisma.pricingRule.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          startDate,
          endDate,
        }),
        include: expect.any(Object),
      });
    });
  });

  describe("updatePricingRule", () => {
    it("should update rule properties", async () => {
      const mockTransaction = vi.fn((callback) =>
        callback({
          ruleCondition: { deleteMany: vi.fn() },
          discountTier: { deleteMany: vi.fn() },
          pricingRule: {
            update: vi.fn().mockResolvedValue({ id: "rule-1", name: "Updated" }),
          },
        })
      );
      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction as never);

      await updatePricingRule("rule-1", { name: "Updated Rule" });

      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe("updateRuleStatus", () => {
    it("should update status to ACTIVE", async () => {
      vi.mocked(prisma.pricingRule.update).mockResolvedValue({
        id: "rule-1",
        status: "ACTIVE",
      } as never);

      await updateRuleStatus("rule-1", "ACTIVE");

      expect(prisma.pricingRule.update).toHaveBeenCalledWith({
        where: { id: "rule-1" },
        data: { status: "ACTIVE" },
      });
    });

    it("should clear sync status when deactivating", async () => {
      vi.mocked(prisma.pricingRule.update).mockResolvedValue({
        id: "rule-1",
        status: "PAUSED",
      } as never);

      await updateRuleStatus("rule-1", "PAUSED");

      expect(prisma.pricingRule.update).toHaveBeenCalledWith({
        where: { id: "rule-1" },
        data: {
          status: "PAUSED",
          syncedAt: null,
          syncError: null,
        },
      });
    });
  });

  describe("markRuleSynced", () => {
    it("should mark rule as synced with timestamp", async () => {
      vi.mocked(prisma.pricingRule.update).mockResolvedValue({ id: "rule-1" } as never);

      await markRuleSynced("rule-1");

      expect(prisma.pricingRule.update).toHaveBeenCalledWith({
        where: { id: "rule-1" },
        data: {
          syncedAt: expect.any(Date),
          syncError: null,
        },
      });
    });

    it("should mark rule with sync error", async () => {
      vi.mocked(prisma.pricingRule.update).mockResolvedValue({ id: "rule-1" } as never);

      await markRuleSynced("rule-1", "API Error");

      expect(prisma.pricingRule.update).toHaveBeenCalledWith({
        where: { id: "rule-1" },
        data: {
          syncedAt: undefined,
          syncError: "API Error",
        },
      });
    });
  });

  describe("deletePricingRule", () => {
    it("should delete rule", async () => {
      vi.mocked(prisma.pricingRule.delete).mockResolvedValue({ id: "rule-1" } as never);

      await deletePricingRule("rule-1");

      expect(prisma.pricingRule.delete).toHaveBeenCalledWith({
        where: { id: "rule-1" },
      });
    });
  });

  describe("archivePricingRule", () => {
    it("should archive rule and clear sync status", async () => {
      vi.mocked(prisma.pricingRule.update).mockResolvedValue({
        id: "rule-1",
        status: "ARCHIVED",
      } as never);

      await archivePricingRule("rule-1");

      expect(prisma.pricingRule.update).toHaveBeenCalledWith({
        where: { id: "rule-1" },
        data: {
          status: "ARCHIVED",
          syncedAt: null,
          syncError: null,
        },
      });
    });
  });

  describe("duplicatePricingRule", () => {
    it("should duplicate rule with new name", async () => {
      const mockOriginal = {
        id: "rule-1",
        shopId: "shop-1",
        name: "Original Rule",
        description: "Test",
        priority: 10,
        startDate: null,
        endDate: null,
        conditions: [{ type: "PRODUCT", value: "prod-1", label: "Product" }],
        tiers: [{ minQuantity: 5, maxQuantity: null, valueType: "PERCENTAGE", value: 10, message: null }],
      };

      vi.mocked(prisma.pricingRule.findUnique).mockResolvedValue(mockOriginal as never);
      vi.mocked(prisma.pricingRule.create).mockResolvedValue({
        ...mockOriginal,
        id: "rule-2",
        name: "Duplicated",
      } as never);

      await duplicatePricingRule("rule-1", "Duplicated");

      expect(prisma.pricingRule.findUnique).toHaveBeenCalledWith({
        where: { id: "rule-1" },
        include: expect.any(Object),
      });
      expect(prisma.pricingRule.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: "Duplicated",
          shopId: "shop-1",
        }),
        include: expect.any(Object),
      });
    });

    it("should use default name if not provided", async () => {
      const mockOriginal = {
        id: "rule-1",
        shopId: "shop-1",
        name: "Original Rule",
        description: null,
        priority: 0,
        startDate: null,
        endDate: null,
        conditions: [],
        tiers: [{ minQuantity: 1, maxQuantity: null, valueType: "PERCENTAGE", value: 5, message: null }],
      };

      vi.mocked(prisma.pricingRule.findUnique).mockResolvedValue(mockOriginal as never);
      vi.mocked(prisma.pricingRule.create).mockResolvedValue({
        ...mockOriginal,
        id: "rule-2",
        name: "Original Rule (Copy)",
      } as never);

      await duplicatePricingRule("rule-1");

      expect(prisma.pricingRule.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: "Original Rule (Copy)",
        }),
        include: expect.any(Object),
      });
    });

    it("should throw error if rule not found", async () => {
      vi.mocked(prisma.pricingRule.findUnique).mockResolvedValue(null);

      await expect(duplicatePricingRule("non-existent")).rejects.toThrow(
        "Rule non-existent not found"
      );
    });
  });
});
