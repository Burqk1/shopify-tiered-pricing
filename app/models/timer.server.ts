/**
 * Countdown Timer Server Functions
 */

import prisma from "~/db.server";
import type { RuleStatus, TimerShowOn } from "@prisma/client";

interface CreateTimerInput {
  shopId: string;
  name: string;
  endTime: Date;
  timezone?: string;
  title?: string;
  style?: string;
  bgColor?: string;
  textColor?: string;
  expiredMessage?: string;
  hideOnExpiry?: boolean;
  showOn?: TimerShowOn;
  productIds?: string[];
  collectionIds?: string[];
  linkedRuleId?: string;
}

export async function createTimer(input: CreateTimerInput) {
  return prisma.countdownTimer.create({
    data: {
      shopId: input.shopId,
      name: input.name,
      endTime: input.endTime,
      timezone: input.timezone || "UTC",
      title: input.title || "Sale ends in:",
      style: input.style || "default",
      bgColor: input.bgColor || "#ff4444",
      textColor: input.textColor || "#ffffff",
      expiredMessage: input.expiredMessage,
      hideOnExpiry: input.hideOnExpiry || false,
      showOn: input.showOn || "ALL_PAGES",
      productIds: input.productIds || [],
      collectionIds: input.collectionIds || [],
      linkedRuleId: input.linkedRuleId,
      status: "DRAFT",
    },
  });
}

export async function updateTimer(
  id: string,
  data: Partial<Omit<CreateTimerInput, "shopId">>
) {
  return prisma.countdownTimer.update({
    where: { id },
    data,
  });
}

export async function updateTimerStatus(id: string, status: RuleStatus) {
  return prisma.countdownTimer.update({
    where: { id },
    data: { status },
  });
}

export async function deleteTimer(id: string) {
  return prisma.countdownTimer.delete({
    where: { id },
  });
}

export async function getTimerById(id: string) {
  return prisma.countdownTimer.findUnique({
    where: { id },
  });
}

export async function getTimersByShop(shopId: string) {
  return prisma.countdownTimer.findMany({
    where: { shopId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getActiveTimersForStorefront(shopId: string) {
  const now = new Date();
  return prisma.countdownTimer.findMany({
    where: {
      shopId,
      status: "ACTIVE",
      endTime: { gt: now }, // Not expired
    },
  });
}

/**
 * Check and expire timers, optionally disable linked rules
 */
export async function processExpiredTimers() {
  const now = new Date();

  const expiredTimers = await prisma.countdownTimer.findMany({
    where: {
      status: "ACTIVE",
      endTime: { lte: now },
    },
  });

  for (const timer of expiredTimers) {
    // Update timer status
    await prisma.countdownTimer.update({
      where: { id: timer.id },
      data: { status: "ARCHIVED" },
    });

    // If linked to a rule, pause that rule
    if (timer.linkedRuleId) {
      await prisma.pricingRule.update({
        where: { id: timer.linkedRuleId },
        data: { status: "PAUSED" },
      });
    }
  }

  return expiredTimers.length;
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate timer input
 */
export function validateTimerInput(
  input: { endTime: Date; name?: string },
  options?: { allowPastDates?: boolean }
): { valid: boolean; error?: string } {
  // Validate name
  if (input.name !== undefined && input.name.trim().length === 0) {
    return { valid: false, error: "Timer name is required" };
  }

  // Validate end time is not in the past (unless explicitly allowed)
  if (!options?.allowPastDates) {
    const now = new Date();
    if (input.endTime <= now) {
      return { valid: false, error: "End time must be in the future" };
    }
  }

  // Validate end time is not too far in the future (max 1 year)
  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() + 1);
  if (input.endTime > maxDate) {
    return { valid: false, error: "End time cannot be more than 1 year in the future" };
  }

  return { valid: true };
}
