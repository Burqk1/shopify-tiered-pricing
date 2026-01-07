/**
 * Analytics Server Functions
 *
 * Handles discount usage tracking and reporting.
 */

import prisma from "~/db.server";
import type { Prisma } from "@prisma/client";

interface DiscountUsageInput {
  shopId: string;
  ruleId?: string;
  bundleId?: string;
  orderId: string;
  orderNumber: string;
  customerId?: string;
  customerEmail?: string;
  discountType: "TIERED" | "BUNDLE";
  tierApplied?: string;
  originalPrice: number;
  discountedPrice: number;
  discountAmount: number;
  discountPercent: number;
  quantity: number;
  currency?: string;
  productId?: string;
  productTitle?: string;
  variantId?: string;
  variantTitle?: string;
}

/**
 * Record a discount usage event
 */
export async function recordDiscountUsage(input: DiscountUsageInput) {
  return prisma.discountUsage.create({
    data: {
      shopId: input.shopId,
      ruleId: input.ruleId,
      bundleId: input.bundleId,
      orderId: input.orderId,
      orderNumber: input.orderNumber,
      customerId: input.customerId,
      customerEmail: input.customerEmail,
      discountType: input.discountType,
      tierApplied: input.tierApplied,
      originalPrice: input.originalPrice,
      discountedPrice: input.discountedPrice,
      discountAmount: input.discountAmount,
      discountPercent: input.discountPercent,
      quantity: input.quantity,
      currency: input.currency || "USD",
      productId: input.productId,
      productTitle: input.productTitle,
      variantId: input.variantId,
      variantTitle: input.variantTitle,
    },
  });
}

/**
 * Get analytics summary for a shop
 */
