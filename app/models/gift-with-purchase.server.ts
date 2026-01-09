/**
 * Gift with Purchase Model
 *
 * Handles CRUD operations for gift with purchase offers
 */

import prisma from "~/db.server";
import type { RuleStatus } from "@prisma/client";

// Types - will be from Prisma after migrate
type GiftTriggerType = "MIN_SPEND" | "MIN_QUANTITY" | "SPECIFIC_PRODUCT" | "SPECIFIC_COLLECTION";
export type { GiftTriggerType };

export interface CreateGiftInput {
  shopId: string;
  name: string;
  triggerType?: GiftTriggerType;
  triggerValue: number;
  triggerProductIds?: string[];
  triggerCollectionIds?: string[];
  giftProductId: string;
  giftVariantId?: string;
  giftTitle?: string;
  giftQuantity?: number;
  giftDiscountPercent?: number;
  showProgressBar?: boolean;
  progressMessage?: string;
  claimedMessage?: string;
  giftImageUrl?: string;
  maxPerOrder?: number;
  maxTotal?: number;
  customerTags?: string[];
  countryFilter?: string[];
  newCustomersOnly?: boolean;
  startDate?: Date;
  endDate?: Date;
  autoAddToCart?: boolean;
}

export interface UpdateGiftInput extends Partial<CreateGiftInput> {
  status?: RuleStatus;
}

// Get all gifts for a shop
export async function getGiftsWithPurchase(shopId: string) {
  return prisma.giftWithPurchase.findMany({
    where: { shopId },
    orderBy: { createdAt: "desc" },
  });
}

// Get active gifts for storefront
export async function getActiveGifts(
  shopId: string,
  country?: string,
  customerTags?: string[],
  isNewCustomer?: boolean
) {
  const now = new Date();

  const gifts = await prisma.giftWithPurchase.findMany({
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
      ],
    },
    orderBy: { triggerValue: "asc" },
  });

  // Filter by criteria
  return gifts.filter((gift) => {
    // Max total limit
    if (gift.maxTotal && gift.givenCount >= gift.maxTotal) return false;

    // New customers only
    if (gift.newCustomersOnly && !isNewCustomer) return false;

    // Country filter
    if (gift.countryFilter.length > 0 && country) {
      if (!gift.countryFilter.includes(country)) return false;
    }

    // Customer tag filter
    if (gift.customerTags.length > 0 && customerTags) {
      const hasTag = gift.customerTags.some((tag) => customerTags.includes(tag));
      if (!hasTag) return false;
    }

    return true;
  });
}

// Get single gift
export async function getGiftWithPurchase(id: string) {
  return prisma.giftWithPurchase.findUnique({
    where: { id },
  });
}

// Create gift
export async function createGiftWithPurchase(data: CreateGiftInput) {
  return prisma.giftWithPurchase.create({
    data: {
      shopId: data.shopId,
      name: data.name,
      triggerType: data.triggerType || "MIN_SPEND",
      triggerValue: data.triggerValue,
      triggerProductIds: data.triggerProductIds || [],
      triggerCollectionIds: data.triggerCollectionIds || [],
      giftProductId: data.giftProductId,
      giftVariantId: data.giftVariantId,
      giftTitle: data.giftTitle,
      giftQuantity: data.giftQuantity || 1,
      giftDiscountPercent: data.giftDiscountPercent || 100,
      showProgressBar: data.showProgressBar ?? true,
      progressMessage: data.progressMessage || "Spend {amount} more to get a FREE gift!",
      claimedMessage: data.claimedMessage || "FREE Gift Added!",
      giftImageUrl: data.giftImageUrl,
      maxPerOrder: data.maxPerOrder || 1,
      maxTotal: data.maxTotal,
      customerTags: data.customerTags || [],
      countryFilter: data.countryFilter || [],
      newCustomersOnly: data.newCustomersOnly || false,
      startDate: data.startDate,
      endDate: data.endDate,
      autoAddToCart: data.autoAddToCart ?? true,
    },
  });
}

// Update gift
export async function updateGiftWithPurchase(id: string, data: UpdateGiftInput) {
  return prisma.giftWithPurchase.update({
    where: { id },
    data,
  });
}

// Delete gift
export async function deleteGiftWithPurchase(id: string) {
  return prisma.giftWithPurchase.delete({
    where: { id },
  });
}

// Update gift status
export async function updateGiftStatus(id: string, status: RuleStatus) {
  return prisma.giftWithPurchase.update({
    where: { id },
    data: { status },
  });
}

// Track gift given
export async function trackGiftGiven(id: string) {
  return prisma.giftWithPurchase.update({
    where: { id },
    data: { givenCount: { increment: 1 } },
  });
}

// Check if gift qualifies
export interface CartItem {
  productId: string;
  collectionIds?: string[];
  quantity: number;
  price: number;
}

export function checkGiftQualification(
  gift: {
    triggerType: GiftTriggerType;
    triggerValue: number;
    triggerProductIds: string[];
    triggerCollectionIds: string[];
  },
  cartItems: CartItem[],
  cartTotal: number
): { qualifies: boolean; progress: number; remaining: number } {
  const triggerValue = Number(gift.triggerValue);

  switch (gift.triggerType) {
    case "MIN_SPEND": {
      const qualifies = cartTotal >= triggerValue;
      return {
        qualifies,
        progress: Math.min(100, Math.round((cartTotal / triggerValue) * 100)),
        remaining: Math.max(0, triggerValue - cartTotal),
      };
    }

    case "MIN_QUANTITY": {
      const totalQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);
      const qualifies = totalQuantity >= triggerValue;
      return {
        qualifies,
        progress: Math.min(100, Math.round((totalQuantity / triggerValue) * 100)),
        remaining: Math.max(0, triggerValue - totalQuantity),
      };
    }

    case "SPECIFIC_PRODUCT": {
      const matchingItems = cartItems.filter((item) =>
        gift.triggerProductIds.includes(item.productId)
      );
      const matchingQuantity = matchingItems.reduce((sum, item) => sum + item.quantity, 0);
      const qualifies = matchingQuantity >= triggerValue;
      return {
        qualifies,
        progress: Math.min(100, Math.round((matchingQuantity / triggerValue) * 100)),
        remaining: Math.max(0, triggerValue - matchingQuantity),
      };
    }

    case "SPECIFIC_COLLECTION": {
      const matchingItems = cartItems.filter((item) =>
        item.collectionIds?.some((cid) => gift.triggerCollectionIds.includes(cid))
      );
      const matchingTotal = matchingItems.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );
      const qualifies = matchingTotal >= triggerValue;
      return {
        qualifies,
        progress: Math.min(100, Math.round((matchingTotal / triggerValue) * 100)),
        remaining: Math.max(0, triggerValue - matchingTotal),
      };
    }

    default:
      return { qualifies: false, progress: 0, remaining: triggerValue };
  }
}

// Format message with placeholders
export function formatGiftMessage(
  message: string,
  amount: number,
  currencySymbol: string = "$"
) {
  return message.replace("{amount}", `${currencySymbol}${amount.toFixed(2)}`);
}
