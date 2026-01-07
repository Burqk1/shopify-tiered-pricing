/**
 * Shop Model - Data Access Layer
 *
 * Handles all shop-related database operations including
 * shop creation, retrieval, and plan management.
 */

import prisma from "~/db.server";
import type { Plan, Shop, PricingRule, RuleCondition, DiscountTier } from "@prisma/client";

// ============================================================================
// TYPES
// ============================================================================

export type ShopWithRules = Shop & {
  rules: (PricingRule & {
    conditions: RuleCondition[];
    tiers: DiscountTier[];
  })[];
};

export type { Shop, Plan };

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get or create a shop record
 * Called during OAuth callback to ensure shop exists in our database
 */
export async function getOrCreateShop(
  shopDomain: string,
  data?: {
    shopName?: string;
    email?: string;
    accessToken?: string;
  }
): Promise<Shop> {
  return prisma.shop.upsert({
    where: { shopDomain },
    update: {
      ...(data?.shopName && { shopName: data.shopName }),
      ...(data?.email && { email: data.email }),
      ...(data?.accessToken && { accessToken: data.accessToken }),
    },
    create: {
      shopDomain,
      shopName: data?.shopName,
      email: data?.email,
      accessToken: data?.accessToken,
    },
  });
}

/**
 * Get shop by domain
 */
export async function getShopByDomain(shopDomain: string): Promise<Shop | null> {
  return prisma.shop.findUnique({
    where: { shopDomain },
  });
}

/**
 * Get shop with all active rules
 * Includes conditions and tiers for each rule
 */
export async function getShopWithRules(shopDomain: string): Promise<ShopWithRules | null> {
  return prisma.shop.findUnique({
    where: { shopDomain },
    include: {
      rules: {
        where: {
          status: { not: "ARCHIVED" },
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
      },
    },
  });
}

/**
 * Get shop with rule count (for plan limit checking)
 */
export async function getShopWithRuleCount(shopDomain: string): Promise<{
  shop: Shop;
  activeRuleCount: number;
} | null> {
  const shop = await prisma.shop.findUnique({
    where: { shopDomain },
    include: {
      _count: {
        select: {
          rules: {
            where: {
              status: { in: ["DRAFT", "ACTIVE", "PAUSED"] },
            },
          },
        },
      },
    },
  });

  if (!shop) return null;

  return {
    shop,
    activeRuleCount: shop._count.rules,
  };
}

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Update shop plan
 */
export async function updateShopPlan(
  shopDomain: string,
  plan: Plan
): Promise<Shop> {
  const ruleLimit = plan === "FREE" ? 1 : -1; // -1 = unlimited

  return prisma.shop.update({
    where: { shopDomain },
    data: {
      plan,
      ruleLimit,
    },
  });
}

/**
 * Update shop access token
 */
export async function updateShopToken(
  shopDomain: string,
  accessToken: string
): Promise<Shop> {
  return prisma.shop.update({
    where: { shopDomain },
    data: { accessToken },
  });
}

/**
 * Delete shop and all associated data (GDPR compliance)
 */
export async function deleteShop(shopDomain: string): Promise<void> {
  await prisma.shop.delete({
    where: { shopDomain },
  });
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Check if shop can create more rules based on plan
 */
export async function canCreateRule(shopDomain: string): Promise<boolean> {
  const result = await getShopWithRuleCount(shopDomain);

  if (!result) return false;

  const { shop, activeRuleCount } = result;

  // Unlimited rules for paid plans
  if (shop.ruleLimit === -1) return true;

  return activeRuleCount < shop.ruleLimit;
}

/**
 * Get plan features
 */
export function getPlanFeatures(plan: Plan): {
  ruleLimit: number | "unlimited";
  customerTags: boolean;
  cssEditor: boolean;
  prioritySupport: boolean;
  multiCurrency: boolean;
  posIntegration: boolean;
} {
  switch (plan) {
    case "FREE":
      return {
        ruleLimit: 1,
        customerTags: false,
        cssEditor: false,
        prioritySupport: false,
        multiCurrency: false,
        posIntegration: true, // POS available on all plans
      };
    case "GROWTH":
      return {
        ruleLimit: "unlimited",
        customerTags: true,
        cssEditor: true,
        prioritySupport: false,
        multiCurrency: false,
        posIntegration: true,
      };
    case "PROFESSIONAL":
      return {
        ruleLimit: "unlimited",
        customerTags: true,
        cssEditor: true,
        prioritySupport: true,
        multiCurrency: true,
        posIntegration: true,
      };
  }
}

// ============================================================================
// CURRENCY SETTINGS
// ============================================================================

export interface CurrencySettings {
  currency: string;
  currencySymbol: string;
}

/**
 * Get currency settings for a shop
 */
export async function getCurrencySettings(shopDomain: string): Promise<CurrencySettings | null> {
  const shop = await prisma.shop.findUnique({
    where: { shopDomain },
    select: {
      currency: true,
      currencySymbol: true,
    },
  });

  return shop;
}

/**
 * Update currency settings for a shop
 */
export async function updateCurrencySettings(
  shopDomain: string,
  settings: Partial<CurrencySettings>
): Promise<Shop> {
  return prisma.shop.update({
    where: { shopDomain },
    data: {
      ...(settings.currency !== undefined && { currency: settings.currency }),
      ...(settings.currencySymbol !== undefined && { currencySymbol: settings.currencySymbol }),
    },
  });
}

// ============================================================================
// POS SETTINGS
// ============================================================================

export interface POSSettings {
  posEnabled: boolean;
  posShowTierInfo: boolean;
  posStaffOverride: boolean;
}

/**
 * Get POS settings for a shop
 */
export async function getPOSSettings(shopDomain: string): Promise<POSSettings | null> {
  const shop = await prisma.shop.findUnique({
    where: { shopDomain },
    select: {
      posEnabled: true,
      posShowTierInfo: true,
      posStaffOverride: true,
    },
  });

  return shop;
}

/**
 * Update POS settings for a shop
 */
export async function updatePOSSettings(
  shopDomain: string,
  settings: Partial<POSSettings>
): Promise<Shop> {
  return prisma.shop.update({
    where: { shopDomain },
    data: {
      ...(settings.posEnabled !== undefined && { posEnabled: settings.posEnabled }),
      ...(settings.posShowTierInfo !== undefined && { posShowTierInfo: settings.posShowTierInfo }),
      ...(settings.posStaffOverride !== undefined && { posStaffOverride: settings.posStaffOverride }),
    },
  });
}
