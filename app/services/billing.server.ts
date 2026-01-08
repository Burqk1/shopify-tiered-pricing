/**
 * Billing Service
 *
 * Handles Shopify Billing API integration for subscription management.
 * Supports FREE, GROWTH ($19/mo), and PROFESSIONAL ($49/mo) plans.
 */

import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import { updateShopPlan } from "~/models/shop.server";
import type { Plan } from "@prisma/client";

// ============================================================================
// TYPES
// ============================================================================

export interface PlanConfig {
  name: string;
  price: number;
  currencyCode: string;
  features: string[];
  ruleLimit: number | "unlimited";
}

export interface SubscriptionStatus {
  active: boolean;
  plan: Plan;
  currentPeriodEnd?: Date;
  trialDays?: number;
}

// ============================================================================
// PLAN CONFIGURATION
// ============================================================================

export const PLANS: Record<Plan, PlanConfig> = {
  FREE: {
    name: "Free",
    price: 0,
    currencyCode: "USD",
    features: [
      "1 Pricing Rule",
      "Basic Table Design",
      "Community Support",
    ],
    ruleLimit: 1,
  },
  GROWTH: {
    name: "Growth",
    price: 39.99,
    currencyCode: "USD",
    features: [
      "Unlimited Pricing Rules",
      "B2B Customer Tags",
      "CSS Customization",
      "POS Integration",
      "10 Languages Support",
      "Email Support",
    ],
    ruleLimit: "unlimited",
  },
  PROFESSIONAL: {
    name: "Professional",
    price: 89.99,
    currencyCode: "USD",
    features: [
      "Everything in Growth",
      "AI-Powered Pricing Suggestions",
      "Multi-Currency Support",
      "Priority Support",
      "Custom API Access",
      "Dedicated Account Manager",
    ],
    ruleLimit: "unlimited",
  },
};

// ============================================================================
// SUBSCRIPTION MANAGEMENT
// ============================================================================

/**
 * Create a new subscription (upgrade from FREE)
 * Returns confirmation URL for merchant approval
 */
export async function createSubscription(
  admin: AdminApiContext,
  shopDomain: string,
  plan: "GROWTH" | "PROFESSIONAL",
  returnUrl: string
): Promise<{ confirmationUrl: string } | { error: string }> {
  const planConfig = PLANS[plan];

  const mutation = `
    mutation CreateSubscription($name: String!, $returnUrl: URL!, $lineItems: [AppSubscriptionLineItemInput!]!) {
      appSubscriptionCreate(
        name: $name
        returnUrl: $returnUrl
        test: ${process.env.NODE_ENV !== "production"}
        lineItems: $lineItems
      ) {
        appSubscription {
          id
          status
        }
        confirmationUrl
        userErrors {
          field
          message
        }
      }
    }
  `;

  const response = await admin.graphql(mutation, {
    variables: {
      name: `Tiered Pricing - ${planConfig.name}`,
      returnUrl,
      lineItems: [
        {
          plan: {
            appRecurringPricingDetails: {
              price: {
                amount: planConfig.price,
                currencyCode: planConfig.currencyCode,
              },
              interval: "EVERY_30_DAYS",
            },
          },
        },
      ],
    },
  });

  const data = await response.json();

  if (data.data?.appSubscriptionCreate?.userErrors?.length > 0) {
    const errors = data.data.appSubscriptionCreate.userErrors;
    return { error: errors.map((e: { message: string }) => e.message).join(", ") };
  }

  const confirmationUrl = data.data?.appSubscriptionCreate?.confirmationUrl;

  if (!confirmationUrl) {
    return { error: "Failed to create subscription" };
  }

  return { confirmationUrl };
}

/**
 * Check current subscription status
 */
export async function getSubscriptionStatus(
  admin: AdminApiContext,
  shopDomain: string
): Promise<SubscriptionStatus> {
  const query = `
    query GetSubscription {
      currentAppInstallation {
        activeSubscriptions {
          id
          name
          status
          currentPeriodEnd
          trialDays
        }
      }
    }
  `;

  const response = await admin.graphql(query);
  const data = await response.json();

  const subscriptions = data.data?.currentAppInstallation?.activeSubscriptions || [];

  if (subscriptions.length === 0) {
    return { active: false, plan: "FREE" };
  }

  // Find active subscription
  const activeSubscription = subscriptions.find(
    (sub: { status: string }) => sub.status === "ACTIVE"
  );

  if (!activeSubscription) {
    return { active: false, plan: "FREE" };
  }

  // Determine plan from subscription name
  let plan: Plan = "FREE";
  if (activeSubscription.name.includes("Professional")) {
    plan = "PROFESSIONAL";
  } else if (activeSubscription.name.includes("Growth")) {
    plan = "GROWTH";
  }

  return {
    active: true,
    plan,
    currentPeriodEnd: activeSubscription.currentPeriodEnd
      ? new Date(activeSubscription.currentPeriodEnd)
      : undefined,
    trialDays: activeSubscription.trialDays,
  };
}

