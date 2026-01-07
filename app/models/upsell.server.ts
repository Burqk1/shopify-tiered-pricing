/**
 * Post-Purchase Upsell Model - Database operations for upsell offers
 */

import prisma from "~/db.server";
import type { RuleStatus, DiscountType, PPTriggerType } from "@prisma/client";

// ============================================================================
// QUERIES
// ============================================================================

export async function getUpsellOffers(shopId: string) {
  const offers = await prisma.postPurchaseOffer.findMany({
    where: { shopId },
    orderBy: { createdAt: "desc" },
  });

  return offers.map((offer) => ({
    id: offer.id,
    name: offer.name,
    status: offer.status,
    triggerType: offer.triggerType,
    triggerProductIds: offer.triggerProductIds,
    triggerCollectionIds: offer.triggerCollectionIds,
    minOrderValue: offer.minOrderValue ? Number(offer.minOrderValue) : null,
    offerProductId: offer.offerProductId,
    offerVariantId: offer.offerVariantId,
    offerTitle: offer.offerTitle,
    offerDescription: offer.offerDescription,
    offerProductTitle: offer.offerTitle || "", // Will be enriched with Shopify data
    offerProductImage: "", // Will be enriched with Shopify data
    discountType: offer.discountType,
    discountValue: Number(offer.discountValue),
    originalPrice: 0, // Will be calculated from Shopify
    discountedPrice: 0, // Will be calculated
    headline: offer.headline,
    subheadline: offer.subheadline,
    ctaText: offer.ctaText,
    declineText: offer.declineText,
    showTimer: offer.showTimer,
    timerDuration: offer.timerDuration,
    impressions: offer.impressions,
    conversions: offer.conversions,
    revenue: Number(offer.revenue),
    conversionRate: offer.impressions > 0 ? (offer.conversions / offer.impressions) * 100 : 0,
    bgColor: offer.bgColor,
    accentColor: offer.accentColor,
    textColor: offer.textColor,
  }));
}

export async function getUpsellOfferById(offerId: string) {
  return prisma.postPurchaseOffer.findUnique({
    where: { id: offerId },
  });
}

export async function getActiveUpsellOffers(shopId: string) {
  return prisma.postPurchaseOffer.findMany({
    where: {
      shopId,
      status: "ACTIVE",
    },
  });
}

export async function getUpsellStats(shopId: string) {
  const offers = await prisma.postPurchaseOffer.findMany({
    where: { shopId },
    select: {
      status: true,
      impressions: true,
      conversions: true,
      revenue: true,
    },
  });

  const totalOffers = offers.length;
  const activeOffers = offers.filter((o) => o.status === "ACTIVE").length;
  const totalImpressions = offers.reduce((sum, o) => sum + o.impressions, 0);
  const totalConversions = offers.reduce((sum, o) => sum + o.conversions, 0);
  const totalRevenue = offers.reduce((sum, o) => sum + Number(o.revenue), 0);
  const avgConversionRate = totalImpressions > 0 ? (totalConversions / totalImpressions) * 100 : 0;

  return {
    totalOffers,
    activeOffers,
    totalImpressions,
    totalConversions,
    totalRevenue,
    avgConversionRate: Math.round(avgConversionRate * 100) / 100,
  };
}

// ============================================================================
// MUTATIONS
// ============================================================================

interface CreateUpsellInput {
  shopId: string;
  name: string;
  triggerType: PPTriggerType;
  triggerProductIds?: string[];
  triggerCollectionIds?: string[];
  minOrderValue?: number;
  offerProductId: string;
  offerVariantId?: string;
  offerTitle?: string;
  offerDescription?: string;
  discountType: DiscountType;
  discountValue: number;
  headline?: string;
  subheadline?: string;
  ctaText?: string;
  declineText?: string;
  showTimer?: boolean;
  timerDuration?: number;
  bgColor?: string;
  accentColor?: string;
  textColor?: string;
}

