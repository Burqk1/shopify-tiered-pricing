/**
 * Geo Rules Model
 *
 * Handles CRUD operations for geo-targeting rules
 */

import prisma from "~/db.server";
import type { RuleStatus } from "@prisma/client";

// Re-export COUNTRY_DATA from shared utility
export { COUNTRY_DATA } from "~/utils/country-data";

// Types - will be from Prisma after migrate
type GeoAdjustmentType = "PERCENTAGE" | "FIXED_AMOUNT" | "FIXED_PRICE" | "MULTIPLIER";
type GeoApplyTo = "ALL_PRODUCTS" | "SPECIFIC_PRODUCTS" | "SPECIFIC_COLLECTIONS" | "EXCLUDE_SALE_ITEMS";
export type { GeoAdjustmentType, GeoApplyTo };

export interface CreateGeoRuleInput {
  shopId: string;
  name: string;
  priority?: number;
  countries: string[];
  regions?: string[];
  excludeCountries?: string[];
  adjustmentType?: GeoAdjustmentType;
  adjustmentValue: number;
  applyTo?: GeoApplyTo;
  productIds?: string[];
  collectionIds?: string[];
  showOriginalPrice?: boolean;
  pricePrefix?: string;
  displayCurrency?: string;
}

export interface UpdateGeoRuleInput extends Partial<CreateGeoRuleInput> {
  status?: RuleStatus;
}

// Get all geo rules for a shop
export async function getGeoRules(shopId: string) {
  return prisma.geoRule.findMany({
    where: { shopId },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });
}

// Get active geo rules for a country
export async function getActiveGeoRules(shopId: string, countryCode: string) {
  const rules = await prisma.geoRule.findMany({
    where: {
      shopId,
      status: "ACTIVE",
    },
    orderBy: [{ priority: "desc" }],
  });

  // Filter by country
  return rules.filter((rule) => {
    // Check exclusions first
    if (rule.excludeCountries.includes(countryCode)) return false;

    // Check if country is included
    return rule.countries.includes(countryCode) || rule.countries.length === 0;
  });
}

// Get single geo rule
export async function getGeoRule(id: string) {
  return prisma.geoRule.findUnique({
    where: { id },
  });
}

// Create geo rule
export async function createGeoRule(data: CreateGeoRuleInput) {
  return prisma.geoRule.create({
    data: {
      shopId: data.shopId,
      name: data.name,
      priority: data.priority || 0,
      countries: data.countries,
      regions: data.regions || [],
      excludeCountries: data.excludeCountries || [],
      adjustmentType: data.adjustmentType || "PERCENTAGE",
      adjustmentValue: data.adjustmentValue,
      applyTo: data.applyTo || "ALL_PRODUCTS",
      productIds: data.productIds || [],
      collectionIds: data.collectionIds || [],
      showOriginalPrice: data.showOriginalPrice ?? true,
      pricePrefix: data.pricePrefix,
      displayCurrency: data.displayCurrency,
    },
  });
}

// Update geo rule
export async function updateGeoRule(id: string, data: UpdateGeoRuleInput) {
  return prisma.geoRule.update({
    where: { id },
    data,
  });
}

// Delete geo rule
export async function deleteGeoRule(id: string) {
  return prisma.geoRule.delete({
    where: { id },
  });
}

// Update geo rule status
export async function updateGeoRuleStatus(id: string, status: RuleStatus) {
  return prisma.geoRule.update({
    where: { id },
    data: { status },
  });
}

// Calculate adjusted price
export function calculateGeoPrice(
  originalPrice: number,
  adjustmentType: GeoAdjustmentType,
  adjustmentValue: number
): number {
  const value = Number(adjustmentValue);

  switch (adjustmentType) {
    case "PERCENTAGE":
      return originalPrice * (1 + value / 100);

    case "FIXED_AMOUNT":
      return originalPrice + value;

    case "FIXED_PRICE":
      return value;

    case "MULTIPLIER":
      return originalPrice * value;

    default:
      return originalPrice;
  }
}

// Get best matching rule for a product
export function getBestGeoRule(
  rules: Array<{
    priority: number;
    applyTo: GeoApplyTo;
    productIds: string[];
    collectionIds: string[];
  }>,
  productId: string,
  collectionIds: string[],
  isOnSale: boolean
): typeof rules[0] | null {
  for (const rule of rules) {
    // Check if sale item should be excluded
    if (rule.applyTo === "EXCLUDE_SALE_ITEMS" && isOnSale) continue;

    // Check product targeting
    if (rule.applyTo === "SPECIFIC_PRODUCTS") {
      if (rule.productIds.includes(productId)) return rule;
      continue;
    }

    if (rule.applyTo === "SPECIFIC_COLLECTIONS") {
      if (rule.collectionIds.some((cid) => collectionIds.includes(cid))) return rule;
      continue;
    }

    // ALL_PRODUCTS or EXCLUDE_SALE_ITEMS (and not on sale)
    return rule;
  }

  return null;
}

// Detect country from request
export function detectCountryFromRequest(request: Request): string | null {
  // Shopify provides country in header
  const shopifyCountry = request.headers.get("X-Shopify-Country");
  if (shopifyCountry) return shopifyCountry;

  // Cloudflare header
  const cfCountry = request.headers.get("CF-IPCountry");
  if (cfCountry) return cfCountry;

  // Generic geo header
  const geoCountry = request.headers.get("X-Country-Code");
  if (geoCountry) return geoCountry;

  return null;
}
