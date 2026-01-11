// @ts-check
import { DiscountApplicationStrategy } from "../generated/api";

/**
 * @typedef {import("../generated/api").RunInput} RunInput
 * @typedef {import("../generated/api").FunctionRunResult} FunctionRunResult
 * @typedef {import("../generated/api").Discount} Discount
 * @typedef {import("../generated/api").Target} Target
 */

/**
 * Pre-allocated empty result for performance
 * @type {FunctionRunResult}
 */
const EMPTY_DISCOUNT = {
  discountApplicationStrategy: DiscountApplicationStrategy.First,
  discounts: [],
};

/**
 * Tiered pricing configuration
 * @typedef {Object} Tier
 * @property {number} minQuantity
 * @property {number} [maxQuantity]
 * @property {"PERCENTAGE" | "FIXED_AMOUNT"} valueType
 * @property {number} value
 */

/**
 * Discount configuration from metafield
 * @typedef {Object} DiscountConfig
 * @property {Tier[]} tiers
 * @property {string[]} productIds
 * @property {string[]} collectionIds
 * @property {boolean} allProducts
 */

// ============================================================================
// TIER MATCHING
// ============================================================================

/**
 * Find the applicable tier for a given quantity
 * @param {Tier[]} tiers
 * @param {number} quantity
 * @returns {Tier | null}
 */
function findApplicableTier(tiers, quantity) {
  if (!tiers || tiers.length === 0) return null;

  // Sort tiers by minQuantity descending to find the best match
  const sortedTiers = [...tiers].sort((a, b) => b.minQuantity - a.minQuantity);

  for (const tier of sortedTiers) {
    if (quantity >= tier.minQuantity) {
      // Check maxQuantity if defined
      if (tier.maxQuantity === undefined || tier.maxQuantity === null || quantity <= tier.maxQuantity) {
        return tier;
      }
    }
  }

  return null;
}

/**
 * Parse configuration from discount metafield
 * @param {string | null | undefined} metafieldValue
 * @returns {DiscountConfig | null}
 */
function parseConfig(metafieldValue) {
  if (!metafieldValue) return null;

  try {
    const config = JSON.parse(metafieldValue);

    // Validate required fields
    if (!config.tiers || !Array.isArray(config.tiers)) {
      return null;
    }

    return {
      tiers: config.tiers,
      productIds: config.productIds || [],
      collectionIds: config.collectionIds || [],
      allProducts: config.allProducts || false,
    };
  } catch {
    return null;
  }
}

/**
 * Check if a product matches the discount conditions
 * @param {string} productId
 * @param {DiscountConfig} config
 * @returns {boolean}
 */
function productMatchesConfig(productId, config) {
  // If allProducts is true, match everything
  if (config.allProducts) {
    return true;
  }

  // Check if product ID is in the list
  if (config.productIds && config.productIds.length > 0) {
    return config.productIds.includes(productId);
  }

  // Note: Collection matching would require additional data in the query
  // For now, if no specific products are set and allProducts is false, no match
  return false;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * @param {RunInput} input
 * @returns {FunctionRunResult}
 */
export function run(input) {
  // Get configuration from discount metafield
  const metafieldValue = input?.discountNode?.metafield?.value;
  const config = parseConfig(metafieldValue);

  if (!config) {
    return EMPTY_DISCOUNT;
  }

  const cart = input?.cart;

  // Early exit for empty cart
  if (!cart?.lines || cart.lines.length === 0) {
    return EMPTY_DISCOUNT;
  }

  // Group cart lines by product and calculate quantities
  /** @type {Map<string, {lines: Array<{id: string, quantity: number}>, totalQuantity: number}>} */
  const productGroups = new Map();

  for (const line of cart.lines) {
    const merchandise = line.merchandise;

    // Only process ProductVariant merchandise
    if (merchandise.__typename !== "ProductVariant") {
      continue;
    }

    const product = merchandise.product;
    if (!product) continue;

    const productId = product.id;

    // Check if product matches discount conditions
    if (!productMatchesConfig(productId, config)) {
      continue;
    }

    let group = productGroups.get(productId);

    if (!group) {
      group = {
        lines: [],
        totalQuantity: 0,
      };
      productGroups.set(productId, group);
    }

    group.lines.push({
      id: line.id,
      quantity: line.quantity,
    });
    group.totalQuantity += line.quantity;
  }

  // Early exit if no matching products
  if (productGroups.size === 0) {
    return EMPTY_DISCOUNT;
  }

  // Build discounts for each product group
  /** @type {Discount[]} */
  const discounts = [];

  for (const [productId, group] of productGroups) {
    const tier = findApplicableTier(config.tiers, group.totalQuantity);

    if (!tier) {
      continue; // Quantity doesn't meet any tier
    }

    // Build targets
    /** @type {Target[]} */
    const targets = group.lines.map((line) => ({
      cartLine: { id: line.id },
    }));

    // Create discount based on type
    if (tier.valueType === "PERCENTAGE") {
      discounts.push({
        targets,
        value: {
          percentage: {
            value: String(tier.value),
          },
        },
        message: `${tier.value}% volume discount (${group.totalQuantity} items)`,
      });
    } else if (tier.valueType === "FIXED_AMOUNT") {
      discounts.push({
        targets,
        value: {
          fixedAmount: {
            amount: String(tier.value),
          },
        },
        message: `Volume discount (${group.totalQuantity} items)`,
      });
    }
  }

  if (discounts.length === 0) {
    return EMPTY_DISCOUNT;
  }

  return {
    discountApplicationStrategy: DiscountApplicationStrategy.All,
    discounts,
  };
}