export async function createUpsellOffer(input: CreateUpsellInput) {
  return prisma.postPurchaseOffer.create({
    data: {
      shopId: input.shopId,
      name: input.name,
      status: "DRAFT",
      triggerType: input.triggerType,
      triggerProductIds: input.triggerProductIds || [],
      triggerCollectionIds: input.triggerCollectionIds || [],
      minOrderValue: input.minOrderValue,
      offerProductId: input.offerProductId,
      offerVariantId: input.offerVariantId,
      offerTitle: input.offerTitle,
      offerDescription: input.offerDescription,
      discountType: input.discountType,
      discountValue: input.discountValue,
      headline: input.headline || "Wait! Special offer just for you",
      subheadline: input.subheadline,
      ctaText: input.ctaText || "Add to Order",
      declineText: input.declineText || "No thanks",
      showTimer: input.showTimer ?? true,
      timerDuration: input.timerDuration || 300,
      bgColor: input.bgColor || "#ffffff",
      accentColor: input.accentColor || "#000000",
      textColor: input.textColor || "#000000",
    },
  });
}

interface UpdateUpsellInput {
  name?: string;
  triggerType?: PPTriggerType;
  triggerProductIds?: string[];
  triggerCollectionIds?: string[];
  minOrderValue?: number | null;
  offerProductId?: string;
  offerVariantId?: string | null;
  offerTitle?: string | null;
  offerDescription?: string | null;
  discountType?: DiscountType;
  discountValue?: number;
  headline?: string;
  subheadline?: string | null;
  ctaText?: string;
  declineText?: string;
  showTimer?: boolean;
  timerDuration?: number;
  bgColor?: string;
  accentColor?: string;
  textColor?: string;
}

export async function updateUpsellOffer(offerId: string, data: UpdateUpsellInput) {
  return prisma.postPurchaseOffer.update({
    where: { id: offerId },
    data,
  });
}

export async function updateUpsellStatus(offerId: string, status: RuleStatus) {
  return prisma.postPurchaseOffer.update({
    where: { id: offerId },
    data: { status },
  });
}

export async function deleteUpsellOffer(offerId: string) {
  return prisma.postPurchaseOffer.delete({
    where: { id: offerId },
  });
}

// ============================================================================
// TRACKING
// ============================================================================

export async function trackImpression(offerId: string) {
  return prisma.postPurchaseOffer.update({
    where: { id: offerId },
    data: {
      impressions: { increment: 1 },
    },
  });
}

export async function trackConversion(offerId: string, orderAmount: number) {
  return prisma.postPurchaseOffer.update({
    where: { id: offerId },
    data: {
      conversions: { increment: 1 },
      revenue: { increment: orderAmount },
    },
  });
}

// ============================================================================
// MATCHING - Find applicable offers for an order
// ============================================================================

interface OrderContext {
  shopId: string;
  orderTotal: number;
  productIds: string[];
  collectionIds: string[];
  isFirstTimeBuyer: boolean;
  isReturningCustomer: boolean;
}

export async function findApplicableOffers(context: OrderContext) {
  const offers = await prisma.postPurchaseOffer.findMany({
    where: {
      shopId: context.shopId,
      status: "ACTIVE",
    },
  });

  return offers.filter((offer) => {
    switch (offer.triggerType) {
      case "ALL_ORDERS":
        return true;

      case "SPECIFIC_PRODUCTS":
        return offer.triggerProductIds.some((id) => context.productIds.includes(id));

      case "SPECIFIC_COLLECTIONS":
        return offer.triggerCollectionIds.some((id) => context.collectionIds.includes(id));

      case "MIN_ORDER_VALUE":
        return offer.minOrderValue ? context.orderTotal >= Number(offer.minOrderValue) : true;

      case "FIRST_TIME_BUYERS":
        return context.isFirstTimeBuyer;

      case "RETURNING_CUSTOMERS":
        return context.isReturningCustomer;

      default:
        return false;
    }
  });
}
