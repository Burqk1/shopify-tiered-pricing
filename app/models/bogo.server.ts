/**
 * BOGO (Buy One Get One) Model
 *
 * Handles CRUD operations for BOGO offers
 */

import prisma from "~/db.server";
import type { RuleStatus, DiscountType } from "@prisma/client";

// Types - will be from Prisma after migrate
type BogoType = "BUY_X_GET_Y_FREE" | "BUY_X_GET_Y_PERCENT" | "BUY_X_GET_Y_FIXED" | "SPEND_X_GET_Y";
export type { BogoType };

export interface CreateBogoInput {
  shopId: string;
  name: string;
  description?: string;
  bogoType?: BogoType;
  buyQuantity?: number;
  buyProductIds?: string[];
  buyCollectionIds?: string[];
  buyMinAmount?: number;
  getQuantity?: number;
  getProductIds?: string[];
  getCollectionIds?: string[];
  discountType?: DiscountType;
  discountValue?: number;
  maxUsesPerOrder?: number;
  maxUsesTotal?: number;
  customerTags?: string[];
  newCustomersOnly?: boolean;
  startDate?: Date;
  endDate?: Date;
  stackable?: boolean;
  priority?: number;
}

export interface UpdateBogoInput extends Partial<CreateBogoInput> {
  status?: RuleStatus;
}

// Get all BOGO offers for a shop
export async function getBogoOffers(shopId: string) {
  return prisma.bogoOffer.findMany({
    where: { shopId },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });
}

// Get active BOGO offers for storefront
export async function getActiveBogoOffers(
  shopId: string,
  customerTags?: string[],
  isNewCustomer?: boolean
) {
  const now = new Date();

  const offers = await prisma.bogoOffer.findMany({
    where: {
      shopId,
      status: "ACTIVE",
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
        {
          OR: [
            { maxUsesTotal: null },
            { usesCount: { lt: prisma.bogoOffer.fields.maxUsesTotal } },
          ],
        },
      ],
    },
    orderBy: [{ priority: "desc" }],
  });

  // Filter by customer criteria
  return offers.filter((offer) => {
    // New customers only filter
    if (offer.newCustomersOnly && !isNewCustomer) return false;

    // Customer tag filter
    if (offer.customerTags.length > 0 && customerTags) {
      const hasTag = offer.customerTags.some((tag) => customerTags.includes(tag));
      if (!hasTag) return false;
    }

    return true;
  });
}

// Get single BOGO offer
export async function getBogoOffer(id: string) {
  return prisma.bogoOffer.findUnique({
    where: { id },
  });
}

// Create BOGO offer
export async function createBogoOffer(data: CreateBogoInput) {
  return prisma.bogoOffer.create({
    data: {
      shopId: data.shopId,
      name: data.name,
      description: data.description,
      bogoType: data.bogoType || "BUY_X_GET_Y_FREE",
      buyQuantity: data.buyQuantity || 1,
      buyProductIds: data.buyProductIds || [],
      buyCollectionIds: data.buyCollectionIds || [],
      buyMinAmount: data.buyMinAmount,
      getQuantity: data.getQuantity || 1,
      getProductIds: data.getProductIds || [],
      getCollectionIds: data.getCollectionIds || [],
      discountType: data.discountType || "PERCENTAGE",
      discountValue: data.discountValue || 100,
      maxUsesPerOrder: data.maxUsesPerOrder,
      maxUsesTotal: data.maxUsesTotal,
      customerTags: data.customerTags || [],
      newCustomersOnly: data.newCustomersOnly || false,
      startDate: data.startDate,
      endDate: data.endDate,
      stackable: data.stackable || false,
      priority: data.priority || 0,
    },
  });
}

// Update BOGO offer
export async function updateBogoOffer(id: string, data: UpdateBogoInput) {
  return prisma.bogoOffer.update({
    where: { id },
    data,
  });
}

// Delete BOGO offer
export async function deleteBogoOffer(id: string) {
  return prisma.bogoOffer.delete({
    where: { id },
  });
}

