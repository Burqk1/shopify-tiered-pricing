/**
 * Analytics Export API Route Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("~/shopify.server", () => ({
  authenticate: {
    admin: vi.fn(),
  },
}));

vi.mock("~/models/shop.server", () => ({
  getShopByDomain: vi.fn(),
}));

vi.mock("~/models/analytics.server", () => ({
  exportAnalyticsCSV: vi.fn(),
  getAnalyticsSummaryCSV: vi.fn(),
}));

import { authenticate } from "~/shopify.server";
import { getShopByDomain } from "~/models/shop.server";
import { exportAnalyticsCSV, getAnalyticsSummaryCSV } from "~/models/analytics.server";

// Import loader after mocks
import { loader } from "~/routes/api.analytics-export";

describe("Analytics Export API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should export detailed CSV", async () => {
    vi.mocked(authenticate.admin).mockResolvedValue({
      session: { shop: "test.myshopify.com" },
    } as never);

    vi.mocked(getShopByDomain).mockResolvedValue({
      id: "shop-1",
      domain: "test.myshopify.com",
    } as never);

    vi.mocked(exportAnalyticsCSV).mockResolvedValue(
      "Date,Order Number,Product\n2024-01-15,1001,T-Shirt"
    );

    const request = new Request(
      "http://localhost/api/analytics-export?type=detailed&days=30"
    );

    const response = await loader({ request, params: {}, context: {} });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/csv");
    expect(response.headers.get("Content-Disposition")).toContain("attachment");
    expect(response.headers.get("Content-Disposition")).toContain(".csv");

    const body = await response.text();
    expect(body).toContain("Date,Order Number,Product");
    expect(exportAnalyticsCSV).toHaveBeenCalledWith("shop-1", 30);
  });

  it("should export summary CSV", async () => {
    vi.mocked(authenticate.admin).mockResolvedValue({
      session: { shop: "test.myshopify.com" },
    } as never);

    vi.mocked(getShopByDomain).mockResolvedValue({
      id: "shop-1",
      domain: "test.myshopify.com",
    } as never);

    vi.mocked(getAnalyticsSummaryCSV).mockResolvedValue(
      "Analytics Summary Report\nPeriod: Last 30 days"
    );

    const request = new Request(
      "http://localhost/api/analytics-export?type=summary&days=30"
    );

    const response = await loader({ request, params: {}, context: {} });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toContain("summary");

    const body = await response.text();
    expect(body).toContain("Analytics Summary Report");
    expect(getAnalyticsSummaryCSV).toHaveBeenCalledWith("shop-1", 30);
  });

  it("should default to 30 days if not specified", async () => {
    vi.mocked(authenticate.admin).mockResolvedValue({
      session: { shop: "test.myshopify.com" },
    } as never);

    vi.mocked(getShopByDomain).mockResolvedValue({
      id: "shop-1",
      domain: "test.myshopify.com",
    } as never);

    vi.mocked(exportAnalyticsCSV).mockResolvedValue("CSV content");

    const request = new Request(
      "http://localhost/api/analytics-export?type=detailed"
    );

    await loader({ request, params: {}, context: {} });

    expect(exportAnalyticsCSV).toHaveBeenCalledWith("shop-1", 30);
  });

  it("should default to detailed type if not specified", async () => {
    vi.mocked(authenticate.admin).mockResolvedValue({
      session: { shop: "test.myshopify.com" },
    } as never);

    vi.mocked(getShopByDomain).mockResolvedValue({
      id: "shop-1",
      domain: "test.myshopify.com",
    } as never);

    vi.mocked(exportAnalyticsCSV).mockResolvedValue("CSV content");

    const request = new Request(
      "http://localhost/api/analytics-export"
    );

    await loader({ request, params: {}, context: {} });

    expect(exportAnalyticsCSV).toHaveBeenCalled();
    expect(getAnalyticsSummaryCSV).not.toHaveBeenCalled();
  });

  it("should return 404 if shop not found", async () => {
    vi.mocked(authenticate.admin).mockResolvedValue({
      session: { shop: "test.myshopify.com" },
    } as never);

    vi.mocked(getShopByDomain).mockResolvedValue(null);

    const request = new Request(
      "http://localhost/api/analytics-export?type=detailed"
    );

    const response = await loader({ request, params: {}, context: {} });
    expect(response.status).toBe(404);
  });

  it("should handle custom days parameter", async () => {
    vi.mocked(authenticate.admin).mockResolvedValue({
      session: { shop: "test.myshopify.com" },
    } as never);

    vi.mocked(getShopByDomain).mockResolvedValue({
      id: "shop-1",
      domain: "test.myshopify.com",
    } as never);

    vi.mocked(exportAnalyticsCSV).mockResolvedValue("CSV content");

    const request = new Request(
      "http://localhost/api/analytics-export?type=detailed&days=90"
    );

    await loader({ request, params: {}, context: {} });

    expect(exportAnalyticsCSV).toHaveBeenCalledWith("shop-1", 90);
  });

  it("should include proper filename in Content-Disposition", async () => {
    vi.mocked(authenticate.admin).mockResolvedValue({
      session: { shop: "test.myshopify.com" },
    } as never);

    vi.mocked(getShopByDomain).mockResolvedValue({
      id: "shop-1",
      domain: "test.myshopify.com",
    } as never);

    vi.mocked(exportAnalyticsCSV).mockResolvedValue("CSV content");

    const request = new Request(
      "http://localhost/api/analytics-export?type=detailed"
    );

    const response = await loader({ request, params: {}, context: {} });

    const disposition = response.headers.get("Content-Disposition");
    expect(disposition).toContain("attachment");
    expect(disposition).toContain(".csv");
  });
});
