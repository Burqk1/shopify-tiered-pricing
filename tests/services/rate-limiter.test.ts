/**
 * Rate Limiter Service Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  checkRateLimit,
  getRateLimitHeaders,
  createRateLimitResponse,
  withRateLimit,
  getIdentifierFromRequest,
  getRateLimitStats,
  resetRateLimit,
  clearAllRateLimits,
  RATE_LIMIT_CONFIGS,
} from "~/services/rate-limiter.server";

describe("Rate Limiter Service", () => {
  beforeEach(() => {
    // Clear all rate limits before each test
    clearAllRateLimits();
  });

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  describe("RATE_LIMIT_CONFIGS", () => {
    it("should have correct api config", () => {
      expect(RATE_LIMIT_CONFIGS.api.windowMs).toBe(60 * 1000);
      expect(RATE_LIMIT_CONFIGS.api.maxRequests).toBe(60);
    });

    it("should have correct appProxy config", () => {
      expect(RATE_LIMIT_CONFIGS.appProxy.windowMs).toBe(60 * 1000);
      expect(RATE_LIMIT_CONFIGS.appProxy.maxRequests).toBe(120);
    });

    it("should have correct sync config", () => {
      expect(RATE_LIMIT_CONFIGS.sync.windowMs).toBe(60 * 1000);
      expect(RATE_LIMIT_CONFIGS.sync.maxRequests).toBe(10);
    });

    it("should have correct webhook config", () => {
      expect(RATE_LIMIT_CONFIGS.webhook.maxRequests).toBe(30);
    });

    it("should have correct auth config", () => {
      expect(RATE_LIMIT_CONFIGS.auth.windowMs).toBe(15 * 60 * 1000);
      expect(RATE_LIMIT_CONFIGS.auth.maxRequests).toBe(10);
    });
  });

  // ============================================================================
  // CHECK RATE LIMIT
  // ============================================================================

  describe("checkRateLimit", () => {
    it("should allow first request", () => {
      const result = checkRateLimit("test-shop-1", "api");

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(59); // 60 - 1
      expect(result.resetAt).toBeGreaterThan(Date.now());
    });

    it("should decrement remaining on each request", () => {
      const result1 = checkRateLimit("test-shop-2", "api");
      const result2 = checkRateLimit("test-shop-2", "api");
      const result3 = checkRateLimit("test-shop-2", "api");

      expect(result1.remaining).toBe(59);
      expect(result2.remaining).toBe(58);
      expect(result3.remaining).toBe(57);
    });

    it("should block when limit exceeded", () => {
      // Exhaust the limit for sync (10 requests)
      for (let i = 0; i < 10; i++) {
        checkRateLimit("test-shop-3", "sync");
      }

      const result = checkRateLimit("test-shop-3", "sync");

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it("should use default type if not specified", () => {
      const result = checkRateLimit("test-shop-4");

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(59); // api default: 60 - 1
    });

    it("should track different identifiers separately", () => {
      checkRateLimit("shop-a", "api");
      checkRateLimit("shop-a", "api");
      const resultA = checkRateLimit("shop-a", "api");

      const resultB = checkRateLimit("shop-b", "api");

      expect(resultA.remaining).toBe(57);
      expect(resultB.remaining).toBe(59);
    });

    it("should track different types separately", () => {
      checkRateLimit("test-shop-5", "api");
      checkRateLimit("test-shop-5", "api");

      const apiResult = checkRateLimit("test-shop-5", "api");
      const syncResult = checkRateLimit("test-shop-5", "sync");

      expect(apiResult.remaining).toBe(57);
      expect(syncResult.remaining).toBe(9);
    });
  });

  // ============================================================================
  // RATE LIMIT HEADERS
  // ============================================================================

  describe("getRateLimitHeaders", () => {
    it("should return correct headers for new identifier", () => {
      const headers = getRateLimitHeaders("new-shop", "api");

      expect(headers["X-RateLimit-Limit"]).toBe("60");
      expect(headers["X-RateLimit-Remaining"]).toBe("60");
      expect(headers["X-RateLimit-Reset"]).toBeDefined();
    });

    it("should return correct headers after requests", () => {
      checkRateLimit("header-shop", "api");
      checkRateLimit("header-shop", "api");

      const headers = getRateLimitHeaders("header-shop", "api");

      expect(headers["X-RateLimit-Limit"]).toBe("60");
      expect(headers["X-RateLimit-Remaining"]).toBe("58");
    });

    it("should return 0 remaining when exhausted", () => {
      for (let i = 0; i < 10; i++) {
        checkRateLimit("exhausted-shop", "sync");
      }

      const headers = getRateLimitHeaders("exhausted-shop", "sync");

      expect(headers["X-RateLimit-Remaining"]).toBe("0");
    });
  });

  // ============================================================================
  // RATE LIMIT RESPONSE
  // ============================================================================

  describe("createRateLimitResponse", () => {
    it("should create 429 response", () => {
      const response = createRateLimitResponse(30);

      expect(response.status).toBe(429);
      expect(response.headers.get("Content-Type")).toBe("application/json");
      expect(response.headers.get("Retry-After")).toBe("30");
    });

    it("should include error message in body", async () => {
      const response = createRateLimitResponse(60);
      const body = await response.json();

      expect(body.error).toBe("Too Many Requests");
      expect(body.message).toContain("Rate limit exceeded");
      expect(body.retryAfter).toBe(60);
    });
  });

  // ============================================================================
  // WITH RATE LIMIT MIDDLEWARE
  // ============================================================================

  describe("withRateLimit", () => {
    it("should execute handler when allowed", async () => {
      const handler = vi.fn().mockResolvedValue({ data: "success" });

      const result = await withRateLimit("middleware-shop-1", "api", handler);

      expect(handler).toHaveBeenCalled();
      expect(result).toEqual({ data: "success" });
    });

    it("should return 429 response when blocked", async () => {
      // Exhaust the limit
      for (let i = 0; i < 10; i++) {
        await withRateLimit("middleware-shop-2", "sync", async () => ({}));
      }

      const handler = vi.fn();
      const result = await withRateLimit("middleware-shop-2", "sync", handler);

      expect(handler).not.toHaveBeenCalled();
      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(429);
    });
  });

  // ============================================================================
  // IDENTIFIER EXTRACTION
  // ============================================================================

  describe("getIdentifierFromRequest", () => {
    it("should extract shop domain from query params", () => {
      const request = new Request("http://localhost?shop=test.myshopify.com");

      const identifier = getIdentifierFromRequest(request);

      expect(identifier).toBe("test.myshopify.com");
    });

    it("should extract IP from x-forwarded-for header", () => {
      const request = new Request("http://localhost", {
        headers: { "x-forwarded-for": "192.168.1.1, 10.0.0.1" },
      });

      const identifier = getIdentifierFromRequest(request);

      expect(identifier).toBe("192.168.1.1");
    });

    it("should extract IP from x-real-ip header", () => {
      const request = new Request("http://localhost", {
        headers: { "x-real-ip": "203.0.113.42" },
      });

      const identifier = getIdentifierFromRequest(request);

      expect(identifier).toBe("203.0.113.42");
    });

    it("should prefer shop domain over IP", () => {
      const request = new Request("http://localhost?shop=priority.myshopify.com", {
        headers: { "x-forwarded-for": "192.168.1.1" },
      });

      const identifier = getIdentifierFromRequest(request);

      expect(identifier).toBe("priority.myshopify.com");
    });

    it("should return unknown for unidentifiable requests", () => {
      const request = new Request("http://localhost");

      const identifier = getIdentifierFromRequest(request);

      expect(identifier).toBe("unknown");
    });
  });

  // ============================================================================
  // STATS AND MANAGEMENT
  // ============================================================================

  describe("getRateLimitStats", () => {
    it("should return empty stats when no rate limits", () => {
      const stats = getRateLimitStats();

      expect(stats.totalEntries).toBe(0);
      expect(stats.entriesByType).toEqual({});
    });

    it("should return correct stats after requests", () => {
      checkRateLimit("stats-shop-1", "api");
      checkRateLimit("stats-shop-2", "api");
      checkRateLimit("stats-shop-1", "sync");

      const stats = getRateLimitStats();

      expect(stats.totalEntries).toBe(3);
      expect(stats.entriesByType.api).toBe(2);
      expect(stats.entriesByType.sync).toBe(1);
    });
  });

  describe("resetRateLimit", () => {
    it("should reset rate limit for specific identifier", () => {
      // Make some requests
      checkRateLimit("reset-shop", "api");
      checkRateLimit("reset-shop", "api");
      checkRateLimit("reset-shop", "api");

      // Verify limit is reduced
      let result = checkRateLimit("reset-shop", "api");
      expect(result.remaining).toBe(56);

      // Reset the limit
      resetRateLimit("reset-shop", "api");

      // Verify limit is reset
      result = checkRateLimit("reset-shop", "api");
      expect(result.remaining).toBe(59);
    });
  });

  describe("clearAllRateLimits", () => {
    it("should clear all rate limits", () => {
      checkRateLimit("shop-1", "api");
      checkRateLimit("shop-2", "sync");
      checkRateLimit("shop-3", "webhook");

      let stats = getRateLimitStats();
      expect(stats.totalEntries).toBe(3);

      clearAllRateLimits();

      stats = getRateLimitStats();
      expect(stats.totalEntries).toBe(0);
    });
  });
});
