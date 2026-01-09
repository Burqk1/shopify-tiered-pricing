/**
 * Stackable Discount Model
 *
 * Handles combining multiple discounts together
 */

import prisma from "~/db.server";
import type { RuleStatus } from "@prisma/client";

// Types - will be from Prisma after migrate
type StackMethod = "BEST_DISCOUNT" | "COMBINE_ALL" | "SEQUENTIAL" | "CAPPED";
export type { StackMethod };

export interface CreateStackableInput {
  shopId: string;
  name: string;
  stackMethod?: StackMethod;
  maxStackCount?: number;
  allowTiered?: boolean;
  allowBogo?: boolean;
  allowBundles?: boolean;
  allowCoupons?: boolean;
  allowAutomatic?: boolean;
  maxTotalDiscount?: number;
  maxDiscountAmount?: number;
  preserveMinMargin?: number;
}

export interface UpdateStackableInput extends Partial<CreateStackableInput> {
  status?: RuleStatus;
}

// Get stackable settings for a shop
export async function getStackableSettings(shopId: string) {
  return prisma.stackableDiscount.findUnique({
    where: { shopId },
  });
}

// Create or update stackable settings
export async function upsertStackableSettings(data: CreateStackableInput) {
  return prisma.stackableDiscount.upsert({
    where: { shopId: data.shopId },
    update: {
      name: data.name,
      stackMethod: data.stackMethod,
      maxStackCount: data.maxStackCount,
      allowTiered: data.allowTiered,
      allowBogo: data.allowBogo,
      allowBundles: data.allowBundles,
      allowCoupons: data.allowCoupons,
      allowAutomatic: data.allowAutomatic,
      maxTotalDiscount: data.maxTotalDiscount,
      maxDiscountAmount: data.maxDiscountAmount,
      preserveMinMargin: data.preserveMinMargin,
    },
    create: {
      shopId: data.shopId,
      name: data.name,
      stackMethod: data.stackMethod || "BEST_DISCOUNT",
      maxStackCount: data.maxStackCount || 2,
      allowTiered: data.allowTiered ?? true,
      allowBogo: data.allowBogo ?? true,
      allowBundles: data.allowBundles ?? true,
      allowCoupons: data.allowCoupons ?? true,
      allowAutomatic: data.allowAutomatic ?? true,
      maxTotalDiscount: data.maxTotalDiscount,
      maxDiscountAmount: data.maxDiscountAmount,
      preserveMinMargin: data.preserveMinMargin,
    },
  });
}

// Update stackable status
export async function updateStackableStatus(shopId: string, status: RuleStatus) {
  return prisma.stackableDiscount.update({
    where: { shopId },
    data: { status },
  });
}

// Discount types for stacking
export interface DiscountToStack {
  type: "tiered" | "bogo" | "bundle" | "coupon" | "automatic";
  name: string;
  discountPercent?: number;
  discountAmount?: number;
  priority?: number;
}

