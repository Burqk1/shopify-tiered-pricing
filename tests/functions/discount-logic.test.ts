/**
 * Discount Function Logic Tests
 *
 * Tests the core discount calculation logic used in the Shopify Function.
 */

import { describe, it, expect } from "vitest";

// Types (matching the function types)
interface CompressedRule {
  id: string;
  n: string;
  p: number;
  c: { t: string; v: string }[];
  t: { min: number; max?: number; vt: string; v: number; m?: string }[];
}

// Re-implement the core logic for testing
function findApplicableRule(
  rules: CompressedRule[],
  productId: string,
  customerTags: string[]
): CompressedRule | null {
  for (const rule of rules) {
    let conditionsMet = false;

    for (const condition of rule.c) {
      switch (condition.t) {
        case "ALL_PRODUCTS":
          conditionsMet = true;
          break;
        case "PRODUCT":
          if (condition.v === productId) {
            conditionsMet = true;
          }
          break;
        case "CUSTOMER_TAG":
          if (customerTags.includes(condition.v)) {
            conditionsMet = true;
          }
          break;
      }
      if (conditionsMet) break;
    }

    if (conditionsMet) {
      return rule;
    }
  }
  return null;
}

function findApplicableTier(
  tiers: CompressedRule["t"],
  quantity: number
): CompressedRule["t"][0] | null {
  const applicableTiers = tiers.filter(
    (tier) =>
      quantity >= tier.min &&
      (tier.max === undefined || tier.max === null || quantity <= tier.max)
  );

  if (applicableTiers.length === 0) {
    return null;
  }

  return applicableTiers.reduce((best, current) =>
    current.min > best.min ? current : best
  );
}

function calculateDiscount(tier: CompressedRule["t"][0], unitPrice: number): number {
  if (tier.vt === "PERCENTAGE") {
    return unitPrice * (tier.v / 100);
  }
  return tier.v;
}

describe("Discount Function Logic", () => {
  describe("findApplicableRule", () => {
    const rules: CompressedRule[] = [
      {
        id: "rule1",
        n: "VIP Discount",
        p: 10,
        c: [{ t: "CUSTOMER_TAG", v: "vip" }],
        t: [{ min: 1, vt: "PERCENTAGE", v: 15 }],
      },
      {
        id: "rule2",
        n: "Product Discount",
        p: 5,
        c: [{ t: "PRODUCT", v: "gid://shopify/Product/123" }],
        t: [{ min: 5, vt: "PERCENTAGE", v: 10 }],
      },
      {
        id: "rule3",
        n: "All Products",
        p: 0,
        c: [{ t: "ALL_PRODUCTS", v: "*" }],
        t: [{ min: 10, vt: "PERCENTAGE", v: 5 }],
      },
    ];

    it("should match VIP customer first (highest priority)", () => {
      const result = findApplicableRule(rules, "gid://shopify/Product/123", ["vip"]);
      expect(result?.id).toBe("rule1");
    });

    it("should match product-specific rule when no customer tags", () => {
      const result = findApplicableRule(rules, "gid://shopify/Product/123", []);
      expect(result?.id).toBe("rule2");
    });

    it("should match ALL_PRODUCTS for unmatched products", () => {
      const result = findApplicableRule(rules, "gid://shopify/Product/999", []);
      expect(result?.id).toBe("rule3");
    });

    it("should return null when no rules match", () => {
      const emptyRules: CompressedRule[] = [];
      const result = findApplicableRule(emptyRules, "gid://shopify/Product/123", []);
      expect(result).toBeNull();
    });
  });

  describe("findApplicableTier", () => {
    const tiers: CompressedRule["t"] = [
      { min: 1, max: 4, vt: "PERCENTAGE", v: 0 },
      { min: 5, max: 9, vt: "PERCENTAGE", v: 10 },
      { min: 10, max: 24, vt: "PERCENTAGE", v: 15 },
      { min: 25, vt: "PERCENTAGE", v: 20 },
    ];

    it("should return no tier for quantity below minimum", () => {
      // If min tier starts at 1, quantity 0 should not match
      const tiersStartingAt5 = tiers.slice(1);
      const result = findApplicableTier(tiersStartingAt5, 3);
      expect(result).toBeNull();
    });

    it("should return first tier for small quantity", () => {
      const result = findApplicableTier(tiers, 3);
      expect(result?.min).toBe(1);
      expect(result?.v).toBe(0);
    });

    it("should return second tier for medium quantity", () => {
      const result = findApplicableTier(tiers, 7);
      expect(result?.min).toBe(5);
      expect(result?.v).toBe(10);
    });

    it("should return third tier for larger quantity", () => {
      const result = findApplicableTier(tiers, 15);
      expect(result?.min).toBe(10);
      expect(result?.v).toBe(15);
    });

    it("should return highest tier for large quantity", () => {
      const result = findApplicableTier(tiers, 100);
      expect(result?.min).toBe(25);
      expect(result?.v).toBe(20);
    });

    it("should handle exact boundary values", () => {
      const result5 = findApplicableTier(tiers, 5);
      expect(result5?.min).toBe(5);

      const result10 = findApplicableTier(tiers, 10);
      expect(result10?.min).toBe(10);

      const result25 = findApplicableTier(tiers, 25);
      expect(result25?.min).toBe(25);
    });

    it("should handle tier with no max (unlimited)", () => {
      const result = findApplicableTier(tiers, 1000);
      expect(result?.min).toBe(25);
    });
  });

  describe("calculateDiscount", () => {
    it("should calculate percentage discount correctly", () => {
      const tier = { min: 10, vt: "PERCENTAGE", v: 20 };
      const discount = calculateDiscount(tier, 100);
      expect(discount).toBe(20); // 20% of $100
    });

    it("should calculate fixed amount discount correctly", () => {
      const tier = { min: 10, vt: "FIXED_AMOUNT", v: 5 };
      const discount = calculateDiscount(tier, 100);
      expect(discount).toBe(5); // $5 off
    });

    it("should handle decimal percentages", () => {
      const tier = { min: 10, vt: "PERCENTAGE", v: 12.5 };
      const discount = calculateDiscount(tier, 80);
      expect(discount).toBe(10); // 12.5% of $80
    });

    it("should handle zero discount", () => {
      const tier = { min: 1, vt: "PERCENTAGE", v: 0 };
      const discount = calculateDiscount(tier, 100);
      expect(discount).toBe(0);
    });
  });

  describe("Priority-based rule selection", () => {
    it("should select highest priority rule when multiple match", () => {
      const rules: CompressedRule[] = [
        {
          id: "low",
          n: "Low Priority",
          p: 1,
          c: [{ t: "ALL_PRODUCTS", v: "*" }],
          t: [{ min: 1, vt: "PERCENTAGE", v: 5 }],
        },
        {
          id: "high",
          n: "High Priority",
          p: 10,
          c: [{ t: "ALL_PRODUCTS", v: "*" }],
          t: [{ min: 1, vt: "PERCENTAGE", v: 20 }],
        },
        {
          id: "medium",
          n: "Medium Priority",
          p: 5,
          c: [{ t: "ALL_PRODUCTS", v: "*" }],
          t: [{ min: 1, vt: "PERCENTAGE", v: 10 }],
        },
      ];

      // Sort by priority (as the function does)
      const sortedRules = [...rules].sort((a, b) => b.p - a.p);
      const result = findApplicableRule(sortedRules, "any-product", []);

      expect(result?.id).toBe("high");
      expect(result?.t[0].v).toBe(20);
    });
  });
});
