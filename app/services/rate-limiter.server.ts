/**
 * In-Memory Rate Limiter Service
 *
 * Provides rate limiting for API endpoints to prevent abuse.
 * Uses a sliding window algorithm with automatic cleanup.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
}

// In-memory store for rate limit tracking
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup interval (every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000;

// Default configurations for different endpoints
export const RATE_LIMIT_CONFIGS = {
  // API endpoints - more restrictive
  api: {
    windowMs: 60 * 1000,     // 1 minute
    maxRequests: 60,          // 60 requests per minute
  },
  // App Proxy (storefront) - higher limit for customer-facing
  appProxy: {
    windowMs: 60 * 1000,     // 1 minute
    maxRequests: 120,         // 120 requests per minute per shop
  },
  // Sync operations - very restrictive to prevent API abuse
  sync: {
    windowMs: 60 * 1000,     // 1 minute
    maxRequests: 10,          // 10 sync operations per minute
  },
  // Webhook endpoints - moderate
  webhook: {
    windowMs: 60 * 1000,     // 1 minute
    maxRequests: 30,          // 30 webhooks per minute
  },
  // Authentication - very restrictive to prevent brute force
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10,          // 10 attempts per 15 minutes
  },
} as const;

export type RateLimitType = keyof typeof RATE_LIMIT_CONFIGS;

/**
 * Generate a unique key for rate limiting
 */
function generateKey(identifier: string, type: RateLimitType): string {
  return `${type}:${identifier}`;
}

/**
 * Check if a request should be rate limited
 * @returns Object with allowed status and retry information
 */
export function checkRateLimit(
  identifier: string,
  type: RateLimitType = "api"
): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
} {
  const config = RATE_LIMIT_CONFIGS[type];
  const key = generateKey(identifier, type);
  const now = Date.now();

  const entry = rateLimitStore.get(key);

  // No existing entry or window has expired
  if (!entry || now >= entry.resetAt) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetAt: now + config.windowMs,
    };
    rateLimitStore.set(key, newEntry);

    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: newEntry.resetAt,
    };
  }

  // Entry exists and window is still active
  if (entry.count >= config.maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfter,
    };
  }

  // Increment counter
  entry.count++;
  rateLimitStore.set(key, entry);

  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Get rate limit headers for response
 */
export function getRateLimitHeaders(
  identifier: string,
  type: RateLimitType = "api"
): Record<string, string> {
  const config = RATE_LIMIT_CONFIGS[type];
  const key = generateKey(identifier, type);
  const entry = rateLimitStore.get(key);

  const now = Date.now();
  const remaining = entry
    ? Math.max(0, config.maxRequests - entry.count)
    : config.maxRequests;
  const resetAt = entry?.resetAt ?? now + config.windowMs;

  return {
    "X-RateLimit-Limit": String(config.maxRequests),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
  };
}

/**
 * Create a rate limited JSON response
 */
export function createRateLimitResponse(retryAfter: number): Response {
  return new Response(
    JSON.stringify({
      error: "Too Many Requests",
      message: "Rate limit exceeded. Please try again later.",
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
      },
    }
  );
}

/**
 * Middleware helper for rate limiting in loader/action functions
 */
export async function withRateLimit<T>(
  identifier: string,
  type: RateLimitType,
  handler: () => Promise<T>
): Promise<T | Response> {
  const result = checkRateLimit(identifier, type);

  if (!result.allowed) {
    return createRateLimitResponse(result.retryAfter!);
  }

  return handler();
}

/**
 * Extract identifier from request (IP or shop domain)
 */
export function getIdentifierFromRequest(request: Request): string {
  // Try to get shop domain first (for Shopify-specific requests)
  const url = new URL(request.url);
  const shopDomain = url.searchParams.get("shop");
  if (shopDomain) {
    return shopDomain;
  }

  // Fall back to IP address
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  // Default fallback
  return "unknown";
}

/**
 * Cleanup expired entries periodically
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now >= entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}

// Start cleanup interval
let cleanupInterval: NodeJS.Timeout | null = null;

export function startRateLimitCleanup(): void {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(cleanupExpiredEntries, CLEANUP_INTERVAL);
}

export function stopRateLimitCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

// Auto-start cleanup when module is loaded
startRateLimitCleanup();

/**
 * Get current rate limit stats (for monitoring/debugging)
 */
export function getRateLimitStats(): {
  totalEntries: number;
  entriesByType: Record<string, number>;
} {
  const entriesByType: Record<string, number> = {};

  for (const key of rateLimitStore.keys()) {
    const type = key.split(":")[0];
    entriesByType[type] = (entriesByType[type] || 0) + 1;
  }

  return {
    totalEntries: rateLimitStore.size,
    entriesByType,
  };
}

/**
 * Reset rate limit for a specific identifier (admin use)
 */
export function resetRateLimit(identifier: string, type: RateLimitType): void {
  const key = generateKey(identifier, type);
  rateLimitStore.delete(key);
}

/**
 * Clear all rate limits (for testing/emergency use)
 */
export function clearAllRateLimits(): void {
  rateLimitStore.clear();
}
