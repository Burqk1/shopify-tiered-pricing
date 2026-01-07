/**
 * A/B Test Model - Database operations for A/B testing
 */

import prisma from "~/db.server";
import type { ABTestStatus, ABTestType, ABTargetType, ABEventType, ABPriceType } from "@prisma/client";

// ============================================================================
// QUERIES
// ============================================================================

export async function getABTestsByShop(shopId: string) {
  const tests = await prisma.aBTest.findMany({
    where: { shopId },
    include: {
      variants: true,
      results: {
        select: {
          eventType: true,
          variantId: true,
          orderAmount: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Calculate stats for each test
  return tests.map((test) => {
    const variantsWithStats = test.variants.map((variant) => {
      const variantResults = test.results.filter((r) => r.variantId === variant.id);
      const views = variantResults.filter((r) => r.eventType === "VIEW").length;
      const addToCarts = variantResults.filter((r) => r.eventType === "ADD_TO_CART").length;
      const purchases = variantResults.filter((r) => r.eventType === "PURCHASE").length;
      const revenue = variantResults
        .filter((r) => r.eventType === "PURCHASE" && r.orderAmount)
        .reduce((sum, r) => sum + Number(r.orderAmount || 0), 0);

      return {
        id: variant.id,
        name: variant.name,
        isControl: variant.isControl,
        priceType: variant.priceType,
        priceValue: variant.priceValue ? Number(variant.priceValue) : null,
        views,
        addToCarts,
        purchases,
        revenue,
        conversionRate: views > 0 ? (purchases / views) * 100 : 0,
      };
    });

    return {
      id: test.id,
      name: test.name,
      description: test.description,
      status: test.status,
      testType: test.testType,
      targetType: test.targetType,
      targetValue: test.targetValue,
      splitPercent: test.splitPercent,
      startDate: test.startDate?.toISOString().split("T")[0],
      endDate: test.endDate?.toISOString().split("T")[0],
      winnerVariantId: test.winnerVariantId,
      variants: variantsWithStats,
    };
  });
}

export async function getABTestById(testId: string) {
  return prisma.aBTest.findUnique({
    where: { id: testId },
    include: {
      variants: true,
    },
  });
}

export async function getABTestStats(shopId: string) {
  const tests = await prisma.aBTest.findMany({
    where: { shopId },
    include: {
      results: {
        where: { eventType: "PURCHASE" },
        select: { orderAmount: true },
      },
    },
  });

  const activeTests = tests.filter((t) => t.status === "RUNNING").length;
  const completedTests = tests.filter((t) => t.status === "COMPLETED").length;

  // Calculate total revenue lift (simplified)
  const totalRevenue = tests.reduce((sum, test) => {
    const testRevenue = test.results.reduce((r, res) => r + Number(res.orderAmount || 0), 0);
    return sum + testRevenue;
  }, 0);

  return {
    activeTests,
    completedTests,
    totalRevenueLift: totalRevenue,
    avgConversionLift: completedTests > 0 ? 15 : 0, // Placeholder
  };
}

// ============================================================================
// MUTATIONS
// ============================================================================

interface CreateABTestInput {
  shopId: string;
  name: string;
  description?: string;
  testType: ABTestType;
  targetType: ABTargetType;
  targetValue?: string;
  splitPercent?: number;
  startDate?: Date;
  endDate?: Date;
  controlValue: string;
  variantValue: string;
}

export async function createABTest(input: CreateABTestInput) {
  const {
    shopId,
    name,
    description,
    testType,
    targetType,
    targetValue,
    splitPercent = 50,
    startDate,
    endDate,
    controlValue,
    variantValue,
  } = input;

  return prisma.aBTest.create({
    data: {
      shopId,
      name,
      description,
      testType,
      targetType,
      targetValue,
      splitPercent,
      startDate,
      endDate,
      status: "DRAFT",
      variants: {
        create: [
          {
            name: `Control (${controlValue})`,
            isControl: true,
            priceType: testType === "DISCOUNT" ? "PERCENT_OFF" : "FIXED",
            priceValue: parseFloat(controlValue) || 0,
          },
          {
            name: `Variant B (${variantValue})`,
            isControl: false,
            priceType: testType === "DISCOUNT" ? "PERCENT_OFF" : "FIXED",
            priceValue: parseFloat(variantValue) || 0,
          },
        ],
      },
    },
    include: {
      variants: true,
    },
  });
}

export async function updateABTestStatus(testId: string, status: ABTestStatus) {
  const updateData: { status: ABTestStatus; startDate?: Date; endDate?: Date } = { status };

  if (status === "RUNNING") {
    updateData.startDate = new Date();
  } else if (status === "COMPLETED") {
    updateData.endDate = new Date();
  }

  return prisma.aBTest.update({
    where: { id: testId },
    data: updateData,
  });
}

export async function selectWinner(testId: string, variantId: string) {
  return prisma.aBTest.update({
    where: { id: testId },
    data: {
      status: "COMPLETED",
      winnerVariantId: variantId,
      winnerSelectedAt: new Date(),
      endDate: new Date(),
    },
  });
}

export async function deleteABTest(testId: string) {
  return prisma.aBTest.delete({
    where: { id: testId },
  });
}

// ============================================================================
// EVENT TRACKING
// ============================================================================

interface TrackEventInput {
  testId: string;
  variantId: string;
  sessionId: string;
  customerId?: string;
  eventType: ABEventType;
  productId?: string;
  variantProductId?: string;
  orderId?: string;
  orderAmount?: number;
  quantity?: number;
}

export async function trackABTestEvent(input: TrackEventInput) {
  return prisma.aBTestResult.create({
    data: {
      testId: input.testId,
      variantId: input.variantId,
      sessionId: input.sessionId,
      customerId: input.customerId,
      eventType: input.eventType,
      productId: input.productId,
      variantProductId: input.variantProductId,
      orderId: input.orderId,
      orderAmount: input.orderAmount,
      quantity: input.quantity,
    },
  });
}

// Get which variant a session should see
export async function getSessionVariant(testId: string, sessionId: string) {
  // Check if session already has an assigned variant
  const existing = await prisma.aBTestResult.findFirst({
    where: {
      testId,
      sessionId,
    },
    select: {
      variantId: true,
    },
  });

  if (existing) {
    return existing.variantId;
  }

  // Assign a new variant based on split percentage
  const test = await prisma.aBTest.findUnique({
    where: { id: testId },
    include: {
      variants: true,
    },
  });

  if (!test || test.variants.length < 2) {
    return null;
  }

  const controlVariant = test.variants.find((v) => v.isControl);
  const testVariant = test.variants.find((v) => !v.isControl);

  if (!controlVariant || !testVariant) {
    return null;
  }

  // Simple random assignment based on split percentage
  const random = Math.random() * 100;
  return random < test.splitPercent ? testVariant.id : controlVariant.id;
}

// ============================================================================
// AI PRICING INSIGHT INTEGRATION
// ============================================================================

/**
 * Create an A/B test from a pricing insight
 */
export async function createABTestFromInsight(
  shopId: string,
  insightId: string,
  options?: {
    splitPercent?: number;
    durationDays?: number;
  }
) {
  // Get the insight
  const insight = await prisma.pricingInsight.findUnique({
    where: { id: insightId },
  });

  if (!insight) {
    throw new Error("Insight not found");
  }

  const currentPrice = Number(insight.currentPrice);
  const suggestedPrice = Number(insight.suggestedPrice);

  // Calculate end date
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + (options?.durationDays || 14));

  // Create the A/B test
  const test = await prisma.aBTest.create({
    data: {
      shopId,
      name: `AI Insight Test - ${insight.productId.split("/").pop()}`,
      description: `Testing AI suggested price: ${currentPrice} → ${suggestedPrice}. Reason: ${insight.reason}`,
      testType: "PRICE",
      targetType: "SPECIFIC_PRODUCTS",
      targetValue: insight.productId,
      splitPercent: options?.splitPercent || 50,
      startDate,
      endDate,
      status: "RUNNING",
      variants: {
        create: [
          {
            name: `Control ($${currentPrice.toFixed(2)})`,
            isControl: true,
            priceType: "FIXED",
            priceValue: currentPrice,
          },
          {
            name: `AI Suggestion ($${suggestedPrice.toFixed(2)})`,
            isControl: false,
            priceType: "FIXED",
            priceValue: suggestedPrice,
          },
        ],
      },
    },
    include: {
      variants: true,
    },
  });

  // Link the insight to the A/B test
  await prisma.pricingInsight.update({
    where: { id: insightId },
    data: {
      linkedABTestId: test.id,
      status: "VIEWED",
    },
  });

  return test;
}

/**
 * Get A/B test results for an insight
 */
export async function getInsightABTestResults(insightId: string) {
  const insight = await prisma.pricingInsight.findUnique({
    where: { id: insightId },
    select: { linkedABTestId: true },
  });

  if (!insight?.linkedABTestId) {
    return null;
  }

  const test = await prisma.aBTest.findUnique({
    where: { id: insight.linkedABTestId },
    include: {
      variants: true,
      results: true,
    },
  });

  if (!test) {
    return null;
  }

  // Calculate results for each variant
  const variantResults = test.variants.map((variant) => {
    const variantEvents = test.results.filter((r) => r.variantId === variant.id);
    const views = variantEvents.filter((r) => r.eventType === "VIEW").length;
    const purchases = variantEvents.filter((r) => r.eventType === "PURCHASE").length;
    const revenue = variantEvents
      .filter((r) => r.eventType === "PURCHASE" && r.orderAmount)
      .reduce((sum, r) => sum + Number(r.orderAmount || 0), 0);

    return {
      variantId: variant.id,
      name: variant.name,
      isControl: variant.isControl,
      price: Number(variant.priceValue),
      views,
      purchases,
      revenue,
      conversionRate: views > 0 ? (purchases / views) * 100 : 0,
      revenuePerVisitor: views > 0 ? revenue / views : 0,
    };
  });

  // Determine winner
  const control = variantResults.find((v) => v.isControl);
  const variant = variantResults.find((v) => !v.isControl);

  let winner: "control" | "variant" | "inconclusive" = "inconclusive";
  let lift = 0;

  if (control && variant && control.views >= 100 && variant.views >= 100) {
    const controlRPV = control.revenuePerVisitor;
    const variantRPV = variant.revenuePerVisitor;

    if (variantRPV > controlRPV * 1.05) {
      winner = "variant";
      lift = ((variantRPV - controlRPV) / controlRPV) * 100;
    } else if (controlRPV > variantRPV * 1.05) {
      winner = "control";
      lift = ((controlRPV - variantRPV) / variantRPV) * 100;
    }
  }

  return {
    testId: test.id,
    testName: test.name,
    status: test.status,
    startDate: test.startDate,
    endDate: test.endDate,
    variants: variantResults,
    winner,
    lift,
    isSignificant: (control?.views || 0) >= 100 && (variant?.views || 0) >= 100,
  };
}

/**
 * Complete A/B test and update insight with results
 */
export async function completeInsightABTest(
  testId: string,
  winnerVariantId: string
) {
  // Get test details
  const test = await prisma.aBTest.findUnique({
    where: { id: testId },
    include: { variants: true },
  });

  if (!test) {
    throw new Error("Test not found");
  }

  // Update test status
  await selectWinner(testId, winnerVariantId);

  // Find linked insight
  const insight = await prisma.pricingInsight.findFirst({
    where: { linkedABTestId: testId },
  });

  if (insight) {
    const winnerVariant = test.variants.find((v) => v.id === winnerVariantId);
    const isAISuggestionWinner = winnerVariant && !winnerVariant.isControl;

    // Update insight with results
    await prisma.pricingInsight.update({
      where: { id: insight.id },
      data: {
        abTestResult: JSON.stringify({
          testId,
          winner: winnerVariantId,
          isAISuggestionWinner,
          completedAt: new Date().toISOString(),
        }),
        status: isAISuggestionWinner ? "APPLIED" : "DISMISSED",
        ...(isAISuggestionWinner ? { appliedAt: new Date() } : { dismissedAt: new Date() }),
      },
    });

    // If AI suggestion won, record in price elasticity for learning
    if (isAISuggestionWinner) {
      await updateElasticityFromABTest(insight.shopId, insight.productId, testId);
    }
  }

  return { success: true };
}

/**
 * Update price elasticity based on A/B test results
 */
async function updateElasticityFromABTest(
  shopId: string,
  productId: string,
  testId: string
) {
  const test = await prisma.aBTest.findUnique({
    where: { id: testId },
    include: {
      variants: true,
      results: true,
    },
  });

  if (!test || test.variants.length < 2) return;

  const control = test.variants.find((v) => v.isControl);
  const variant = test.variants.find((v) => !v.isControl);

  if (!control || !variant) return;

  const controlPrice = Number(control.priceValue);
  const variantPrice = Number(variant.priceValue);
  const priceChange = (variantPrice - controlPrice) / controlPrice;

  const controlResults = test.results.filter((r) => r.variantId === control.id);
  const variantResults = test.results.filter((r) => r.variantId === variant.id);

  const controlViews = controlResults.filter((r) => r.eventType === "VIEW").length;
  const variantViews = variantResults.filter((r) => r.eventType === "VIEW").length;
  const controlPurchases = controlResults.filter((r) => r.eventType === "PURCHASE").length;
  const variantPurchases = variantResults.filter((r) => r.eventType === "PURCHASE").length;

  if (controlViews < 50 || variantViews < 50) return; // Not enough data

  const controlConversion = controlPurchases / controlViews;
  const variantConversion = variantPurchases / variantViews;
  const demandChange = (variantConversion - controlConversion) / controlConversion;

  // Calculate elasticity: % change in demand / % change in price
  const elasticity = priceChange !== 0 ? demandChange / priceChange : -1.5;

  // Upsert elasticity record
  await prisma.priceElasticity.upsert({
    where: {
      shopId_productId: {
        shopId,
        productId,
      },
    },
    update: {
      elasticity,
      confidence: 0.8, // Higher confidence from actual A/B test
      dataPoints: { increment: 1 },
      source: "AB_TEST",
      lastCalculatedAt: new Date(),
      calculationDetails: JSON.stringify({
        testId,
        controlPrice,
        variantPrice,
        priceChange,
        controlConversion,
        variantConversion,
        demandChange,
      }),
    },
    create: {
      shopId,
      productId,
      elasticity,
      confidence: 0.8,
      dataPoints: 1,
      source: "AB_TEST",
      lastCalculatedAt: new Date(),
      calculationDetails: JSON.stringify({
        testId,
        controlPrice,
        variantPrice,
        priceChange,
        controlConversion,
        variantConversion,
        demandChange,
      }),
    },
  });
}

/**
 * Get insights with linked A/B tests
 */
export async function getInsightsWithABTests(shopId: string) {
  return prisma.pricingInsight.findMany({
    where: {
      shopId,
      linkedABTestId: { not: null },
    },
    orderBy: { updatedAt: "desc" },
  });
}
