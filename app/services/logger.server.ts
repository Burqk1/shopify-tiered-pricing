/**
 * Structured Logging Service
 *
 * Provides JSON-formatted logging with context, metrics, and error tracking.
 * Supports multiple log levels and integrates with external services.
 */

export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

export interface LogContext {
  shopId?: string;
  shopDomain?: string;
  requestId?: string;
  userId?: string;
  ruleId?: string;
  orderId?: string;
  action?: string;
  duration?: number;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  metrics?: Record<string, number>;
}

// Environment-based configuration
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

const MIN_LOG_LEVEL = (process.env.LOG_LEVEL || "info") as LogLevel;
const IS_PRODUCTION = process.env.NODE_ENV === "production";

/**
 * Generate unique request ID
 */
export function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Format log entry as JSON
 */
function formatLogEntry(entry: LogEntry): string {
  if (IS_PRODUCTION) {
    // Compact JSON for production
    return JSON.stringify(entry);
  } else {
    // Pretty print for development
    return JSON.stringify(entry, null, 2);
  }
}

/**
 * Should this log level be output?
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[MIN_LOG_LEVEL];
}

/**
 * Core logging function
 */
function log(
  level: LogLevel,
  message: string,
  context?: LogContext,
  error?: Error,
  metrics?: Record<string, number>
): void {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };

  if (context && Object.keys(context).length > 0) {
    entry.context = context;
  }

  if (error) {
    entry.error = {
      name: error.name,
      message: error.message,
      stack: IS_PRODUCTION ? undefined : error.stack,
    };
  }

  if (metrics && Object.keys(metrics).length > 0) {
    entry.metrics = metrics;
  }

  const output = formatLogEntry(entry);

  switch (level) {
    case "debug":
    case "info":
      console.log(output);
      break;
    case "warn":
      console.warn(output);
      break;
    case "error":
    case "fatal":
      console.error(output);
      break;
  }
}

/**
 * Logger instance with context
 */
export class Logger {
  private context: LogContext;

  constructor(context: LogContext = {}) {
    this.context = context;
  }

  /**
   * Create child logger with additional context
   */
  child(additionalContext: LogContext): Logger {
    return new Logger({ ...this.context, ...additionalContext });
  }

  debug(message: string, context?: LogContext): void {
    log("debug", message, { ...this.context, ...context });
  }

  info(message: string, context?: LogContext): void {
    log("info", message, { ...this.context, ...context });
  }

  warn(message: string, context?: LogContext): void {
    log("warn", message, { ...this.context, ...context });
  }

  error(message: string, error?: Error, context?: LogContext): void {
    log("error", message, { ...this.context, ...context }, error);
  }

  fatal(message: string, error?: Error, context?: LogContext): void {
    log("fatal", message, { ...this.context, ...context }, error);
  }

  /**
   * Log with metrics
   */
  metric(message: string, metrics: Record<string, number>, context?: LogContext): void {
    log("info", message, { ...this.context, ...context }, undefined, metrics);
  }

  /**
   * Time an async operation
   */
  async time<T>(
    operation: string,
    fn: () => Promise<T>,
    context?: LogContext
  ): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = Math.round(performance.now() - start);
      this.info(`${operation} completed`, { ...context, duration });
      return result;
    } catch (error) {
      const duration = Math.round(performance.now() - start);
      this.error(`${operation} failed`, error as Error, { ...context, duration });
      throw error;
    }
  }
}

// Default logger instance
export const logger = new Logger();

// ============================================================================
// SPECIALIZED LOGGERS
// ============================================================================

/**
 * Create request-scoped logger
 */
export function createRequestLogger(request: Request, shopDomain?: string): Logger {
  const requestId = generateRequestId();
  const url = new URL(request.url);

  return new Logger({
    requestId,
    shopDomain,
    method: request.method,
    path: url.pathname,
    userAgent: request.headers.get("user-agent") || undefined,
  });
}

/**
 * API request logger
 */
export function logApiRequest(
  method: string,
  path: string,
  statusCode: number,
  duration: number,
  context?: LogContext
): void {
  const level: LogLevel = statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";
  log(level, `${method} ${path} ${statusCode}`, {
    ...context,
    statusCode,
    duration,
  });
}

/**
 * Database query logger
 */
export function logDbQuery(
  operation: string,
  model: string,
  duration: number,
  rowCount?: number
): void {
  log("debug", `DB ${operation} ${model}`, {
    duration,
    rowCount,
  });
}

/**
 * Sync operation logger
 */
export function logSyncOperation(
  shopId: string,
  action: "start" | "complete" | "error",
  details?: {
    rulesCount?: number;
    duration?: number;
    error?: Error;
  }
): void {
  const context: LogContext = {
    shopId,
    action: `sync_${action}`,
    rulesCount: details?.rulesCount,
    duration: details?.duration,
  };

  if (action === "error" && details?.error) {
    log("error", "Sync operation failed", context, details.error);
  } else if (action === "complete") {
    log("info", "Sync operation completed", context);
  } else {
    log("info", "Sync operation started", context);
  }
}

/**
 * Discount application logger
 */
export function logDiscountApplied(
  shopId: string,
  ruleId: string,
  orderId: string,
  details: {
    originalPrice: number;
    discountedPrice: number;
    discountPercent: number;
    tier?: string;
  }
): void {
  log("info", "Discount applied", {
    shopId,
    ruleId,
    orderId,
    action: "discount_applied",
    ...details,
  });
}

/**
 * Authentication logger
 */
