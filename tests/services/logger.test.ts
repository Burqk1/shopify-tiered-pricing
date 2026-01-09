/**
 * Logger Service Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  Logger,
  logger,
  generateRequestId,
  createRequestLogger,
  logApiRequest,
  logSyncOperation,
  logDiscountApplied,
  logAuth,
  logWebhook,
  recordMetric,
  flushMetrics,
  captureException,
  createTimingContext,
} from "~/services/logger.server";

describe("Logger Service", () => {
  let consoleSpy: {
    log: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    consoleSpy = {
      log: vi.spyOn(console, "log").mockImplementation(() => {}),
      warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
      error: vi.spyOn(console, "error").mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("generateRequestId", () => {
    it("should generate unique request IDs", () => {
      const id1 = generateRequestId();
      const id2 = generateRequestId();

      expect(id1).toMatch(/^req_[a-z0-9]+_[a-z0-9]+$/);
      expect(id2).toMatch(/^req_[a-z0-9]+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe("Logger class", () => {
    it("should log info messages", () => {
      const testLogger = new Logger({ shopId: "shop-1" });
      testLogger.info("Test message");

      expect(consoleSpy.log).toHaveBeenCalled();
      const output = JSON.parse(consoleSpy.log.mock.calls[0][0] as string);

      expect(output.level).toBe("info");
      expect(output.message).toBe("Test message");
      expect(output.context.shopId).toBe("shop-1");
      expect(output.timestamp).toBeDefined();
    });

    it("should log warning messages", () => {
      logger.warn("Warning message");

      expect(consoleSpy.warn).toHaveBeenCalled();
      const output = JSON.parse(consoleSpy.warn.mock.calls[0][0] as string);
      expect(output.level).toBe("warn");
    });

    it("should log error messages with error object", () => {
      const error = new Error("Test error");
      logger.error("Error occurred", error);

      expect(consoleSpy.error).toHaveBeenCalled();
      const output = JSON.parse(consoleSpy.error.mock.calls[0][0] as string);

      expect(output.level).toBe("error");
      expect(output.error.name).toBe("Error");
      expect(output.error.message).toBe("Test error");
    });

    it("should create child logger with merged context", () => {
      const parentLogger = new Logger({ shopId: "shop-1" });
      const childLogger = parentLogger.child({ ruleId: "rule-1" });

      childLogger.info("Child message");

      const output = JSON.parse(consoleSpy.log.mock.calls[0][0] as string);
      expect(output.context.shopId).toBe("shop-1");
      expect(output.context.ruleId).toBe("rule-1");
    });

    it("should log metrics", () => {
      logger.metric("Performance data", {
        responseTime: 150,
        dbQueries: 5,
        cacheHits: 3,
      });

      expect(consoleSpy.log).toHaveBeenCalled();
      const output = JSON.parse(consoleSpy.log.mock.calls[0][0] as string);

      expect(output.metrics.responseTime).toBe(150);
      expect(output.metrics.dbQueries).toBe(5);
      expect(output.metrics.cacheHits).toBe(3);
    });

    it("should time async operations", async () => {
      const testLogger = new Logger();

      const result = await testLogger.time(
        "Test operation",
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return "success";
        }
      );

      expect(result).toBe("success");
      expect(consoleSpy.log).toHaveBeenCalled();

      const output = JSON.parse(consoleSpy.log.mock.calls[0][0] as string);
      expect(output.message).toBe("Test operation completed");
      expect(output.context.duration).toBeGreaterThanOrEqual(10);
    });

    it("should log and rethrow errors from timed operations", async () => {
      const testLogger = new Logger();
      const testError = new Error("Test error");

      await expect(
        testLogger.time("Failing operation", async () => {
          throw testError;
        })
      ).rejects.toThrow("Test error");

      expect(consoleSpy.error).toHaveBeenCalled();
      const output = JSON.parse(consoleSpy.error.mock.calls[0][0] as string);
      expect(output.message).toBe("Failing operation failed");
    });
  });

  describe("createRequestLogger", () => {
    it("should create logger with request context", () => {
      const request = new Request("https://example.com/api/test", {
        method: "POST",
        headers: { "user-agent": "Test Agent" },
      });

      const requestLogger = createRequestLogger(request, "test.myshopify.com");
      requestLogger.info("Request received");

      const output = JSON.parse(consoleSpy.log.mock.calls[0][0] as string);
      expect(output.context.requestId).toMatch(/^req_/);
      expect(output.context.shopDomain).toBe("test.myshopify.com");
      expect(output.context.method).toBe("POST");
      expect(output.context.path).toBe("/api/test");
    });
  });

  describe("logApiRequest", () => {
    it("should log successful request as info", () => {
      logApiRequest("GET", "/api/products", 200, 150, { shopId: "shop-1" });

      expect(consoleSpy.log).toHaveBeenCalled();
      const output = JSON.parse(consoleSpy.log.mock.calls[0][0] as string);
      expect(output.level).toBe("info");
      expect(output.message).toBe("GET /api/products 200");
      expect(output.context.duration).toBe(150);
    });

    it("should log 4xx request as warning", () => {
      logApiRequest("GET", "/api/products", 404, 50);

      expect(consoleSpy.warn).toHaveBeenCalled();
      const output = JSON.parse(consoleSpy.warn.mock.calls[0][0] as string);
      expect(output.level).toBe("warn");
    });

    it("should log 5xx request as error", () => {
      logApiRequest("POST", "/api/create", 500, 200);

      expect(consoleSpy.error).toHaveBeenCalled();
      const output = JSON.parse(consoleSpy.error.mock.calls[0][0] as string);
      expect(output.level).toBe("error");
    });
  });

  describe("logSyncOperation", () => {
    it("should log sync start", () => {
      logSyncOperation("shop-1", "start");

      const output = JSON.parse(consoleSpy.log.mock.calls[0][0] as string);
      expect(output.message).toBe("Sync operation started");
      expect(output.context.action).toBe("sync_start");
    });

    it("should log sync complete with details", () => {
      logSyncOperation("shop-1", "complete", {
        rulesCount: 5,
        duration: 1500,
      });

      const output = JSON.parse(consoleSpy.log.mock.calls[0][0] as string);
      expect(output.message).toBe("Sync operation completed");
      expect(output.context.rulesCount).toBe(5);
      expect(output.context.duration).toBe(1500);
    });

    it("should log sync error", () => {
      const error = new Error("Sync failed");
      logSyncOperation("shop-1", "error", { error });

      expect(consoleSpy.error).toHaveBeenCalled();
      const output = JSON.parse(consoleSpy.error.mock.calls[0][0] as string);
      expect(output.error.message).toBe("Sync failed");
    });
  });

  describe("logDiscountApplied", () => {
    it("should log discount application", () => {
      logDiscountApplied("shop-1", "rule-1", "order-1", {
        originalPrice: 100,
        discountedPrice: 85,
        discountPercent: 15,
        tier: "10+ items",
      });

      const output = JSON.parse(consoleSpy.log.mock.calls[0][0] as string);
      expect(output.message).toBe("Discount applied");
      expect(output.context.originalPrice).toBe(100);
      expect(output.context.discountPercent).toBe(15);
    });
  });

  describe("logAuth", () => {
    it("should log successful login", () => {
      logAuth("login", "test.myshopify.com");

      const output = JSON.parse(consoleSpy.log.mock.calls[0][0] as string);
      expect(output.level).toBe("info");
      expect(output.context.action).toBe("auth_login");
    });

    it("should log failed auth as warning", () => {
      logAuth("failed", "test.myshopify.com", { reason: "Invalid token" });

      expect(consoleSpy.warn).toHaveBeenCalled();
      const output = JSON.parse(consoleSpy.warn.mock.calls[0][0] as string);
      expect(output.level).toBe("warn");
      expect(output.context.reason).toBe("Invalid token");
    });
  });

  describe("logWebhook", () => {
    it("should log webhook received", () => {
      logWebhook("orders/create", "test.myshopify.com", "received");

      const output = JSON.parse(consoleSpy.log.mock.calls[0][0] as string);
      expect(output.context.webhookTopic).toBe("orders/create");
      expect(output.context.action).toBe("webhook_received");
    });

    it("should log webhook failure with error", () => {
      const error = new Error("Processing failed");
      logWebhook("orders/create", "test.myshopify.com", "failed", { error });

      expect(consoleSpy.error).toHaveBeenCalled();
      const output = JSON.parse(consoleSpy.error.mock.calls[0][0] as string);
      expect(output.error.message).toBe("Processing failed");
    });
  });

  describe("Performance Metrics", () => {
    it("should record metrics", () => {
      recordMetric("api_response_time", 150, "ms", { endpoint: "/api/test" });
      recordMetric("api_response_time", 200, "ms", { endpoint: "/api/test" });

      // Flush to see output
      flushMetrics();

      expect(consoleSpy.log).toHaveBeenCalled();
      const output = JSON.parse(consoleSpy.log.mock.calls[0][0] as string);
      expect(output.metrics.api_response_time_avg).toBe(175);
      expect(output.metrics.api_response_time_min).toBe(150);
      expect(output.metrics.api_response_time_max).toBe(200);
      expect(output.metrics.api_response_time_count).toBe(2);
    });

    it("should not log when buffer is empty", () => {
      // Clear any existing metrics
      flushMetrics();
      consoleSpy.log.mockClear();

      // Flush empty buffer
      flushMetrics();

      expect(consoleSpy.log).not.toHaveBeenCalled();
    });
  });

  describe("captureException", () => {
    it("should log exception", () => {
      const error = new Error("Critical error");
      captureException(error, { shopId: "shop-1" });

      expect(consoleSpy.error).toHaveBeenCalled();
      const output = JSON.parse(consoleSpy.error.mock.calls[0][0] as string);
      expect(output.error.message).toBe("Critical error");
    });
  });

  describe("createTimingContext", () => {
    it("should track operation timings", () => {
      const timing = createTimingContext();

      // Simulate some work
      timing.end("database");
      timing.end("api_call");

      const all = timing.getAll();
      expect(all).toHaveProperty("database");
      expect(all).toHaveProperty("api_call");
    });
  });
});
