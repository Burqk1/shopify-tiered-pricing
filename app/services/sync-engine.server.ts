/**
 * Sync Engine Service
 *
 * The heart of the "200 IQ" architecture.
 * Syncs pricing rules from PostgreSQL to Shopify Metaobjects
 * so Functions can read them without external API calls.
 *
 * Features:
 * - Retry with exponential backoff for resilient API calls
 * - Compressed JSON format for minimal storage
 * - Automatic error logging and recovery
 */

import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import { getActiveRulesForSync, markRuleSynced } from "~/models/pricing-rule.server";
import { createSyncLog } from "~/models/sync-log.server";
import type { PricingRuleWithRelations } from "~/models/pricing-rule.server";
import { checkRateLimit, createRateLimitResponse } from "~/services/rate-limiter.server";

// ============================================================================
// RETRY CONFIGURATION
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

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateBackoffDelay(attempt: number, config: RetryConfig): number {
  const exponentialDelay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt);
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);
  // Add jitter (±25%) to prevent thundering herd
  const jitter = cappedDelay * 0.25 * (Math.random() * 2 - 1);
  return Math.round(cappedDelay + jitter);
}

/**
 * Check if error is retryable (network errors, rate limits, server errors)
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    // Retryable: network issues, rate limits, server errors
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

/**
 * Execute a function with exponential backoff retry
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  operationName: string,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry non-retryable errors
      if (!isRetryableError(error)) {
        throw lastError;
      }

      // Don't retry after max attempts
      if (attempt >= config.maxRetries) {
        console.error(`[Sync Engine] ${operationName} failed after ${config.maxRetries + 1} attempts:`, lastError.message);
        throw lastError;
      }

      const delay = calculateBackoffDelay(attempt, config);
      console.warn(`[Sync Engine] ${operationName} failed (attempt ${attempt + 1}/${config.maxRetries + 1}), retrying in ${delay}ms:`, lastError.message);
      await sleep(delay);
    }
  }

  throw lastError || new Error(`${operationName} failed`);
}

// ============================================================================
// TYPES
// ============================================================================

/**
 * Compressed rule format for minimal Metaobject storage
 * Using short keys to reduce JSON size
 */
interface CompressedRule {
  id: string;       // Rule ID
  n: string;        // name
  p: number;        // priority
  c: {              // conditions
    t: string;      // type
    v: string;      // value
  }[];
  t: {              // tiers
    min: number;    // minQuantity
    max?: number;   // maxQuantity (optional)
    vt: string;     // valueType
    v: number;      // value (discount amount/percentage)
    m?: string;     // message (optional)
  }[];
}

/**
 * Payload stored in Metaobject
 */
interface SyncPayload {
  version: number;
  syncedAt: string;
  rules: CompressedRule[];
}

// Metaobject configuration
const METAOBJECT_TYPE = "tiered_pricing_rules";
const METAOBJECT_NAME = "Tiered Pricing Rules";

// ============================================================================
// MAIN SYNC FUNCTION
// ============================================================================

/**
 * Sync all active rules to Shopify Metaobject
 * This is the main entry point called after rule changes
 */
