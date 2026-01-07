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
 * Tiered pricing configuration from metafield
 * @typedef {Object} Tier
 * @property {number} minQuantity
 * @property {number} [maxQuantity]
 * @property {"PERCENTAGE" | "FIXED_AMOUNT" | "FIXED_PRICE"} discountType
 * @property {number} discountValue
 * @property {string} [message]
 */

/**
 * Compressed tier format from sync engine
 * @typedef {Object} CompressedTier
 * @property {number} min
 * @property {number} [max]
 * @property {string} vt - valueType
 * @property {number} v - value
 * @property {string} [m] - message
 */

/**
 * Product group for quantity aggregation
 * @typedef {Object} ProductGroup
 * @property {Array<{id: string, quantity: number}>} lines
 * @property {number} totalQuantity
 * @property {Tier[]} tiers
 */

// ============================================================================
// OPTIMIZED TIER MATCHING (Binary Search for sorted tiers)
// ============================================================================

/**
 * Find the applicable tier using optimized search
 * Assumes tiers are sorted by minQuantity ascending
 * Uses binary search for O(log n) performance on large tier sets
 *
 * @param {Tier[]} tiers - Pre-sorted tiers
 * @param {number} quantity
 * @returns {Tier | null}
 */
function findApplicableTier(tiers, quantity) {
  if (!tiers || tiers.length === 0) return null;

  // For small tier arrays (≤5), linear search is faster
  if (tiers.length <= 5) {
    let bestTier = null;
    for (let i = 0; i < tiers.length; i++) {
      const tier = tiers[i];
      if (quantity >= tier.minQuantity) {
        if (tier.maxQuantity === undefined || tier.maxQuantity === null || quantity <= tier.maxQuantity) {
          // Keep the tier with highest minQuantity that matches
          if (!bestTier || tier.minQuantity > bestTier.minQuantity) {
            bestTier = tier;
          }
        }
      }
    }
    return bestTier;
  }

  // Binary search for larger arrays
  let left = 0;
  let right = tiers.length - 1;
  let bestTier = null;

  while (left <= right) {
    const mid = (left + right) >>> 1; // Faster than Math.floor
    const tier = tiers[mid];

    if (quantity >= tier.minQuantity) {
      // Check maxQuantity constraint
      if (tier.maxQuantity === undefined || tier.maxQuantity === null || quantity <= tier.maxQuantity) {
        bestTier = tier;
      }
      // Look for higher minQuantity match
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  return bestTier;
}

/**
 * Parse and normalize tiers from metafield
 * Handles both compressed format and standard format
 *
 * @param {string} metafieldValue
 * @returns {Tier[] | null}
 */
function parseTiers(metafieldValue) {
  if (!metafieldValue) return null;

  try {
    const parsed = JSON.parse(metafieldValue);

    // Handle compressed format from sync engine
    if (parsed.t && Array.isArray(parsed.t)) {
      return parsed.t.map(normalizeCompressedTier).sort(sortByMinQuantity);
    }

    // Handle array of compressed tiers
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].min !== undefined) {
      return parsed.map(normalizeCompressedTier).sort(sortByMinQuantity);
    }

    // Handle standard format
    if (parsed.tiers && Array.isArray(parsed.tiers)) {
      return parsed.tiers.sort(sortByMinQuantity);
    }

    // Handle direct array
    if (Array.isArray(parsed)) {
      return parsed.sort(sortByMinQuantity);
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Convert compressed tier to standard format
 * @param {CompressedTier} ct
 * @returns {Tier}
 */
function normalizeCompressedTier(ct) {
  return {
    minQuantity: ct.min,
    maxQuantity: ct.max,
    discountType: /** @type {"PERCENTAGE" | "FIXED_AMOUNT" | "FIXED_PRICE"} */ (ct.vt),
    discountValue: ct.v,
    message: ct.m,
  };
}

/**
 * Sort comparator for tiers
 * @param {Tier} a
 * @param {Tier} b
 * @returns {number}
 */
function sortByMinQuantity(a, b) {
  return a.minQuantity - b.minQuantity;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * @param {RunInput} input
 * @returns {FunctionRunResult}
 */
export function run(input) {
  const cart = input?.cart;

  // Early exit for empty cart
  if (!cart?.lines || cart.lines.length === 0) {
    return EMPTY_DISCOUNT;
  }

  /** @type {Map<string, ProductGroup>} */
  const productGroups = new Map();

  // Single pass: group cart lines by product
  const lines = cart.lines;
  const lineCount = lines.length;

  for (let i = 0; i < lineCount; i++) {
    const line = lines[i];
    const merchandise = line.merchandise;

    // Only process ProductVariant merchandise
    if (merchandise.__typename !== "ProductVariant") {
      continue;
    }

    const product = merchandise.product;
    if (!product) continue;

    // Check for tiered pricing eligibility
    const hasTag = product.hasAnyTag;
    const metafieldValue = product.metafield?.value;

    if (!hasTag && !metafieldValue) {
      continue;
    }

    const productId = product.id;
    let group = productGroups.get(productId);

    if (!group) {
      // Parse tiers only once per product
      const tiers = metafieldValue ? parseTiers(metafieldValue) : null;
      if (!tiers) continue;

      group = {
        lines: [],
        totalQuantity: 0,
        tiers: tiers,
      };
      productGroups.set(productId, group);
    }

    // Add line to group
    group.lines.push({
      id: line.id,
      quantity: line.quantity,
    });
    group.totalQuantity += line.quantity;
  }

  // Early exit if no products with tiered pricing
  if (productGroups.size === 0) {
    return EMPTY_DISCOUNT;
  }

  // Process groups and build discounts
  /** @type {Discount[]} */
  const discounts = [];

  for (const group of productGroups.values()) {
    const tier = findApplicableTier(group.tiers, group.totalQuantity);
    if (!tier) continue;

    // Build targets array
    const groupLines = group.lines;
    const targetCount = groupLines.length;
    /** @type {Target[]} */
    const targets = new Array(targetCount);

    for (let i = 0; i < targetCount; i++) {
      targets[i] = { cartLine: { id: groupLines[i].id } };
    }

    // Create discount based on type
    const discountValue = tier.discountValue;
    const totalQty = group.totalQuantity;

    if (tier.discountType === "PERCENTAGE") {
      discounts.push({
        targets,
        value: {
          percentage: {
            value: String(discountValue),
          },
        },
        message: tier.message || `${discountValue}% off for buying ${totalQty}+ items`,
      });
    } else if (tier.discountType === "FIXED_AMOUNT") {
      discounts.push({
        targets,
        value: {
          fixedAmount: {
            amount: String(discountValue),
          },
        },
        message: tier.message || `$${discountValue} off for buying ${totalQty}+ items`,
      });
    }
    // Note: FIXED_PRICE requires price data for calculation
  }

  if (discounts.length === 0) {
    return EMPTY_DISCOUNT;
  }

  return {
    discountApplicationStrategy: DiscountApplicationStrategy.All,
    discounts,
  };
}
