/**
 * Plan Guard Utility
 *
 * Checks if user has access to specific features based on their plan.
 * Redirects to upgrade page if access is denied.
 */

import { redirect } from "@remix-run/node";
import { getShopByDomain, getPlanFeatures } from "~/models/shop.server";
import type { Plan } from "@prisma/client";

export type FeatureKey = keyof ReturnType<typeof getPlanFeatures>;

/**
 * Check if the shop has access to a specific feature
 * Throws redirect to settings page if access denied
 */
export async function requireFeatureAccess(
  shopDomain: string,
  feature: FeatureKey
): Promise<void> {
  const shop = await getShopByDomain(shopDomain);

  if (!shop) {
    throw redirect("/app");
  }

  const planFeatures = getPlanFeatures(shop.plan);

  if (!planFeatures[feature]) {
    throw redirect("/app/settings?upgrade=true&feature=" + feature);
  }
}

/**
 * Check if the shop has a specific plan or higher
 */
export async function requirePlan(
  shopDomain: string,
  minimumPlan: Plan
): Promise<void> {
  const shop = await getShopByDomain(shopDomain);

  if (!shop) {
    throw redirect("/app");
  }

  const planHierarchy: Record<Plan, number> = {
    FREE: 0,
    GROWTH: 1,
    PROFESSIONAL: 2,
  };

  if (planHierarchy[shop.plan] < planHierarchy[minimumPlan]) {
    throw redirect("/app/settings?upgrade=true&plan=" + minimumPlan);
  }
}

/**
 * Get the current plan without blocking
 * Useful for showing/hiding features in UI
 */
export async function getCurrentPlan(shopDomain: string): Promise<Plan | null> {
  const shop = await getShopByDomain(shopDomain);
  return shop?.plan ?? null;
}
