/**
 * Auto-Apply Service
 *
 * Automatically applies AI pricing suggestions based on rules.
 * Includes safety checks, rate limiting, and audit logging.
 */

import prisma from "~/db.server";
import type { AutoApplyRule, PricingInsight, AutoApplyStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

// GraphQL admin client type
type AdminGraphQL = {
  graphql: (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response>;
};

// ============================================================================
// TYPES
// ============================================================================

export interface AutoApplyResult {
  insightId: string;
  productId: string;
  success: boolean;
  oldPrice: number;
  newPrice: number;
  changePercent: number;
  error?: string;
}

interface ShopifyPriceUpdateResponse {
  productVariantUpdate?: {
    productVariant?: {
      id: string;
      price: string;
    };
    userErrors?: Array<{
      field: string[];
      message: string;
    }>;
  };
}

// ============================================================================
// AUTO-APPLY RULES MANAGEMENT
// ============================================================================

/**
 * Get all auto-apply rules for a shop
 */
export async function getAutoApplyRules(shopId: string) {
  return prisma.autoApplyRule.findMany({
    where: { shopId },
    orderBy: { priority: "desc" },
  });
}

/**
 * Get active auto-apply rules
 */
export async function getActiveAutoApplyRules(shopId: string) {
  return prisma.autoApplyRule.findMany({
    where: { shopId, status: "ACTIVE" },
    orderBy: { priority: "desc" },
  });
}

/**
 * Create a new auto-apply rule
 */
export async function createAutoApplyRule(
  shopId: string,
  data: {
    name: string;
    minConfidence?: number;
    maxPriceChangePercent?: number;
    requirePositiveMargin?: boolean;
    minMarginPercent?: number;
    applyToAllProducts?: boolean;
    includedProductIds?: string[];
    excludedProductIds?: string[];
    includedCollections?: string[];
    excludedCollections?: string[];
    allowIncrease?: boolean;
    allowDecrease?: boolean;
    maxAppliesPerDay?: number;
    cooldownHours?: number;
    notifyOnApply?: boolean;
    notifyEmail?: string;
  }
) {
  return prisma.autoApplyRule.create({
    data: {
      shopId,
      name: data.name,
      status: "DRAFT",
      minConfidence: data.minConfidence ? new Decimal(data.minConfidence) : new Decimal(0.85),
      maxPriceChangePercent: data.maxPriceChangePercent ? new Decimal(data.maxPriceChangePercent) : new Decimal(15),
      requirePositiveMargin: data.requirePositiveMargin ?? true,
      minMarginPercent: data.minMarginPercent ? new Decimal(data.minMarginPercent) : null,
      applyToAllProducts: data.applyToAllProducts ?? false,
      includedProductIds: data.includedProductIds || [],
      excludedProductIds: data.excludedProductIds || [],
      includedCollections: data.includedCollections || [],
      excludedCollections: data.excludedCollections || [],
      allowIncrease: data.allowIncrease ?? true,
      allowDecrease: data.allowDecrease ?? true,
      maxAppliesPerDay: data.maxAppliesPerDay ?? 10,
      cooldownHours: data.cooldownHours ?? 24,
      notifyOnApply: data.notifyOnApply ?? true,
      notifyEmail: data.notifyEmail,
    },
  });
}

/**
 * Update an auto-apply rule
 */
export async function updateAutoApplyRule(
  ruleId: string,
  data: Partial<{
    name: string;
    status: "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";
    minConfidence: number;
    maxPriceChangePercent: number;
    requirePositiveMargin: boolean;
    minMarginPercent: number | null;
    applyToAllProducts: boolean;
    includedProductIds: string[];
    excludedProductIds: string[];
    includedCollections: string[];
    excludedCollections: string[];
    allowIncrease: boolean;
    allowDecrease: boolean;
    maxAppliesPerDay: number;
    cooldownHours: number;
    notifyOnApply: boolean;
    notifyEmail: string | null;
  }>
) {
  return prisma.autoApplyRule.update({
    where: { id: ruleId },
    data: {
      name: data.name,
      status: data.status,
      minConfidence: data.minConfidence !== undefined ? new Decimal(data.minConfidence) : undefined,
      maxPriceChangePercent: data.maxPriceChangePercent !== undefined ? new Decimal(data.maxPriceChangePercent) : undefined,
      requirePositiveMargin: data.requirePositiveMargin,
      minMarginPercent: data.minMarginPercent !== undefined
        ? (data.minMarginPercent ? new Decimal(data.minMarginPercent) : null)
        : undefined,
      applyToAllProducts: data.applyToAllProducts,
      includedProductIds: data.includedProductIds,
      excludedProductIds: data.excludedProductIds,
      includedCollections: data.includedCollections,
      excludedCollections: data.excludedCollections,
      allowIncrease: data.allowIncrease,
      allowDecrease: data.allowDecrease,
      maxAppliesPerDay: data.maxAppliesPerDay,
      cooldownHours: data.cooldownHours,
      notifyOnApply: data.notifyOnApply,
      notifyEmail: data.notifyEmail,
    },
  });
}

/**
 * Delete an auto-apply rule
 */
export async function deleteAutoApplyRule(ruleId: string) {
  return prisma.autoApplyRule.delete({
    where: { id: ruleId },
  });
}

// ============================================================================
// AUTO-APPLY EXECUTION
// ============================================================================

/**
 * Process and apply eligible insights automatically
 */
export async function processAutoApply(
  shopId: string,
  admin: AdminGraphQL
): Promise<AutoApplyResult[]> {
  const results: AutoApplyResult[] = [];

  // Get active rules
  const rules = await getActiveAutoApplyRules(shopId);
  if (rules.length === 0) return results;

  // Get pending insights
  const insights = await prisma.pricingInsight.findMany({
    where: {
      shopId,
      status: { in: ["NEW", "VIEWED"] },
      autoApplied: false,
    },
    orderBy: { confidenceScore: "desc" },
  });

  for (const insight of insights) {
    // Find matching rule
    const matchingRule = await findMatchingRule(insight, rules);
    if (!matchingRule) continue;

    // Check rate limits
    if (!(await checkRateLimits(matchingRule))) continue;

    // Check cooldown
    if (!(await checkCooldown(shopId, insight.productId, matchingRule.cooldownHours))) continue;

    // Apply the price change
    const result = await applyPriceChange(shopId, insight, matchingRule, admin);
    results.push(result);

    // If successful, update rule stats
    if (result.success) {
      await prisma.autoApplyRule.update({
        where: { id: matchingRule.id },
        data: {
          totalApplied: { increment: 1 },
          lastAppliedAt: new Date(),
        },
      });
    }
  }

  return results;
}

/**
 * Find a rule that matches the insight
 */
async function findMatchingRule(
  insight: PricingInsight,
  rules: AutoApplyRule[]
): Promise<AutoApplyRule | null> {
  for (const rule of rules) {
    // Check confidence threshold
    if (Number(insight.confidenceScore) < Number(rule.minConfidence)) continue;

    // Check price change direction
    const priceChange = Number(insight.suggestedPrice) - Number(insight.currentPrice);
    if (priceChange > 0 && !rule.allowIncrease) continue;
    if (priceChange < 0 && !rule.allowDecrease) continue;

    // Check price change magnitude
    const changePercent = Math.abs(priceChange / Number(insight.currentPrice) * 100);
    if (changePercent > Number(rule.maxPriceChangePercent)) continue;

    // Check margin requirements
    if (rule.requirePositiveMargin && insight.costPrice) {
      const newMargin = (Number(insight.suggestedPrice) - Number(insight.costPrice)) / Number(insight.suggestedPrice);
      if (newMargin <= 0) continue;

      if (rule.minMarginPercent && newMargin * 100 < Number(rule.minMarginPercent)) continue;
    }

    // Check product targeting
    if (!rule.applyToAllProducts) {
      const productId = insight.productId;

      // Check exclusions first
      if (rule.excludedProductIds.includes(productId)) continue;

      // Check inclusions
      if (rule.includedProductIds.length > 0 && !rule.includedProductIds.includes(productId)) {
        continue;
      }
    }

    // Rule matches!
    return rule;
  }

  return null;
}

/**
 * Check if rule hasn't exceeded daily limit
 */
async function checkRateLimits(rule: AutoApplyRule): Promise<boolean> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayCount = await prisma.autoApplyLog.count({
    where: {
      ruleId: rule.id,
      createdAt: { gte: today },
      status: "SUCCESS",
    },
  });

  return todayCount < rule.maxAppliesPerDay;
}

/**
 * Check if product is within cooldown period
 */
async function checkCooldown(
  shopId: string,
  productId: string,
  cooldownHours: number
): Promise<boolean> {
  const cooldownStart = new Date();
  cooldownStart.setHours(cooldownStart.getHours() - cooldownHours);

  const recentChange = await prisma.autoApplyLog.findFirst({
    where: {
      shopId,
      productId,
      status: "SUCCESS",
      createdAt: { gte: cooldownStart },
    },
  });

  return !recentChange;
}

/**
 * Apply price change via Shopify API
 */
async function applyPriceChange(
  shopId: string,
  insight: PricingInsight,
  rule: AutoApplyRule,
  admin: AdminGraphQL
): Promise<AutoApplyResult> {
  const oldPrice = Number(insight.currentPrice);
  const newPrice = Number(insight.suggestedPrice);
  const changePercent = ((newPrice - oldPrice) / oldPrice) * 100;

  let status: AutoApplyStatus = "FAILED";
  let errorMessage: string | undefined;
  let shopifyResponse: string | undefined;

  try {
    // Get variant ID (use first variant if not specified)
    const variantId = insight.variantId || await getFirstVariantId(admin, insight.productId);

    if (!variantId) {
      throw new Error("Could not find variant ID");
    }

    // Update price via Shopify API
    const mutation = `
      mutation UpdateVariantPrice($input: ProductVariantInput!) {
        productVariantUpdate(input: $input) {
          productVariant {
            id
            price
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
        input: {
          id: variantId,
          price: newPrice.toFixed(2),
        },
      },
    });

    const result = await response.json() as { data: ShopifyPriceUpdateResponse };
    shopifyResponse = JSON.stringify(result);

    if (result.data?.productVariantUpdate?.userErrors?.length) {
      throw new Error(result.data.productVariantUpdate.userErrors[0].message);
    }

    status = "SUCCESS";

    // Update insight
    await prisma.pricingInsight.update({
      where: { id: insight.id },
      data: {
        status: "APPLIED",
        appliedAt: new Date(),
        autoApplied: true,
        autoApplyRuleId: rule.id,
      },
    });

    // Record price history
    await prisma.priceHistory.create({
      data: {
        shopId,
        productId: insight.productId,
        variantId: insight.variantId,
        oldPrice: new Decimal(oldPrice),
        newPrice: new Decimal(newPrice),
        changePercent: new Decimal(changePercent),
        changeSource: "AI_AUTO_APPLY",
        changeReason: insight.reason || "Auto-applied AI suggestion",
        insightId: insight.id,
      },
    });
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);
  }

  // Log the attempt
  await prisma.autoApplyLog.create({
    data: {
      shopId,
      ruleId: rule.id,
      insightId: insight.id,
      productId: insight.productId,
      variantId: insight.variantId,
      productTitle: null, // Would need to fetch
      oldPrice: new Decimal(oldPrice),
      newPrice: new Decimal(newPrice),
      changePercent: new Decimal(changePercent),
      confidence: insight.confidenceScore,
      status,
      errorMessage,
      shopifyResponse,
    },
  });

  return {
    insightId: insight.id,
    productId: insight.productId,
    success: status === "SUCCESS",
    oldPrice,
    newPrice,
    changePercent,
    error: errorMessage,
  };
}

/**
 * Get first variant ID for a product
 */
async function getFirstVariantId(
  admin: AdminGraphQL,
  productId: string
): Promise<string | null> {
  const query = `
    query GetProductVariant($id: ID!) {
      product(id: $id) {
        variants(first: 1) {
          edges {
            node {
              id
            }
          }
        }
      }
    }
  `;

  const response = await admin.graphql(query, {
    variables: { id: productId },
  });

  const data = await response.json();
  return data.data?.product?.variants?.edges?.[0]?.node?.id || null;
}

// ============================================================================
// AUTO-APPLY LOGS
// ============================================================================

/**
 * Get auto-apply logs for a shop
 */
export async function getAutoApplyLogs(
  shopId: string,
  options?: {
    limit?: number;
    ruleId?: string;
    status?: AutoApplyStatus;
  }
) {
  return prisma.autoApplyLog.findMany({
    where: {
      shopId,
      ruleId: options?.ruleId,
      status: options?.status,
    },
    orderBy: { createdAt: "desc" },
    take: options?.limit || 50,
  });
}

/**
 * Get auto-apply stats
 */
export async function getAutoApplyStats(shopId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const last30Days = new Date();
  last30Days.setDate(last30Days.getDate() - 30);

  const [todayLogs, last30DaysLogs, totalRules] = await Promise.all([
    prisma.autoApplyLog.findMany({
      where: { shopId, createdAt: { gte: today } },
    }),
    prisma.autoApplyLog.findMany({
      where: { shopId, createdAt: { gte: last30Days } },
    }),
    prisma.autoApplyRule.count({
      where: { shopId, status: "ACTIVE" },
    }),
  ]);

  const todaySuccess = todayLogs.filter(l => l.status === "SUCCESS").length;
  const last30DaysSuccess = last30DaysLogs.filter(l => l.status === "SUCCESS").length;

  return {
    appliedToday: todaySuccess,
    appliedLast30Days: last30DaysSuccess,
    failedToday: todayLogs.length - todaySuccess,
    activeRules: totalRules,
  };
}

// ============================================================================
// REVERT FUNCTIONALITY
// ============================================================================

/**
 * Revert a previously applied price change
 */
export async function revertAutoApply(
  logId: string,
  admin: AdminGraphQL
): Promise<{ success: boolean; error?: string }> {
  const log = await prisma.autoApplyLog.findUnique({
    where: { id: logId },
  });

  if (!log) {
    return { success: false, error: "Log not found" };
  }

  if (log.status !== "SUCCESS") {
    return { success: false, error: "Can only revert successful applications" };
  }

  try {
    // Get the insight to find variant ID
    const insight = await prisma.pricingInsight.findUnique({
      where: { id: log.insightId },
    });

    const variantId = insight?.variantId || await getFirstVariantId(admin, log.productId);

    if (!variantId) {
      throw new Error("Could not find variant ID");
    }

    // Revert to old price
    const mutation = `
      mutation UpdateVariantPrice($input: ProductVariantInput!) {
        productVariantUpdate(input: $input) {
          productVariant {
            id
            price
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
        input: {
          id: variantId,
          price: Number(log.oldPrice).toFixed(2),
        },
      },
    });

    const result = await response.json() as { data: ShopifyPriceUpdateResponse };

    if (result.data?.productVariantUpdate?.userErrors?.length) {
      throw new Error(result.data.productVariantUpdate.userErrors[0].message);
    }

    // Update log status
    await prisma.autoApplyLog.update({
      where: { id: logId },
      data: { status: "REVERTED" },
    });

    // Record the revert in price history
    await prisma.priceHistory.create({
      data: {
        shopId: log.shopId,
        productId: log.productId,
        variantId: log.variantId,
        oldPrice: log.newPrice,
        newPrice: log.oldPrice,
        changePercent: new Decimal(-Number(log.changePercent)),
        changeSource: "AI_AUTO_APPLY",
        changeReason: "Reverted auto-applied price change",
        insightId: log.insightId,
      },
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
