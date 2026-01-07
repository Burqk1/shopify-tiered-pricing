/**
 * Pricing Rule Model - Data Access Layer
 *
 * Handles all pricing rule CRUD operations including
 * conditions and tiers management.
 */

import prisma from "~/db.server";
import type {
  PricingRule,
  RuleCondition,
  DiscountTier,
  RuleStatus,
  ConditionType,
  DiscountType,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

// ============================================================================
// TYPES
// ============================================================================

export type PricingRuleWithRelations = PricingRule & {
  conditions: RuleCondition[];
  tiers: DiscountTier[];
};

export interface CreateRuleInput {
  shopId: string;
  name: string;
  description?: string;
  priority?: number;
  startDate?: Date | null;
  endDate?: Date | null;
  conditions: {
    type: ConditionType;
    value: string;
    label?: string;
  }[];
  tiers: {
    minQuantity: number;
    maxQuantity?: number | null;
    valueType: DiscountType;
    value: number;
    message?: string;
  }[];
}

export interface UpdateRuleInput {
  name?: string;
  description?: string;
  priority?: number;
  status?: RuleStatus;
  startDate?: Date | null;
  endDate?: Date | null;
  conditions?: {
    type: ConditionType;
    value: string;
    label?: string;
  }[];
  tiers?: {
    minQuantity: number;
    maxQuantity?: number | null;
    valueType: DiscountType;
    value: number;
    message?: string;
  }[];
}

export type { PricingRule, RuleCondition, DiscountTier, RuleStatus, ConditionType, DiscountType };

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get a single pricing rule by ID with all relations
 */
export async function getPricingRule(
  ruleId: string
): Promise<PricingRuleWithRelations | null> {
  return prisma.pricingRule.findUnique({
    where: { id: ruleId },
    include: {
      conditions: true,
      tiers: {
        orderBy: { minQuantity: "asc" },
      },
    },
  });
}

/**
 * Get all pricing rules for a shop
 */
export async function getPricingRules(
  shopId: string,
  options?: {
    status?: RuleStatus | RuleStatus[];
    includeArchived?: boolean;
  }
): Promise<PricingRuleWithRelations[]> {
  const statusFilter = options?.status
    ? { status: Array.isArray(options.status) ? { in: options.status } : options.status }
    : options?.includeArchived
    ? {}
    : { status: { not: "ARCHIVED" as RuleStatus } };

  return prisma.pricingRule.findMany({
    where: {
      shopId,
      ...statusFilter,
    },
    include: {
      conditions: true,
      tiers: {
        orderBy: { minQuantity: "asc" },
      },
    },
    orderBy: [
      { priority: "desc" },
      { createdAt: "desc" },
    ],
  });
}

/**
 * Get active rules for sync (only ACTIVE status)
 */
export async function getActiveRulesForSync(
  shopId: string
): Promise<PricingRuleWithRelations[]> {
  const now = new Date();

  return prisma.pricingRule.findMany({
    where: {
      shopId,
      status: "ACTIVE",
      // Check date validity
      OR: [
        { startDate: null },
        { startDate: { lte: now } },
      ],
      AND: [
        {
          OR: [
            { endDate: null },
            { endDate: { gte: now } },
          ],
        },
      ],
    },
    include: {
      conditions: true,
      tiers: {
        orderBy: { minQuantity: "asc" },
      },
    },
    orderBy: { priority: "desc" },
  });
}

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Create a new pricing rule with conditions and tiers
 */
export async function createPricingRule(
  data: CreateRuleInput
): Promise<PricingRuleWithRelations> {
  return prisma.pricingRule.create({
    data: {
      shopId: data.shopId,
      name: data.name,
      description: data.description,
      priority: data.priority ?? 0,
      startDate: data.startDate,
      endDate: data.endDate,
      conditions: {
        create: data.conditions.map((c) => ({
          type: c.type,
          value: c.value,
          label: c.label,
        })),
      },
      tiers: {
        create: data.tiers.map((t) => ({
          minQuantity: t.minQuantity,
          maxQuantity: t.maxQuantity,
          valueType: t.valueType,
          value: new Decimal(t.value),
          message: t.message,
        })),
      },
    },
    include: {
      conditions: true,
      tiers: {
        orderBy: { minQuantity: "asc" },
      },
    },
  });
}

/**
 * Update a pricing rule
 * Replaces conditions and tiers if provided
 */
export async function updatePricingRule(
  ruleId: string,
  data: UpdateRuleInput
): Promise<PricingRuleWithRelations> {
  // Use transaction for atomic updates
  return prisma.$transaction(async (tx) => {
    // Delete existing conditions and tiers if new ones provided
    if (data.conditions) {
      await tx.ruleCondition.deleteMany({ where: { ruleId } });
    }
    if (data.tiers) {
      await tx.discountTier.deleteMany({ where: { ruleId } });
    }

    // Update rule with new data
    return tx.pricingRule.update({
      where: { id: ruleId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.priority !== undefined && { priority: data.priority }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.startDate !== undefined && { startDate: data.startDate }),
        ...(data.endDate !== undefined && { endDate: data.endDate }),
        // Reset sync status when rule changes
        syncedAt: null,
        syncError: null,
        ...(data.conditions && {
          conditions: {
            create: data.conditions.map((c) => ({
              type: c.type,
              value: c.value,
              label: c.label,
            })),
          },
        }),
        ...(data.tiers && {
          tiers: {
            create: data.tiers.map((t) => ({
              minQuantity: t.minQuantity,
              maxQuantity: t.maxQuantity,
              valueType: t.valueType,
              value: new Decimal(t.value),
              message: t.message,
            })),
          },
        }),
      },
      include: {
        conditions: true,
        tiers: {
          orderBy: { minQuantity: "asc" },
        },
      },
    });
  });
}

