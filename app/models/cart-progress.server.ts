/**
 * Cart Progress Bar Model
 *
 * Handles CRUD operations for cart progress bars
 * (Free shipping bars, discount unlock progress, etc.)
 */

import prisma from "~/db.server";
import type { RuleStatus } from "@prisma/client";

// Types - will be from Prisma after migrate
type ProgressBarType = "FREE_SHIPPING" | "DISCOUNT_UNLOCK" | "FREE_GIFT" | "TIERED_PROGRESS";
type RewardType = "FREE_SHIPPING" | "PERCENTAGE_DISCOUNT" | "FIXED_DISCOUNT" | "FREE_GIFT";
type ProgressShowOn = "CART_PAGE" | "CART_DRAWER" | "PRODUCT_PAGES" | "ALL_PAGES" | "ANNOUNCEMENT_BAR";

export interface CreateProgressBarInput {
  shopId: string;
  name: string;
  progressType?: ProgressBarType;
  threshold: number;
  rewardType?: RewardType;
  rewardValue?: number;
  rewardProductId?: string;
  barStyle?: string;
  barColor?: string;
  bgColor?: string;
  textColor?: string;
  emptyMessage?: string;
  progressMessage?: string;
  completeMessage?: string;
  showOn?: ProgressShowOn;
  countryFilter?: string[];
  customerTags?: string[];
  startDate?: Date;
  endDate?: Date;
}

export interface UpdateProgressBarInput extends Partial<CreateProgressBarInput> {
  status?: RuleStatus;
}

// Get all progress bars for a shop
export async function getProgressBars(shopId: string) {
  return prisma.cartProgressBar.findMany({
    where: { shopId },
    orderBy: { createdAt: "desc" },
  });
}

// Get active progress bars for storefront
export async function getActiveProgressBars(shopId: string, country?: string, customerTags?: string[]) {
  const now = new Date();

  const bars = await prisma.cartProgressBar.findMany({
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
    orderBy: { createdAt: "desc" },
  });

  // Filter by country and customer tags
  return bars.filter((bar) => {
    // Country filter
    if (bar.countryFilter.length > 0 && country) {
      if (!bar.countryFilter.includes(country)) return false;
    }

    // Customer tag filter
    if (bar.customerTags.length > 0 && customerTags) {
      const hasTag = bar.customerTags.some((tag) => customerTags.includes(tag));
      if (!hasTag) return false;
    }

    return true;
  });
}

// Get single progress bar
export async function getProgressBar(id: string) {
  return prisma.cartProgressBar.findUnique({
    where: { id },
  });
}

// Create progress bar
export async function createProgressBar(data: CreateProgressBarInput) {
  return prisma.cartProgressBar.create({
    data: {
      shopId: data.shopId,
      name: data.name,
      progressType: data.progressType || "FREE_SHIPPING",
      threshold: data.threshold,
      rewardType: data.rewardType || "FREE_SHIPPING",
      rewardValue: data.rewardValue,
      rewardProductId: data.rewardProductId,
      barStyle: data.barStyle || "default",
      barColor: data.barColor || "#4CAF50",
      bgColor: data.bgColor || "#e0e0e0",
      textColor: data.textColor || "#333333",
      emptyMessage: data.emptyMessage || "Add {amount} to get free shipping!",
      progressMessage: data.progressMessage || "Only {amount} away from free shipping!",
      completeMessage: data.completeMessage || "You've unlocked free shipping!",
      showOn: data.showOn || "CART_PAGE",
      countryFilter: data.countryFilter || [],
      customerTags: data.customerTags || [],
      startDate: data.startDate,
      endDate: data.endDate,
    },
  });
}

// Update progress bar
export async function updateProgressBar(id: string, data: UpdateProgressBarInput) {
  return prisma.cartProgressBar.update({
    where: { id },
    data,
  });
}

// Delete progress bar
export async function deleteProgressBar(id: string) {
  return prisma.cartProgressBar.delete({
    where: { id },
  });
}

// Update progress bar status
export async function updateProgressBarStatus(id: string, status: RuleStatus) {
  return prisma.cartProgressBar.update({
    where: { id },
    data: { status },
  });
}

// Track impression
export async function trackProgressBarImpression(id: string) {
  return prisma.cartProgressBar.update({
    where: { id },
    data: { impressions: { increment: 1 } },
  });
}

// Track completion (threshold reached)
export async function trackProgressBarCompletion(id: string, orderValue: number) {
  return prisma.cartProgressBar.update({
    where: { id },
    data: {
      completions: { increment: 1 },
      revenueGenerated: { increment: orderValue },
    },
  });
}

// Calculate progress for cart
export function calculateProgress(cartTotal: number, threshold: number) {
  if (cartTotal >= threshold) {
    return {
      progress: 100,
      remaining: 0,
      completed: true,
    };
  }

  return {
    progress: Math.round((cartTotal / threshold) * 100),
    remaining: threshold - cartTotal,
    completed: false,
  };
}

// Format message with amount placeholder
export function formatProgressMessage(
  message: string,
  amount: number,
  currencySymbol: string = "$"
) {
  return message.replace("{amount}", `${currencySymbol}${amount.toFixed(2)}`);
}
