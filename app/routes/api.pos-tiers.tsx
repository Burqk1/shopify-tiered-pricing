/**
 * POS API Route
 *
 * Provides tier data for Shopify POS integration.
 * Called when staff scans or selects products in POS.
 */

import type { LoaderFunctionArgs } from "@remix-run/node";
import { getActiveRulesForSync } from "~/models/pricing-rule.server";
import {
  getShopByDomain,
  getPOSSettings,
  getCurrencySettings,
} from "~/models/shop.server";
import {
  checkRateLimit,
  getRateLimitHeaders,
  getIdentifierFromRequest,
  createRateLimitResponse,
} from "~/services/rate-limiter.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  // Rate limiting check
  const identifier = getIdentifierFromRequest(request);
  const rateLimitResult = checkRateLimit(identifier, "api");

  if (!rateLimitResult.allowed) {
    return createRateLimitResponse(rateLimitResult.retryAfter!);
  }

  // Get shop domain from headers (POS sends this)
  const shopDomain =
    url.searchParams.get("shop") ||
    request.headers.get("X-Shopify-Shop-Domain");

  if (!shopDomain) {
    return Response.json({ error: "Missing shop domain" }, { status: 400 });
  }

  // Get product IDs (can be multiple for cart)
  const productIds = url.searchParams.getAll("product_id");
  const variantIds = url.searchParams.getAll("variant_id");
  const customerTags = url.searchParams.get("customer_tags")?.split(",") || [];

  if (productIds.length === 0 && variantIds.length === 0) {
    return Response.json(
      { error: "Missing product_id or variant_id" },
      { status: 400 }
    );
  }

  try {
    // Get shop from database
    const shop = await getShopByDomain(shopDomain);

    if (!shop) {
      return Response.json({ tiers: [], posEnabled: false });
    }

    // Get POS settings separately
    const posSettings = await getPOSSettings(shopDomain);

    // Check if POS is enabled for this shop
    if (!posSettings?.posEnabled) {
      return Response.json({
        tiers: [],
        posEnabled: false,
        message: "POS integration is disabled for this shop",
      });
    }

    // Get active rules for this shop
    const rules = await getActiveRulesForSync(shop.id);

    // Build response for each product
    const productTiers: Record<
      string,
      {
        productId: string;
        ruleName: string | null;
        tiers: Array<{
          min: number;
          max: number | null;
          valueType: string;
          value: number;
          message: string | null;
        }>;
      }
    > = {};

    for (const productId of productIds) {
      // Find applicable rule for this product
      const applicableRule = rules.find((rule) =>
        rule.conditions.some((condition) => {
          // Check ALL_PRODUCTS
          if (condition.type === "ALL_PRODUCTS") return true;

          // Check specific product
          if (condition.type === "PRODUCT" && condition.value === productId)
            return true;

          // Check customer tags
          if (
            condition.type === "CUSTOMER_TAG" &&
            customerTags.includes(condition.value)
          )
            return true;

          return false;
        })
      );

      if (applicableRule) {
        productTiers[productId] = {
          productId,
          ruleName: applicableRule.name,
          tiers: applicableRule.tiers.map((tier) => ({
            min: tier.minQuantity,
            max: tier.maxQuantity,
            valueType: tier.valueType,
            value: Number(tier.value),
            message: tier.message,
          })),
        };
      } else {
        productTiers[productId] = {
          productId,
          ruleName: null,
          tiers: [],
        };
      }
    }

    // Add rate limit headers to response
    const headers = getRateLimitHeaders(identifier, "api");

    return Response.json(
      {
        posEnabled: posSettings.posEnabled,
        showTierInfo: posSettings.posShowTierInfo,
        staffOverride: posSettings.posStaffOverride,
        products: productTiers,
      },
      { headers }
    );
  } catch (error) {
    console.error("Failed to get POS tiers:", error);
    return Response.json(
      { error: "Internal server error", products: {} },
      { status: 500 }
    );
  }
};

/**
 * Calculate discount for a given quantity
 * Used by POS to show real-time discount amount
 */
export const action = async ({ request }: LoaderFunctionArgs) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  // Rate limiting check
  const identifier = getIdentifierFromRequest(request);
  const rateLimitResult = checkRateLimit(identifier, "api");

  if (!rateLimitResult.allowed) {
    return createRateLimitResponse(rateLimitResult.retryAfter!);
  }

  try {
    const body = await request.json();
    const { shopDomain, items, customerTags = [] } = body;

    if (!shopDomain || !items || !Array.isArray(items)) {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    // Get shop from database
    const shop = await getShopByDomain(shopDomain);

    if (!shop) {
      return Response.json({ discounts: [], total: 0 });
    }

    // Get POS settings
    const posSettings = await getPOSSettings(shopDomain);

    if (!posSettings?.posEnabled) {
      return Response.json({ discounts: [], total: 0 });
    }

    // Get currency settings
    const currencySettings = await getCurrencySettings(shopDomain);
    const currency = currencySettings?.currency || "USD";

    // Get active rules
    const rules = await getActiveRulesForSync(shop.id);

    // Calculate discounts for each item
    const discounts: Array<{
      productId: string;
      quantity: number;
      originalPrice: number;
      discountedPrice: number;
      discountAmount: number;
      discountPercent: number;
      tierApplied: string | null;
    }> = [];

    let totalDiscount = 0;

    for (const item of items) {
      const { productId, quantity, price } = item;

      // Find applicable rule
      const applicableRule = rules.find((rule) =>
        rule.conditions.some((condition) => {
          if (condition.type === "ALL_PRODUCTS") return true;
          if (condition.type === "PRODUCT" && condition.value === productId)
            return true;
          if (
            condition.type === "CUSTOMER_TAG" &&
            customerTags.includes(condition.value)
          )
            return true;
          return false;
        })
      );

      if (!applicableRule) {
        discounts.push({
          productId,
          quantity,
          originalPrice: price,
          discountedPrice: price,
          discountAmount: 0,
          discountPercent: 0,
          tierApplied: null,
        });
        continue;
      }

      // Find applicable tier based on quantity
      const applicableTier = applicableRule.tiers.find(
        (tier) =>
          quantity >= tier.minQuantity &&
          (tier.maxQuantity === null || quantity <= tier.maxQuantity)
      );

      if (!applicableTier) {
        discounts.push({
          productId,
          quantity,
          originalPrice: price,
          discountedPrice: price,
          discountAmount: 0,
          discountPercent: 0,
          tierApplied: null,
        });
        continue;
      }

      // Calculate discount
      let discountAmount = 0;
      let discountedPrice = price;

      if (applicableTier.valueType === "PERCENTAGE") {
        discountAmount = (price * Number(applicableTier.value)) / 100;
        discountedPrice = price - discountAmount;
      } else {
        // FIXED_AMOUNT
        discountAmount = Math.min(Number(applicableTier.value), price);
        discountedPrice = price - discountAmount;
      }

      const discountPercent = price > 0 ? (discountAmount / price) * 100 : 0;

      totalDiscount += discountAmount * quantity;

      discounts.push({
        productId,
        quantity,
        originalPrice: price,
        discountedPrice: Math.max(0, discountedPrice),
        discountAmount,
        discountPercent,
        tierApplied: `${applicableTier.minQuantity}${
          applicableTier.maxQuantity ? `-${applicableTier.maxQuantity}` : "+"
        } items`,
      });
    }

    const headers = getRateLimitHeaders(identifier, "api");

    return Response.json(
      {
        discounts,
        totalDiscount,
        currency,
      },
      { headers }
    );
  } catch (error) {
    console.error("Failed to calculate POS discounts:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
};