// Calculate stacked discounts
export function calculateStackedDiscounts(
  settings: {
    stackMethod: StackMethod;
    maxStackCount: number;
    allowTiered: boolean;
    allowBogo: boolean;
    allowBundles: boolean;
    allowCoupons: boolean;
    allowAutomatic: boolean;
    maxTotalDiscount?: number | null;
    maxDiscountAmount?: number | null;
    preserveMinMargin?: number | null;
  },
  discounts: DiscountToStack[],
  originalPrice: number,
  costPrice?: number
): {
  finalPrice: number;
  totalDiscount: number;
  appliedDiscounts: DiscountToStack[];
  method: StackMethod;
} {
  // Filter allowed discount types
  const allowedDiscounts = discounts.filter((d) => {
    switch (d.type) {
      case "tiered":
        return settings.allowTiered;
      case "bogo":
        return settings.allowBogo;
      case "bundle":
        return settings.allowBundles;
      case "coupon":
        return settings.allowCoupons;
      case "automatic":
        return settings.allowAutomatic;
      default:
        return true;
    }
  });

  if (allowedDiscounts.length === 0) {
    return {
      finalPrice: originalPrice,
      totalDiscount: 0,
      appliedDiscounts: [],
      method: settings.stackMethod,
    };
  }

  // Sort by priority (higher first) then by discount amount
  const sortedDiscounts = [...allowedDiscounts].sort((a, b) => {
    if ((b.priority || 0) !== (a.priority || 0)) {
      return (b.priority || 0) - (a.priority || 0);
    }
    const aDiscount = a.discountAmount || (originalPrice * (a.discountPercent || 0)) / 100;
    const bDiscount = b.discountAmount || (originalPrice * (b.discountPercent || 0)) / 100;
    return bDiscount - aDiscount;
  });

  let finalPrice = originalPrice;
  let totalDiscount = 0;
  const appliedDiscounts: DiscountToStack[] = [];

  switch (settings.stackMethod) {
    case "BEST_DISCOUNT": {
      // Only apply the best discount
      const best = sortedDiscounts[0];
      if (best) {
        const discount = best.discountAmount ||
          (originalPrice * (best.discountPercent || 0)) / 100;
        totalDiscount = discount;
        finalPrice = originalPrice - discount;
        appliedDiscounts.push(best);
      }
      break;
    }

    case "COMBINE_ALL": {
      // Add all discount percentages together
      let totalPercent = 0;
      let totalFixed = 0;

      for (const d of sortedDiscounts.slice(0, settings.maxStackCount)) {
        if (d.discountPercent) totalPercent += d.discountPercent;
        if (d.discountAmount) totalFixed += d.discountAmount;
        appliedDiscounts.push(d);
      }

      totalDiscount = (originalPrice * totalPercent) / 100 + totalFixed;
      finalPrice = originalPrice - totalDiscount;
      break;
    }

    case "SEQUENTIAL": {
      // Apply discounts one after another (compounding)
      let currentPrice = originalPrice;

      for (const d of sortedDiscounts.slice(0, settings.maxStackCount)) {
        let discount = 0;
        if (d.discountPercent) {
          discount = (currentPrice * d.discountPercent) / 100;
        } else if (d.discountAmount) {
          discount = Math.min(d.discountAmount, currentPrice);
        }

        currentPrice -= discount;
        totalDiscount += discount;
        appliedDiscounts.push(d);
      }

      finalPrice = currentPrice;
      break;
    }

    case "CAPPED": {
      // Combine until cap is reached
      for (const d of sortedDiscounts) {
        if (appliedDiscounts.length >= settings.maxStackCount) break;

        let discount = 0;
        if (d.discountPercent) {
          discount = (originalPrice * d.discountPercent) / 100;
        } else if (d.discountAmount) {
          discount = d.discountAmount;
        }

        // Check max total discount percent
        if (settings.maxTotalDiscount) {
          const newTotalPercent = ((totalDiscount + discount) / originalPrice) * 100;
          if (newTotalPercent > Number(settings.maxTotalDiscount)) {
            const maxDiscount = (originalPrice * Number(settings.maxTotalDiscount)) / 100;
            discount = maxDiscount - totalDiscount;
            if (discount <= 0) break;
          }
        }

        // Check max discount amount
        if (settings.maxDiscountAmount) {
          if (totalDiscount + discount > Number(settings.maxDiscountAmount)) {
            discount = Number(settings.maxDiscountAmount) - totalDiscount;
            if (discount <= 0) break;
          }
        }

        totalDiscount += discount;
        appliedDiscounts.push(d);
      }

      finalPrice = originalPrice - totalDiscount;
      break;
    }
  }

  // Preserve minimum margin
  if (costPrice && settings.preserveMinMargin) {
    const minMargin = Number(settings.preserveMinMargin);
    const minPrice = costPrice * (1 + minMargin / 100);

    if (finalPrice < minPrice) {
      finalPrice = minPrice;
      totalDiscount = originalPrice - finalPrice;
    }
  }

  // Ensure price doesn't go negative
  if (finalPrice < 0) {
    finalPrice = 0;
    totalDiscount = originalPrice;
  }

  return {
    finalPrice: Math.round(finalPrice * 100) / 100,
    totalDiscount: Math.round(totalDiscount * 100) / 100,
    appliedDiscounts,
    method: settings.stackMethod,
  };
}
