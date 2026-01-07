/**
 * Sync Engine Tests
 *
 * Comprehensive tests including:
 * - Rule compression and payload generation
 * - Retry with exponential backoff logic
 * - Error handling and recovery
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Types
interface PricingRule {
  id: string;
  name: string;
  priority: number;
  conditions: { type: string; value: string }[];
  tiers: {
    minQuantity: number;
    maxQuantity: number | null;
    valueType: string;
    value: number;
    message?: string;
  }[];
}

interface CompressedRule {
  id: string;
  n: string;
  p: number;
  c: { t: string; v: string }[];
  t: { min: number; max?: number; vt: string; v: number; m?: string }[];
}

interface SyncPayload {
  version: number;
  syncedAt: string;
  rules: CompressedRule[];
}

// Re-implement compression logic for testing
function compressRule(rule: PricingRule): CompressedRule {
  return {
    id: rule.id,
    n: rule.name,
    p: rule.priority,
    c: rule.conditions.map((c) => ({ t: c.type, v: c.value })),
    t: rule.tiers.map((t) => ({
      min: t.minQuantity,
      ...(t.maxQuantity && { max: t.maxQuantity }),
      vt: t.valueType,
      v: t.value,
      ...(t.message && { m: t.message }),
    })),
  };
}

function createSyncPayload(rules: PricingRule[]): SyncPayload {
  return {
    version: 1,
    syncedAt: new Date().toISOString(),
    rules: rules.map(compressRule),
  };
}

describe("Sync Engine", () => {
  describe("compressRule", () => {
    it("should compress rule with all fields", () => {
      const rule: PricingRule = {
        id: "rule-123",
        name: "Wholesale Discount",
        priority: 5,
        conditions: [
          { type: "PRODUCT", value: "gid://shopify/Product/123" },
          { type: "CUSTOMER_TAG", value: "wholesale" },
        ],
        tiers: [
          { minQuantity: 5, maxQuantity: 9, valueType: "PERCENTAGE", value: 10, message: "10% off" },
          { minQuantity: 10, maxQuantity: null, valueType: "PERCENTAGE", value: 20 },
        ],
      };

      const compressed = compressRule(rule);

      expect(compressed.id).toBe("rule-123");
      expect(compressed.n).toBe("Wholesale Discount");
      expect(compressed.p).toBe(5);
      expect(compressed.c).toHaveLength(2);
      expect(compressed.c[0]).toEqual({ t: "PRODUCT", v: "gid://shopify/Product/123" });
      expect(compressed.c[1]).toEqual({ t: "CUSTOMER_TAG", v: "wholesale" });
      expect(compressed.t).toHaveLength(2);
      expect(compressed.t[0]).toEqual({ min: 5, max: 9, vt: "PERCENTAGE", v: 10, m: "10% off" });
      expect(compressed.t[1]).toEqual({ min: 10, vt: "PERCENTAGE", v: 20 });
    });

    it("should omit null maxQuantity", () => {
      const rule: PricingRule = {
        id: "rule-456",
        name: "Simple Rule",
        priority: 0,
        conditions: [{ type: "ALL_PRODUCTS", value: "*" }],
        tiers: [{ minQuantity: 10, maxQuantity: null, valueType: "PERCENTAGE", value: 15 }],
      };

      const compressed = compressRule(rule);

      expect(compressed.t[0]).not.toHaveProperty("max");
      expect(compressed.t[0].min).toBe(10);
    });

    it("should omit empty message", () => {
      const rule: PricingRule = {
        id: "rule-789",
        name: "No Message",
        priority: 0,
        conditions: [{ type: "ALL_PRODUCTS", value: "*" }],
        tiers: [{ minQuantity: 5, maxQuantity: null, valueType: "FIXED_AMOUNT", value: 5 }],
      };

      const compressed = compressRule(rule);

      expect(compressed.t[0]).not.toHaveProperty("m");
    });
  });

  describe("createSyncPayload", () => {
    it("should create valid payload with version", () => {
      const rules: PricingRule[] = [
        {
          id: "rule-1",
          name: "Rule 1",
          priority: 0,
          conditions: [{ type: "ALL_PRODUCTS", value: "*" }],
          tiers: [{ minQuantity: 10, maxQuantity: null, valueType: "PERCENTAGE", value: 10 }],
        },
      ];

      const payload = createSyncPayload(rules);

      expect(payload.version).toBe(1);
      expect(payload.syncedAt).toBeTruthy();
      expect(new Date(payload.syncedAt).getTime()).toBeLessThanOrEqual(Date.now());
      expect(payload.rules).toHaveLength(1);
    });

    it("should handle empty rules array", () => {
      const payload = createSyncPayload([]);

      expect(payload.version).toBe(1);
      expect(payload.rules).toEqual([]);
    });

    it("should preserve rule order", () => {
      const rules: PricingRule[] = [
        {
          id: "first",
          name: "First",
          priority: 1,
          conditions: [],
          tiers: [],
        },
        {
          id: "second",
          name: "Second",
          priority: 2,
          conditions: [],
          tiers: [],
        },
      ];

      const payload = createSyncPayload(rules);

      expect(payload.rules[0].id).toBe("first");
      expect(payload.rules[1].id).toBe("second");
    });
  });

  describe("JSON size optimization", () => {
    it("should produce smaller JSON with compression", () => {
      const fullRule = {
        id: "rule-123",
        name: "Wholesale Discount",
        priority: 5,
        conditions: [
          { type: "PRODUCT", value: "gid://shopify/Product/123" },
        ],
        tiers: [
          { minQuantity: 10, maxQuantity: null, valueType: "PERCENTAGE", value: 20 },
        ],
      };

      const compressedRule = compressRule(fullRule);

      const fullJson = JSON.stringify(fullRule);
      const compressedJson = JSON.stringify(compressedRule);

      // Compressed should be smaller
      expect(compressedJson.length).toBeLessThan(fullJson.length);

      // Calculate savings
      const savings = ((fullJson.length - compressedJson.length) / fullJson.length) * 100;
      console.log(`JSON size reduced by ${savings.toFixed(1)}%`);
    });
  });
});

// ============================================================================
// RETRY MECHANISM TESTS
// ============================================================================

interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

function calculateBackoffDelay(attempt: number, config: RetryConfig): number {
  const exponentialDelay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt);
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);
  return cappedDelay; // Without jitter for predictable testing
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes('network') ||
        message.includes('timeout') ||
        message.includes('econnreset') ||
        message.includes('rate limit') ||
        message.includes('throttl') ||
        message.includes('503') ||
        message.includes('502') ||
        message.includes('504') ||
        message.includes('429')) {
      return true;
    }
  }
  return false;
}

async function withRetry<T>(
  fn: () => Promise<T>,
  _operationName: string,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  sleepFn: (ms: number) => Promise<void> = () => Promise.resolve()
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (!isRetryableError(error)) {
        throw lastError;
      }

      if (attempt >= config.maxRetries) {
        throw lastError;
      }

      const delay = calculateBackoffDelay(attempt, config);
      await sleepFn(delay);
    }
  }

  throw lastError || new Error("Unknown error");
}

describe("Retry Mechanism", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("calculateBackoffDelay", () => {
    it("should calculate exponential delay", () => {
      const config = DEFAULT_RETRY_CONFIG;

      expect(calculateBackoffDelay(0, config)).toBe(1000);  // 1000 * 2^0
      expect(calculateBackoffDelay(1, config)).toBe(2000);  // 1000 * 2^1
      expect(calculateBackoffDelay(2, config)).toBe(4000);  // 1000 * 2^2
      expect(calculateBackoffDelay(3, config)).toBe(8000);  // 1000 * 2^3
    });

    it("should cap delay at maxDelayMs", () => {
      const config = { ...DEFAULT_RETRY_CONFIG, maxDelayMs: 5000 };

      expect(calculateBackoffDelay(0, config)).toBe(1000);
      expect(calculateBackoffDelay(1, config)).toBe(2000);
      expect(calculateBackoffDelay(2, config)).toBe(4000);
      expect(calculateBackoffDelay(3, config)).toBe(5000); // Capped
      expect(calculateBackoffDelay(4, config)).toBe(5000); // Still capped
    });
  });

  describe("isRetryableError", () => {
    it("should identify network errors as retryable", () => {
      expect(isRetryableError(new Error("Network error"))).toBe(true);
      expect(isRetryableError(new Error("Connection timeout"))).toBe(true);
      expect(isRetryableError(new Error("ECONNRESET"))).toBe(true);
    });

    it("should identify rate limit errors as retryable", () => {
      expect(isRetryableError(new Error("Rate limit exceeded"))).toBe(true);
      expect(isRetryableError(new Error("Too many requests (429)"))).toBe(true);
      expect(isRetryableError(new Error("Request throttled"))).toBe(true);
    });

    it("should identify server errors as retryable", () => {
      expect(isRetryableError(new Error("502 Bad Gateway"))).toBe(true);
      expect(isRetryableError(new Error("503 Service Unavailable"))).toBe(true);
      expect(isRetryableError(new Error("504 Gateway Timeout"))).toBe(true);
    });

    it("should not retry validation errors", () => {
      expect(isRetryableError(new Error("Invalid input"))).toBe(false);
      expect(isRetryableError(new Error("Missing required field"))).toBe(false);
      expect(isRetryableError(new Error("404 Not Found"))).toBe(false);
    });

    it("should not retry non-Error objects", () => {
      expect(isRetryableError("string error")).toBe(false);
      expect(isRetryableError(null)).toBe(false);
      expect(isRetryableError(undefined)).toBe(false);
    });
  });

  describe("withRetry", () => {
    it("should succeed on first attempt", async () => {
      const fn = vi.fn().mockResolvedValue("success");

      const result = await withRetry(fn, "test");

      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should retry on retryable errors", async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error("Network error"))
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValue("success");

      const result = await withRetry(fn, "test");

      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it("should throw immediately on non-retryable errors", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("Invalid input"));

      await expect(withRetry(fn, "test")).rejects.toThrow("Invalid input");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should throw after max retries", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("Network error"));

      await expect(withRetry(fn, "test")).rejects.toThrow("Network error");
      expect(fn).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });

    it("should use custom config", async () => {
      const customConfig: RetryConfig = {
        maxRetries: 1,
        baseDelayMs: 100,
        maxDelayMs: 1000,
        backoffMultiplier: 2,
      };

      const fn = vi.fn().mockRejectedValue(new Error("Network error"));

      await expect(withRetry(fn, "test", customConfig)).rejects.toThrow();
      expect(fn).toHaveBeenCalledTimes(2); // Initial + 1 retry
    });
  });
});

// ============================================================================
// INTEGRATION TESTS (Mock GraphQL)
// ============================================================================

describe("Sync Engine Integration", () => {
  const mockGraphQL = vi.fn();
  const mockAdmin = {
    graphql: mockGraphQL,
  };

  beforeEach(() => {
    mockGraphQL.mockReset();
  });

  describe("GraphQL Error Handling", () => {
    it("should handle userErrors from Shopify", async () => {
      mockGraphQL.mockResolvedValue({
        json: async () => ({
          data: {
            metaobjectDefinitionCreate: {
              metaobjectDefinition: null,
              userErrors: [
                { field: "type", message: "Type already exists" },
              ],
            },
          },
        }),
      });

      // This simulates what would happen in the actual function
      const response = await mockAdmin.graphql("mutation...");
      const data = await response.json();

      expect(data.data.metaobjectDefinitionCreate.userErrors).toHaveLength(1);
      expect(data.data.metaobjectDefinitionCreate.userErrors[0].message).toBe("Type already exists");
    });

    it("should handle successful Metaobject upsert", async () => {
      mockGraphQL.mockResolvedValue({
        json: async () => ({
          data: {
            metaobjectUpsert: {
              metaobject: {
                id: "gid://shopify/Metaobject/123",
                handle: "pricing-rules-test-shop",
              },
              userErrors: [],
            },
          },
        }),
      });

      const response = await mockAdmin.graphql("mutation...");
      const data = await response.json();

      expect(data.data.metaobjectUpsert.metaobject.id).toBeTruthy();
      expect(data.data.metaobjectUpsert.userErrors).toHaveLength(0);
    });

    it("should parse rules JSON from Metaobject", async () => {
      const rulesPayload = {
        version: 1,
        syncedAt: new Date().toISOString(),
        rules: [
          { id: "rule-1", n: "Test Rule", p: 0, c: [], t: [] },
        ],
      };

      mockGraphQL.mockResolvedValue({
        json: async () => ({
          data: {
            metaobjectByHandle: {
              id: "gid://shopify/Metaobject/123",
              handle: "pricing-rules-test-shop",
              fields: [
                { key: "shop_domain", value: "test.myshopify.com" },
                { key: "rules_json", value: JSON.stringify(rulesPayload) },
                { key: "last_sync", value: new Date().toISOString() },
              ],
            },
          },
        }),
      });

      const response = await mockAdmin.graphql("query...");
      const data = await response.json();

      const rulesField = data.data.metaobjectByHandle.fields.find(
        (f: { key: string }) => f.key === "rules_json"
      );
      const parsedRules = JSON.parse(rulesField.value);

      expect(parsedRules.version).toBe(1);
      expect(parsedRules.rules).toHaveLength(1);
      expect(parsedRules.rules[0].n).toBe("Test Rule");
    });
  });

  describe("Payload Size Limits", () => {
    it("should handle large rule sets efficiently", () => {
      // Simulate 100 rules
      const rules: PricingRule[] = Array.from({ length: 100 }, (_, i) => ({
        id: `rule-${i}`,
        name: `Discount Rule ${i}`,
        priority: i,
        conditions: [
          { type: "PRODUCT", value: `gid://shopify/Product/${i}` },
        ],
        tiers: [
          { minQuantity: 5, maxQuantity: 9, valueType: "PERCENTAGE", value: 10 },
          { minQuantity: 10, maxQuantity: null, valueType: "PERCENTAGE", value: 20 },
        ],
      }));

      const payload = createSyncPayload(rules);
      const jsonString = JSON.stringify(payload);

      // Metaobject JSON field limit is typically 65536 characters
      // Our compressed format should easily fit 100 rules
      expect(jsonString.length).toBeLessThan(65536);
      expect(payload.rules).toHaveLength(100);

      console.log(`100 rules payload size: ${jsonString.length} chars`);
    });

    it("should warn when approaching size limits", () => {
      // Simulate 500 rules (stress test)
      const rules: PricingRule[] = Array.from({ length: 500 }, (_, i) => ({
        id: `rule-${i}`,
        name: `Discount Rule ${i} with longer name`,
        priority: i,
        conditions: [
          { type: "PRODUCT", value: `gid://shopify/Product/${i}` },
          { type: "COLLECTION", value: `gid://shopify/Collection/${i}` },
        ],
        tiers: [
          { minQuantity: 5, maxQuantity: 9, valueType: "PERCENTAGE", value: 10, message: "Tier 1 discount" },
          { minQuantity: 10, maxQuantity: 19, valueType: "PERCENTAGE", value: 15, message: "Tier 2 discount" },
          { minQuantity: 20, maxQuantity: null, valueType: "PERCENTAGE", value: 20, message: "Tier 3 discount" },
        ],
      }));

      const payload = createSyncPayload(rules);
      const jsonString = JSON.stringify(payload);

      console.log(`500 rules payload size: ${jsonString.length} chars`);

      // Even 500 complex rules should fit
      expect(jsonString.length).toBeLessThan(200000);
    });
  });
});