export function logAuth(
  action: "login" | "logout" | "token_refresh" | "failed",
  shopDomain: string,
  details?: { reason?: string }
): void {
  const level: LogLevel = action === "failed" ? "warn" : "info";
  log(level, `Auth ${action}`, {
    shopDomain,
    action: `auth_${action}`,
    ...details,
  });
}

/**
 * Webhook logger
 */
export function logWebhook(
  topic: string,
  shopDomain: string,
  status: "received" | "processed" | "failed",
  details?: { error?: Error; duration?: number }
): void {
  const level: LogLevel = status === "failed" ? "error" : "info";
  const context: LogContext = {
    shopDomain,
    action: `webhook_${status}`,
    webhookTopic: topic,
    duration: details?.duration,
  };

  if (status === "failed" && details?.error) {
    log(level, `Webhook ${topic} ${status}`, context, details.error);
  } else {
    log(level, `Webhook ${topic} ${status}`, context);
  }
}

// ============================================================================
// ERROR TRACKING (Sentry-compatible)
// ============================================================================

interface ErrorTrackingConfig {
  dsn?: string;
  environment?: string;
  release?: string;
}

let errorTrackingConfig: ErrorTrackingConfig | null = null;

/**
 * Initialize error tracking (call in entry.server.ts)
 */
export function initErrorTracking(config: ErrorTrackingConfig): void {
  errorTrackingConfig = config;

  if (config.dsn) {
    logger.info("Error tracking initialized", {
      environment: config.environment,
      release: config.release,
    });
  }
}

/**
 * Capture exception for error tracking service
 */
export function captureException(
  error: Error,
  context?: LogContext
): void {
  // Log locally
  log("error", error.message, context, error);

  // Send to Sentry if configured
  if (errorTrackingConfig?.dsn) {
    // In production, this would call Sentry.captureException()
    // For now, we just log that we would send it
    if (!IS_PRODUCTION) {
      console.log("[Sentry] Would capture exception:", {
        error: error.message,
        context,
        dsn: errorTrackingConfig.dsn,
      });
    }
  }
}

/**
 * Capture message for error tracking service
 */
export function captureMessage(
  message: string,
  level: LogLevel = "info",
  context?: LogContext
): void {
  log(level, message, context);

  if (errorTrackingConfig?.dsn && (level === "error" || level === "fatal")) {
    if (!IS_PRODUCTION) {
      console.log("[Sentry] Would capture message:", { message, level, context });
    }
  }
}

// ============================================================================
// PERFORMANCE METRICS
// ============================================================================

interface PerformanceMetric {
  name: string;
  value: number;
  unit: "ms" | "count" | "bytes" | "percent";
  timestamp: number;
  tags?: Record<string, string>;
}

const metricsBuffer: PerformanceMetric[] = [];
const METRICS_FLUSH_INTERVAL = 60000; // 1 minute
const METRICS_BUFFER_SIZE = 100;

/**
 * Record a performance metric
 */
export function recordMetric(
  name: string,
  value: number,
  unit: PerformanceMetric["unit"] = "ms",
  tags?: Record<string, string>
): void {
  metricsBuffer.push({
    name,
    value,
    unit,
    timestamp: Date.now(),
    tags,
  });

  // Flush if buffer is full
  if (metricsBuffer.length >= METRICS_BUFFER_SIZE) {
    flushMetrics();
  }
}

/**
 * Flush metrics to logging/monitoring service
 */
export function flushMetrics(): void {
  if (metricsBuffer.length === 0) return;

  const metrics = [...metricsBuffer];
  metricsBuffer.length = 0;

  // Aggregate metrics by name
  const aggregated = metrics.reduce(
    (acc, m) => {
      if (!acc[m.name]) {
        acc[m.name] = { values: [], unit: m.unit };
      }
      acc[m.name].values.push(m.value);
      return acc;
    },
    {} as Record<string, { values: number[]; unit: string }>
  );

  // Calculate stats and log
  const summary: Record<string, number> = {};
  for (const [name, data] of Object.entries(aggregated)) {
    const values = data.values;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    summary[`${name}_avg`] = Math.round(avg * 100) / 100;
    summary[`${name}_min`] = min;
    summary[`${name}_max`] = max;
    summary[`${name}_count`] = values.length;
  }

  logger.metric("Performance metrics flush", summary);
}

// Auto-flush metrics periodically
if (typeof setInterval !== "undefined") {
  setInterval(flushMetrics, METRICS_FLUSH_INTERVAL);
}

// ============================================================================
// REQUEST TIMING MIDDLEWARE HELPER
// ============================================================================

/**
 * Create timing context for request
 */
export function createTimingContext(): {
  start: () => void;
  end: (name: string) => number;
  getAll: () => Record<string, number>;
} {
  const timings: Record<string, { start: number; end?: number }> = {};
  let currentName: string | null = null;

  return {
    start() {
      if (currentName) {
        timings[currentName].end = performance.now();
      }
      currentName = null;
    },
    end(name: string): number {
      const now = performance.now();
      if (!timings[name]) {
        timings[name] = { start: now };
      }
      timings[name].end = now;
      const duration = timings[name].end! - timings[name].start;
      recordMetric(`request_${name}`, duration, "ms");
      return duration;
    },
    getAll(): Record<string, number> {
      const result: Record<string, number> = {};
      for (const [name, timing] of Object.entries(timings)) {
        if (timing.end) {
          result[name] = Math.round(timing.end - timing.start);
        }
      }
      return result;
    },
  };
}