/**
 * Cancel subscription (downgrade to FREE)
 */
export async function cancelSubscription(
  admin: AdminApiContext,
  shopDomain: string
): Promise<{ success: boolean; error?: string }> {
  // Get active subscription ID
  const query = `
    query GetSubscription {
      currentAppInstallation {
        activeSubscriptions {
          id
          status
        }
      }
    }
  `;

  const queryResponse = await admin.graphql(query);
  const queryData = await queryResponse.json();

  const subscriptions = queryData.data?.currentAppInstallation?.activeSubscriptions || [];
  const activeSubscription = subscriptions.find(
    (sub: { status: string }) => sub.status === "ACTIVE"
  );

  if (!activeSubscription) {
    // No active subscription, just update local plan
    await updateShopPlan(shopDomain, "FREE");
    return { success: true };
  }

  // Cancel the subscription
  const mutation = `
    mutation CancelSubscription($id: ID!) {
      appSubscriptionCancel(id: $id) {
        appSubscription {
          id
          status
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const response = await admin.graphql(mutation, {
    variables: { id: activeSubscription.id },
  });

  const data = await response.json();

  if (data.data?.appSubscriptionCancel?.userErrors?.length > 0) {
    const errors = data.data.appSubscriptionCancel.userErrors;
    return { success: false, error: errors.map((e: { message: string }) => e.message).join(", ") };
  }

  // Update local plan
  await updateShopPlan(shopDomain, "FREE");

  return { success: true };
}

/**
 * Handle subscription approval callback
 * Called when merchant approves subscription
 */
export async function handleSubscriptionApproval(
  admin: AdminApiContext,
  shopDomain: string,
  chargeId: string
): Promise<{ success: boolean; plan?: Plan; error?: string }> {
  // Verify the charge is active
  const status = await getSubscriptionStatus(admin, shopDomain);

  if (!status.active) {
    return { success: false, error: "Subscription not active" };
  }

  // Update local plan
  await updateShopPlan(shopDomain, status.plan);

  return { success: true, plan: status.plan };
}

/**
 * Feature access by plan:
 *
 * FREE:
 *   - 1 pricing rule
 *   - Basic table design
 *
 * GROWTH ($39.99/mo):
 *   - Unlimited rules
 *   - B2B Customer Tags
 *   - CSS Customization
 *   - POS Integration
 *   - 10 Languages
 *
 * PROFESSIONAL ($89.99/mo):
 *   - Everything in Growth
 *   - AI-Powered Pricing
 *   - Multi-Currency
 *   - Priority Support
 *   - API Access
 */
export type Feature =
  | "unlimitedRules"
  | "customerTags"
  | "cssEditor"
  | "posIntegration"
  | "multiLanguage"
  | "aiPricing"
  | "multiCurrency"
  | "prioritySupport"
  | "apiAccess";

export function hasFeatureAccess(plan: Plan, feature: Feature): boolean {
  // FREE plan features
  const freeFeatures: Feature[] = [];

  // GROWTH plan features (includes FREE)
  const growthFeatures: Feature[] = [
    ...freeFeatures,
    "unlimitedRules",
    "customerTags",
    "cssEditor",
    "posIntegration",
    "multiLanguage",
  ];

  // PROFESSIONAL plan features (includes GROWTH)
  const professionalFeatures: Feature[] = [
    ...growthFeatures,
    "aiPricing",
    "multiCurrency",
    "prioritySupport",
    "apiAccess",
  ];

  switch (plan) {
    case "PROFESSIONAL":
      return professionalFeatures.includes(feature);
    case "GROWTH":
      return growthFeatures.includes(feature);
    case "FREE":
    default:
      return freeFeatures.includes(feature);
  }
}

/**
 * Get all features available for a plan
 */
export function getPlanFeatureList(plan: Plan): Feature[] {
  switch (plan) {
    case "PROFESSIONAL":
      return [
        "unlimitedRules",
        "customerTags",
        "cssEditor",
        "posIntegration",
        "multiLanguage",
        "aiPricing",
        "multiCurrency",
        "prioritySupport",
        "apiAccess",
      ];
    case "GROWTH":
      return [
        "unlimitedRules",
        "customerTags",
        "cssEditor",
        "posIntegration",
        "multiLanguage",
      ];
    case "FREE":
    default:
      return [];
  }
}