export async function getAnalyticsSummary(shopId: string, days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const usages = await prisma.discountUsage.findMany({
    where: {
      shopId,
      createdAt: { gte: startDate },
    },
    orderBy: { createdAt: "desc" },
  });

  // Calculate totals
  const totalOrders = new Set(usages.map((u) => u.orderId)).size;
  const totalRevenue = usages.reduce(
    (sum, u) => sum + Number(u.discountedPrice),
    0
  );
  const totalDiscount = usages.reduce(
    (sum, u) => sum + Number(u.discountAmount),
    0
  );
  const totalOriginal = usages.reduce(
    (sum, u) => sum + Number(u.originalPrice),
    0
  );
  const averageDiscount =
    usages.length > 0
      ? usages.reduce((sum, u) => sum + Number(u.discountPercent), 0) /
        usages.length
      : 0;

  // Group by rule
  const byRule = usages.reduce(
    (acc, u) => {
      const key = u.ruleId || "unknown";
      if (!acc[key]) {
        acc[key] = { count: 0, revenue: 0, discount: 0 };
      }
      acc[key].count++;
      acc[key].revenue += Number(u.discountedPrice);
      acc[key].discount += Number(u.discountAmount);
      return acc;
    },
    {} as Record<string, { count: number; revenue: number; discount: number }>
  );

  // Group by tier
  const byTier = usages.reduce(
    (acc, u) => {
      const key = u.tierApplied || "unknown";
      if (!acc[key]) {
        acc[key] = { count: 0, revenue: 0 };
      }
      acc[key].count++;
      acc[key].revenue += Number(u.discountedPrice);
      return acc;
    },
    {} as Record<string, { count: number; revenue: number }>
  );

  // Daily breakdown
  const daily = usages.reduce(
    (acc, u) => {
      const date = u.createdAt.toISOString().split("T")[0];
      if (!acc[date]) {
        acc[date] = { orders: new Set(), revenue: 0, discount: 0 };
      }
      acc[date].orders.add(u.orderId);
      acc[date].revenue += Number(u.discountedPrice);
      acc[date].discount += Number(u.discountAmount);
      return acc;
    },
    {} as Record<
      string,
      { orders: Set<string>; revenue: number; discount: number }
    >
  );

  const dailyStats = Object.entries(daily)
    .map(([date, data]) => ({
      date,
      orders: data.orders.size,
      revenue: data.revenue,
      discount: data.discount,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Top products
  const productStats = usages.reduce(
    (acc, u) => {
      if (!u.productId) return acc;
      const key = u.productId;
      if (!acc[key]) {
        acc[key] = {
          productId: u.productId,
          title: u.productTitle || "Unknown",
          count: 0,
          revenue: 0,
          quantity: 0,
        };
      }
      acc[key].count++;
      acc[key].revenue += Number(u.discountedPrice);
      acc[key].quantity += u.quantity;
      return acc;
    },
    {} as Record<
      string,
      {
        productId: string;
        title: string;
        count: number;
        revenue: number;
        quantity: number;
      }
    >
  );

  const topProducts = Object.values(productStats)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  return {
    period: { days, startDate, endDate: new Date() },
    summary: {
      totalOrders,
      totalRevenue,
      totalDiscount,
      totalOriginal,
      averageDiscount: Math.round(averageDiscount * 100) / 100,
      conversionLift: totalOriginal > 0
        ? Math.round((totalDiscount / totalOriginal) * 100 * 100) / 100
        : 0,
    },
    byRule: Object.entries(byRule).map(([ruleId, data]) => ({
      ruleId,
      ...data,
    })),
    byTier: Object.entries(byTier).map(([tier, data]) => ({
      tier,
      ...data,
    })),
    dailyStats,
    topProducts,
    recentUsages: usages.slice(0, 20).map((u) => ({
      id: u.id,
      orderNumber: u.orderNumber,
      productTitle: u.productTitle,
      quantity: u.quantity,
      discountAmount: Number(u.discountAmount),
      discountPercent: Number(u.discountPercent),
      tierApplied: u.tierApplied,
      createdAt: u.createdAt.toISOString(),
    })),
  };
}

/**
 * Get analytics for a specific rule
 */
export async function getRuleAnalytics(ruleId: string, days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const usages = await prisma.discountUsage.findMany({
    where: {
      ruleId,
      createdAt: { gte: startDate },
    },
    orderBy: { createdAt: "desc" },
  });

  const totalOrders = new Set(usages.map((u) => u.orderId)).size;
  const totalRevenue = usages.reduce(
    (sum, u) => sum + Number(u.discountedPrice),
    0
  );
  const totalDiscount = usages.reduce(
    (sum, u) => sum + Number(u.discountAmount),
    0
  );

  return {
    ruleId,
    period: { days },
    totalOrders,
    totalRevenue,
    totalDiscount,
    usageCount: usages.length,
  };
}

/**
 * Export analytics data as CSV string
 */
export async function exportAnalyticsCSV(shopId: string, days: number = 30): Promise<string> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const usages = await prisma.discountUsage.findMany({
    where: {
      shopId,
      createdAt: { gte: startDate },
    },
    orderBy: { createdAt: "desc" },
  });

  // CSV Header
  const headers = [
    "Date",
    "Order Number",
    "Product",
    "Variant",
    "Quantity",
    "Original Price",
    "Discounted Price",
    "Discount Amount",
    "Discount %",
    "Tier Applied",
    "Discount Type",
    "Customer Email",
    "Currency",
  ];

  // CSV Rows
  const rows = usages.map((u) => [
    u.createdAt.toISOString().split("T")[0],
    u.orderNumber,
    u.productTitle || "",
    u.variantTitle || "",
    u.quantity.toString(),
    Number(u.originalPrice).toFixed(2),
    Number(u.discountedPrice).toFixed(2),
    Number(u.discountAmount).toFixed(2),
    Number(u.discountPercent).toFixed(2),
    u.tierApplied || "",
    u.discountType,
    u.customerEmail || "",
    u.currency,
  ]);

  // Escape CSV values
  const escapeCSV = (value: string): string => {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  // Build CSV string
  const csvLines = [
    headers.map(escapeCSV).join(","),
    ...rows.map((row) => row.map(escapeCSV).join(",")),
  ];

  return csvLines.join("\n");
}

/**
 * Get analytics summary for CSV (simplified format)
 */
export async function getAnalyticsSummaryCSV(shopId: string, days: number = 30): Promise<string> {
  const summary = await getAnalyticsSummary(shopId, days);

  const lines = [
    "Analytics Summary Report",
    `Period: Last ${days} days`,
    `Generated: ${new Date().toISOString()}`,
    "",
    "SUMMARY",
    `Total Orders with Discount,${summary.summary.totalOrders}`,
    `Total Revenue,${summary.summary.totalRevenue.toFixed(2)}`,
    `Total Discount Given,${summary.summary.totalDiscount.toFixed(2)}`,
    `Average Discount %,${summary.summary.averageDiscount.toFixed(2)}`,
    "",
    "DAILY BREAKDOWN",
    "Date,Orders,Revenue,Discount",
    ...summary.dailyStats.map(
      (d) => `${d.date},${d.orders},${d.revenue.toFixed(2)},${d.discount.toFixed(2)}`
    ),
    "",
    "TOP PRODUCTS",
    "Product,Times Discounted,Units Sold,Revenue",
    ...summary.topProducts.map(
      (p) => `"${p.title}",${p.count},${p.quantity},${p.revenue.toFixed(2)}`
    ),
    "",
    "BY TIER",
    "Tier,Uses,Revenue",
    ...summary.byTier.map((t) => `"${t.tier}",${t.count},${t.revenue.toFixed(2)}`),
  ];

  return lines.join("\n");
}