export async function syncRulesToShopify(
  admin: AdminApiContext,
  shopId: string,
  shopDomain: string
): Promise<{
  success: boolean;
  rulesCount: number;
  error?: string;
  rateLimited?: boolean;
}> {
  // Check rate limit for sync operations
  const rateLimitResult = checkRateLimit(shopDomain, "sync");
  if (!rateLimitResult.allowed) {
    return {
      success: false,
      rulesCount: 0,
      error: `Rate limit exceeded. Please wait ${rateLimitResult.retryAfter} seconds before syncing again.`,
      rateLimited: true,
    };
  }

  const startTime = Date.now();

  try {
    // 1. Get all active rules from database
    const rules = await getActiveRulesForSync(shopId);

    // 2. Compress rules for storage
    const payload = createSyncPayload(rules);
    const jsonPayload = JSON.stringify(payload);

    // 3. Ensure Metaobject definition exists (with retry)
    await withRetry(
      () => ensureMetaobjectDefinition(admin),
      "ensureMetaobjectDefinition"
    );

    // 4. Upsert the Metaobject with rules data (with retry)
    await withRetry(
      () => upsertMetaobject(admin, shopDomain, jsonPayload),
      "upsertMetaobject"
    );

    // 5. Mark all rules as synced
    await Promise.all(rules.map((rule) => markRuleSynced(rule.id)));

    // 6. Log successful sync
    const duration = Date.now() - startTime;
    await createSyncLog({
      shopId,
      status: "SUCCESS",
      rulesCount: rules.length,
      payload: jsonPayload,
      duration,
    });

    return {
      success: true,
      rulesCount: rules.length,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const duration = Date.now() - startTime;

    // Log failed sync
    await createSyncLog({
      shopId,
      status: "FAILED",
      rulesCount: 0,
      error: errorMessage,
      duration,
    });

    return {
      success: false,
      rulesCount: 0,
      error: errorMessage,
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Compress rules into minimal JSON format
 */
function createSyncPayload(rules: PricingRuleWithRelations[]): SyncPayload {
  return {
    version: 1,
    syncedAt: new Date().toISOString(),
    rules: rules.map(compressRule),
  };
}

/**
 * Compress a single rule
 */
function compressRule(rule: PricingRuleWithRelations): CompressedRule {
  return {
    id: rule.id,
    n: rule.name,
    p: rule.priority,
    c: rule.conditions.map((c) => ({
      t: c.type,
      v: c.value,
    })),
    t: rule.tiers.map((t) => ({
      min: t.minQuantity,
      ...(t.maxQuantity && { max: t.maxQuantity }),
      vt: t.valueType,
      v: Number(t.value),
      ...(t.message && { m: t.message }),
    })),
  };
}

/**
 * Ensure Metaobject definition exists in the shop
 */
async function ensureMetaobjectDefinition(
  admin: AdminApiContext
): Promise<void> {
  // Check if definition exists
  const checkQuery = `
    query CheckMetaobjectDefinition {
      metaobjectDefinitionByType(type: "${METAOBJECT_TYPE}") {
        id
      }
    }
  `;

  const checkResponse = await admin.graphql(checkQuery);
  const checkData = await checkResponse.json();

  if (checkData.data?.metaobjectDefinitionByType?.id) {
    return; // Definition already exists
  }

  // Create definition
  const createMutation = `
    mutation CreateMetaobjectDefinition($definition: MetaobjectDefinitionCreateInput!) {
      metaobjectDefinitionCreate(definition: $definition) {
        metaobjectDefinition {
          id
          type
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const response = await admin.graphql(createMutation, {
    variables: {
      definition: {
        type: METAOBJECT_TYPE,
        name: METAOBJECT_NAME,
        access: {
          storefront: "PUBLIC_READ",
          admin: "MERCHANT_READ_WRITE",
        },
        capabilities: {
          publishable: {
            enabled: true,
          },
        },
        fieldDefinitions: [
          {
            key: "shop_domain",
            name: "Shop Domain",
            type: "single_line_text_field",
            required: true,
          },
          {
            key: "rules_json",
            name: "Rules JSON",
            type: "json",
            required: true,
          },
          {
            key: "last_sync",
            name: "Last Sync",
            type: "date_time",
          },
        ],
      },
    },
  });

  const data = await response.json();

  if (data.data?.metaobjectDefinitionCreate?.userErrors?.length > 0) {
    const errors = data.data.metaobjectDefinitionCreate.userErrors;
    throw new Error(`Failed to create Metaobject definition: ${JSON.stringify(errors)}`);
  }
}

/**
 * Create or update the Metaobject with rules data
 */
async function upsertMetaobject(
  admin: AdminApiContext,
  shopDomain: string,
  rulesJson: string
): Promise<void> {
  const handle = `pricing-rules-${shopDomain.replace(/\./g, "-")}`;

  const mutation = `
    mutation UpsertMetaobject($handle: MetaobjectHandleInput!, $metaobject: MetaobjectUpsertInput!) {
      metaobjectUpsert(handle: $handle, metaobject: $metaobject) {
        metaobject {
          id
          handle
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const response = await admin.graphql(mutation, {
    variables: {
      handle: {
        type: METAOBJECT_TYPE,
        handle,
      },
      metaobject: {
        capabilities: {
          publishable: {
            status: "ACTIVE",
          },
        },
        fields: [
          {
            key: "shop_domain",
            value: shopDomain,
          },
          {
            key: "rules_json",
            value: rulesJson,
          },
          {
            key: "last_sync",
            value: new Date().toISOString(),
          },
        ],
      },
    },
  });

  const data = await response.json();

  if (data.data?.metaobjectUpsert?.userErrors?.length > 0) {
    const errors = data.data.metaobjectUpsert.userErrors;
    throw new Error(`Failed to upsert Metaobject: ${JSON.stringify(errors)}`);
  }
}

/**
 * Delete Metaobject for a shop (called on app uninstall)
 */
export async function deleteShopMetaobject(
  admin: AdminApiContext,
  shopDomain: string
): Promise<void> {
  await withRetry(async () => {
    const handle = `pricing-rules-${shopDomain.replace(/\./g, "-")}`;

    // First get the Metaobject ID
    const query = `
      query GetMetaobject {
        metaobjectByHandle(handle: { type: "${METAOBJECT_TYPE}", handle: "${handle}" }) {
          id
        }
      }
    `;

    const queryResponse = await admin.graphql(query);
    const queryData = await queryResponse.json();

    const metaobjectId = queryData.data?.metaobjectByHandle?.id;

    if (!metaobjectId) {
      return; // Nothing to delete
    }

    // Delete the Metaobject
    const mutation = `
      mutation DeleteMetaobject($id: ID!) {
        metaobjectDelete(id: $id) {
          deletedId
          userErrors {
            field
            message
          }
        }
      }
    `;

    await admin.graphql(mutation, {
      variables: { id: metaobjectId },
    });
  }, "deleteShopMetaobject");
}

/**
 * Get current Metaobject data (for debugging/preview)
 */
export async function getMetaobjectData(
  admin: AdminApiContext,
  shopDomain: string
): Promise<SyncPayload | null> {
  return withRetry(async () => {
    const handle = `pricing-rules-${shopDomain.replace(/\./g, "-")}`;

    const query = `
      query GetMetaobject {
        metaobjectByHandle(handle: { type: "${METAOBJECT_TYPE}", handle: "${handle}" }) {
          id
          handle
          fields {
            key
            value
          }
        }
      }
    `;

    const response = await admin.graphql(query);
    const data = await response.json();

    const metaobject = data.data?.metaobjectByHandle;
    if (!metaobject) {
      return null;
    }

    const rulesJsonField = metaobject.fields.find(
      (f: { key: string; value: string }) => f.key === "rules_json"
    );

    if (!rulesJsonField?.value) {
      return null;
    }

    try {
      return JSON.parse(rulesJsonField.value) as SyncPayload;
    } catch {
      return null;
    }
  }, "getMetaobjectData");
}