// Update BOGO offer status
export async function updateBogoStatus(id: string, status: RuleStatus) {
  return prisma.bogoOffer.update({
    where: { id },
    data: { status },
  });
}

// Track BOGO usage
export async function trackBogoUsage(id: string, discountAmount: number) {
  return prisma.bogoOffer.update({
    where: { id },
    data: {
      usesCount: { increment: 1 },
      ordersUsed: { increment: 1 },
      totalDiscountGiven: { increment: discountAmount },
    },
  });
}

// Check if BOGO applies to cart items
export interface CartItem {
  productId: string;
  variantId?: string;
  collectionIds?: string[];
  quantity: number;
  price: number;
}

export function checkBogoApplicability(
  offer: {
    bogoType: BogoType;
    buyQuantity: number;
    buyProductIds: string[];
    buyCollectionIds: string[];
    buyMinAmount: number | null;
    getProductIds: string[];
    getCollectionIds: string[];
  },
  cartItems: CartItem[],
  cartTotal: number
): { applies: boolean; qualifyingItems: CartItem[]; freeItems: CartItem[] } {
  let qualifyingItems: CartItem[] = [];
  let freeItems: CartItem[] = [];

  // Check buy condition
  if (offer.bogoType === "SPEND_X_GET_Y") {
    // Spend threshold
    if (offer.buyMinAmount && cartTotal < Number(offer.buyMinAmount)) {
      return { applies: false, qualifyingItems: [], freeItems: [] };
    }
    qualifyingItems = cartItems;
  } else {
    // Quantity-based
    const buyProducts = offer.buyProductIds.length > 0
      ? cartItems.filter((item) => offer.buyProductIds.includes(item.productId))
      : offer.buyCollectionIds.length > 0
        ? cartItems.filter((item) =>
            item.collectionIds?.some((cid) => offer.buyCollectionIds.includes(cid))
          )
        : cartItems;

    const totalBuyQuantity = buyProducts.reduce((sum, item) => sum + item.quantity, 0);

    if (totalBuyQuantity < offer.buyQuantity) {
      return { applies: false, qualifyingItems: [], freeItems: [] };
    }

    qualifyingItems = buyProducts;
  }

  // Determine free items
  if (offer.getProductIds.length > 0) {
    freeItems = cartItems.filter((item) => offer.getProductIds.includes(item.productId));
  } else if (offer.getCollectionIds.length > 0) {
    freeItems = cartItems.filter((item) =>
      item.collectionIds?.some((cid) => offer.getCollectionIds.includes(cid))
    );
  } else {
    // Same as buy products (classic BOGO)
    freeItems = qualifyingItems;
  }

  return {
    applies: freeItems.length > 0,
    qualifyingItems,
    freeItems,
  };
}

// Calculate BOGO discount
export function calculateBogoDiscount(
  offer: {
    discountType: DiscountType;
    discountValue: number;
    getQuantity: number;
    maxUsesPerOrder?: number | null;
  },
  freeItems: CartItem[]
): number {
  if (freeItems.length === 0) return 0;

  // Sort by price ascending to discount cheapest items
  const sortedItems = [...freeItems].sort((a, b) => a.price - b.price);

  let itemsToDiscount = offer.getQuantity;
  if (offer.maxUsesPerOrder) {
    itemsToDiscount = Math.min(itemsToDiscount, offer.maxUsesPerOrder);
  }

  let totalDiscount = 0;
  let discountedCount = 0;

  for (const item of sortedItems) {
    if (discountedCount >= itemsToDiscount) break;

    const qtyToDiscount = Math.min(item.quantity, itemsToDiscount - discountedCount);

    if (offer.discountType === "PERCENTAGE") {
      totalDiscount += (item.price * qtyToDiscount * Number(offer.discountValue)) / 100;
    } else {
      totalDiscount += Math.min(Number(offer.discountValue), item.price) * qtyToDiscount;
    }

    discountedCount += qtyToDiscount;
  }

  return totalDiscount;
}