/**
 * Update rule status only
 */
export async function updateRuleStatus(
  ruleId: string,
  status: RuleStatus
): Promise<PricingRule> {
  return prisma.pricingRule.update({
    where: { id: ruleId },
    data: {
      status,
      // Clear sync status when deactivating
      ...(status !== "ACTIVE" && {
        syncedAt: null,
        syncError: null,
      }),
    },
  });
}

/**
 * Mark rule as synced
 */
export async function markRuleSynced(
  ruleId: string,
  error?: string
): Promise<PricingRule> {
  return prisma.pricingRule.update({
    where: { id: ruleId },
    data: {
      syncedAt: error ? undefined : new Date(),
      syncError: error || null,
    },
  });
}

/**
 * Delete a pricing rule (hard delete)
 */
export async function deletePricingRule(ruleId: string): Promise<void> {
  await prisma.pricingRule.delete({
    where: { id: ruleId },
  });
}

/**
 * Archive a pricing rule (soft delete)
 */
export async function archivePricingRule(ruleId: string): Promise<PricingRule> {
  return prisma.pricingRule.update({
    where: { id: ruleId },
    data: {
      status: "ARCHIVED",
      syncedAt: null,
      syncError: null,
    },
  });
}

/**
 * Duplicate a pricing rule
 */
export async function duplicatePricingRule(
  ruleId: string,
  newName?: string
): Promise<PricingRuleWithRelations> {
  const original = await getPricingRule(ruleId);

  if (!original) {
    throw new Error(`Rule ${ruleId} not found`);
  }

  return createPricingRule({
    shopId: original.shopId,
    name: newName || `${original.name} (Copy)`,
    description: original.description || undefined,
    priority: original.priority,
    startDate: original.startDate,
    endDate: original.endDate,
    conditions: original.conditions.map((c) => ({
      type: c.type,
      value: c.value,
      label: c.label || undefined,
    })),
    tiers: original.tiers.map((t) => ({
      minQuantity: t.minQuantity,
      maxQuantity: t.maxQuantity,
      valueType: t.valueType,
      value: Number(t.value),
      message: t.message || undefined,
    })),
  });
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate tier configuration
 */
export function validateTiers(
  tiers: { minQuantity: number; maxQuantity?: number | null; valueType?: DiscountType; value?: number }[]
): { valid: boolean; error?: string } {
  if (tiers.length === 0) {
    return { valid: false, error: "At least one tier is required" };
  }

  // Sort by minQuantity
  const sorted = [...tiers].sort((a, b) => a.minQuantity - b.minQuantity);

  for (let i = 0; i < sorted.length; i++) {
    const tier = sorted[i];

    // Min must be positive
    if (tier.minQuantity < 1) {
      return { valid: false, error: "Minimum quantity must be at least 1" };
    }

    // Max must be >= min if set
    if (tier.maxQuantity !== null && tier.maxQuantity !== undefined) {
      if (tier.maxQuantity < tier.minQuantity) {
        return { valid: false, error: "Maximum quantity cannot be less than minimum" };
      }
    }

    // Validate discount value
    if (tier.value !== undefined) {
      if (tier.value < 0) {
        return { valid: false, error: "Discount value cannot be negative" };
      }

      // Percentage discount cannot exceed 100%
      if (tier.valueType === "PERCENTAGE" && tier.value > 100) {
        return { valid: false, error: "Percentage discount cannot exceed 100%" };
      }
    }

    // Check for overlaps with next tier
    if (i < sorted.length - 1) {
      const nextTier = sorted[i + 1];
      const currentMax = tier.maxQuantity ?? Infinity;

      if (currentMax >= nextTier.minQuantity) {
        return { valid: false, error: "Tier ranges cannot overlap" };
      }
    }
  }

  return { valid: true };
}
