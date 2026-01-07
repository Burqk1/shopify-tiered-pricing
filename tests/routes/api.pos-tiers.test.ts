/**
 * API POS Tiers Route Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock modules before imports
vi.mock("~/models/pricing-rule.server", () => ({
  getActiveRulesForSync: vi.fn(),
}));

vi.mock("~/models/shop.server", () => ({
  getShopByDomain: vi.fn(),
  getPOSSettings: vi.fn(),
  getCurrencySettings: vi.fn(),
}));

vi.mock("~/services/rate-limiter.server", () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true })),
  getRateLimitHeaders: vi.fn(() => ({})),
  getIdentifierFromRequest: vi.fn(() => "test-ip"),
  createRateLimitResponse: vi.fn(),
}));

import { loader, action } from "~/routes/api.pos-tiers";
import { getActiveRulesForSync } from "~/models/pricing-rule.server";
import { getShopByDomain, getPOSSettings, getCurrencySettings } from "~/models/shop.server";

describe("api.pos-tiers loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 400 if shop domain is missing", async () => {
    const request = new Request("http://localhost/api/pos-tiers?product_id=123");

    const response = await loader({ request, params: {}, context: {} });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Missing shop domain");
  });

  it("should return 400 if product_id and variant_id are missing", async () => {
    const request = new Request("http://localhost/api/pos-tiers?shop=test.myshopify.com");

    const response = await loader({ request, params: {}, context: {} });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Missing product_id or variant_id");
  });

  it("should return posEnabled: false if shop not found", async () => {
    vi.mocked(getShopByDomain).mockResolvedValue(null);

    const request = new Request(
      "http://localhost/api/pos-tiers?shop=test.myshopify.com&product_id=123"
    );

    const response = await loader({ request, params: {}, context: {} });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.posEnabled).toBe(false);
    expect(data.tiers).toEqual([]);
  });

  it("should return posEnabled: false if POS is disabled", async () => {
    vi.mocked(getShopByDomain).mockResolvedValue({
      id: "shop-1",
      shopDomain: "test.myshopify.com",
    } as any);

    vi.mocked(getPOSSettings).mockResolvedValue({
      posEnabled: false,
      posShowTierInfo: true,
      posStaffOverride: false,
    });

    const request = new Request(
      "http://localhost/api/pos-tiers?shop=test.myshopify.com&product_id=123"
    );

    const response = await loader({ request, params: {}, context: {} });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.posEnabled).toBe(false);
  });

  it("should return product tiers when POS is enabled", async () => {
    vi.mocked(getShopByDomain).mockResolvedValue({
      id: "shop-1",
      shopDomain: "test.myshopify.com",
    } as any);

    vi.mocked(getPOSSettings).mockResolvedValue({
      posEnabled: true,
      posShowTierInfo: true,
      posStaffOverride: false,
    });

    vi.mocked(getActiveRulesForSync).mockResolvedValue([
      {
        id: "rule-1",
        name: "POS Discount",
        conditions: [{ type: "PRODUCT", value: "123" }],
        tiers: [
          { minQuantity: 2, maxQuantity: null, valueType: "PERCENTAGE", value: 15, message: null },
        ],
      },
    ] as any);

    const request = new Request(
      "http://localhost/api/pos-tiers?shop=test.myshopify.com&product_id=123"
    );

    const response = await loader({ request, params: {}, context: {} });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.posEnabled).toBe(true);
    expect(data.showTierInfo).toBe(true);
    expect(data.products["123"]).toBeDefined();
    expect(data.products["123"].tiers).toHaveLength(1);
  });
});

describe("api.pos-tiers action (POST)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 405 for non-POST requests", async () => {
    const request = new Request("http://localhost/api/pos-tiers", {
      method: "PUT",
    });

    const response = await action({ request, params: {}, context: {} });
    const data = await response.json();

    expect(response.status).toBe(405);
    expect(data.error).toBe("Method not allowed");
  });

  it("should return 400 for invalid request body", async () => {
    const request = new Request("http://localhost/api/pos-tiers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invalid: "data" }),
    });

    const response = await action({ request, params: {}, context: {} });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid request body");
  });

  it("should calculate discounts for cart items", async () => {
    vi.mocked(getShopByDomain).mockResolvedValue({
      id: "shop-1",
      shopDomain: "test.myshopify.com",
    } as any);

    vi.mocked(getPOSSettings).mockResolvedValue({
      posEnabled: true,
      posShowTierInfo: true,
      posStaffOverride: false,
    });

    vi.mocked(getCurrencySettings).mockResolvedValue({
      currency: "TRY",
      currencySymbol: "₺",
    });

    vi.mocked(getActiveRulesForSync).mockResolvedValue([
      {
        id: "rule-1",
        name: "Quantity Discount",
        conditions: [{ type: "ALL_PRODUCTS", value: "*" }],
        tiers: [
          { minQuantity: 5, maxQuantity: null, valueType: "PERCENTAGE", value: 10, message: null },
        ],
      },
    ] as any);

    const request = new Request("http://localhost/api/pos-tiers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shopDomain: "test.myshopify.com",
        items: [
          { productId: "product-1", quantity: 5, price: 100 },
          { productId: "product-2", quantity: 2, price: 50 },
        ],
      }),
    });

    const response = await action({ request, params: {}, context: {} });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.currency).toBe("TRY");
    expect(data.discounts).toHaveLength(2);

    // First item should have 10% discount (quantity >= 5)
    expect(data.discounts[0].discountAmount).toBe(10); // 100 * 10%
    expect(data.discounts[0].discountedPrice).toBe(90);

    // Second item should have no discount (quantity < 5)
    expect(data.discounts[1].discountAmount).toBe(0);
    expect(data.discounts[1].discountedPrice).toBe(50);

    // Total discount = 10 * 5 = 50 (discount per item * quantity)
    expect(data.totalDiscount).toBe(50);
  });

  it("should handle FIXED_AMOUNT discount type", async () => {
    vi.mocked(getShopByDomain).mockResolvedValue({
      id: "shop-1",
      shopDomain: "test.myshopify.com",
    } as any);

    vi.mocked(getPOSSettings).mockResolvedValue({
      posEnabled: true,
      posShowTierInfo: true,
      posStaffOverride: false,
    });

    vi.mocked(getCurrencySettings).mockResolvedValue(null);

    vi.mocked(getActiveRulesForSync).mockResolvedValue([
      {
        id: "rule-1",
        name: "Fixed Discount",
        conditions: [{ type: "ALL_PRODUCTS", value: "*" }],
        tiers: [
          { minQuantity: 3, maxQuantity: null, valueType: "FIXED_AMOUNT", value: 5, message: null },
        ],
      },
    ] as any);

    const request = new Request("http://localhost/api/pos-tiers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shopDomain: "test.myshopify.com",
        items: [{ productId: "product-1", quantity: 3, price: 25 }],
      }),
    });

    const response = await action({ request, params: {}, context: {} });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.currency).toBe("USD"); // Default fallback
    expect(data.discounts[0].discountAmount).toBe(5);
    expect(data.discounts[0].discountedPrice).toBe(20);
  });
});
