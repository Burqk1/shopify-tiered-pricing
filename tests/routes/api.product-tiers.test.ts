/**
 * API Product Tiers Route Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock modules before imports
vi.mock("~/models/pricing-rule.server", () => ({
  getActiveRulesForSync: vi.fn(),
}));

vi.mock("~/models/shop.server", () => ({
  getShopByDomain: vi.fn(),
}));

vi.mock("~/services/rate-limiter.server", () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true })),
  getRateLimitHeaders: vi.fn(() => ({})),
  getIdentifierFromRequest: vi.fn(() => "test-ip"),
  createRateLimitResponse: vi.fn(),
}));

import { loader } from "~/routes/api.product-tiers";
import { getActiveRulesForSync } from "~/models/pricing-rule.server";
import { getShopByDomain } from "~/models/shop.server";
import { checkRateLimit, createRateLimitResponse } from "~/services/rate-limiter.server";

describe("api.product-tiers loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = "test";
  });

  it("should return 400 if shop domain is missing", async () => {
    const request = new Request("http://localhost/api/product-tiers?product_id=123");

    const response = await loader({ request, params: {}, context: {} });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Missing shop domain");
  });

  it("should return 400 if product_id is missing", async () => {
    const request = new Request("http://localhost/api/product-tiers?shop=test.myshopify.com");

    const response = await loader({ request, params: {}, context: {} });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Missing product_id");
  });

  it("should return empty tiers if shop not found", async () => {
    vi.mocked(getShopByDomain).mockResolvedValue(null);

    const request = new Request(
      "http://localhost/api/product-tiers?shop=test.myshopify.com&product_id=123"
    );

    const response = await loader({ request, params: {}, context: {} });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.tiers).toEqual([]);
  });

  it("should return empty tiers if no matching rule", async () => {
    vi.mocked(getShopByDomain).mockResolvedValue({
      id: "shop-1",
      shopDomain: "test.myshopify.com",
    } as any);

    vi.mocked(getActiveRulesForSync).mockResolvedValue([
      {
        id: "rule-1",
        conditions: [{ type: "PRODUCT", value: "other-product" }],
        tiers: [],
      },
    ] as any);

    const request = new Request(
      "http://localhost/api/product-tiers?shop=test.myshopify.com&product_id=123"
    );

    const response = await loader({ request, params: {}, context: {} });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.tiers).toEqual([]);
  });

  it("should return tiers for matching product", async () => {
    vi.mocked(getShopByDomain).mockResolvedValue({
      id: "shop-1",
      shopDomain: "test.myshopify.com",
    } as any);

    vi.mocked(getActiveRulesForSync).mockResolvedValue([
      {
        id: "rule-1",
        name: "Volume Discount",
        conditions: [{ type: "PRODUCT", value: "123" }],
        tiers: [
          { minQuantity: 5, maxQuantity: 9, valueType: "PERCENTAGE", value: 10, message: null },
          { minQuantity: 10, maxQuantity: null, valueType: "PERCENTAGE", value: 20, message: "Best deal!" },
        ],
      },
    ] as any);

    const request = new Request(
      "http://localhost/api/product-tiers?shop=test.myshopify.com&product_id=123"
    );

    const response = await loader({ request, params: {}, context: {} });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ruleName).toBe("Volume Discount");
    expect(data.tiers).toHaveLength(2);
    expect(data.tiers[0]).toEqual({
      min: 5,
      max: 9,
      valueType: "PERCENTAGE",
      value: 10,
      message: null,
    });
    expect(data.tiers[1]).toEqual({
      min: 10,
      max: null,
      valueType: "PERCENTAGE",
      value: 20,
      message: "Best deal!",
    });
  });

  it("should return tiers for ALL_PRODUCTS condition", async () => {
    vi.mocked(getShopByDomain).mockResolvedValue({
      id: "shop-1",
      shopDomain: "test.myshopify.com",
    } as any);

    vi.mocked(getActiveRulesForSync).mockResolvedValue([
      {
        id: "rule-1",
        name: "Store-wide Discount",
        conditions: [{ type: "ALL_PRODUCTS", value: "*" }],
        tiers: [
          { minQuantity: 3, maxQuantity: null, valueType: "FIXED_AMOUNT", value: 5, message: null },
        ],
      },
    ] as any);

    const request = new Request(
      "http://localhost/api/product-tiers?shop=test.myshopify.com&product_id=any-product"
    );

    const response = await loader({ request, params: {}, context: {} });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ruleName).toBe("Store-wide Discount");
    expect(data.tiers).toHaveLength(1);
  });

  it("should respect rate limiting", async () => {
    vi.mocked(checkRateLimit).mockReturnValue({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60000,
      retryAfter: 60
    });
    vi.mocked(createRateLimitResponse).mockReturnValue(
      new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429 })
    );

    const request = new Request(
      "http://localhost/api/product-tiers?shop=test.myshopify.com&product_id=123"
    );

    const response = await loader({ request, params: {}, context: {} });

    expect(response.status).toBe(429);
  });
});
