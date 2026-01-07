/**
 * Analytics CSV Export API Route
 *
 * Provides CSV download for analytics data.
 */

import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import { getShopByDomain } from "~/models/shop.server";
import { exportAnalyticsCSV, getAnalyticsSummaryCSV } from "~/models/analytics.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const url = new URL(request.url);
  const days = parseInt(url.searchParams.get("days") || "30", 10);
  const type = url.searchParams.get("type") || "detailed"; // "detailed" or "summary"

  const shop = await getShopByDomain(session.shop);
  if (!shop) {
    return new Response("Shop not found", { status: 404 });
  }

  try {
    let csvContent: string;
    let filename: string;

    if (type === "summary") {
      csvContent = await getAnalyticsSummaryCSV(shop.id, days);
      filename = `analytics-summary-${days}days.csv`;
    } else {
      csvContent = await exportAnalyticsCSV(shop.id, days);
      filename = `discount-usage-${days}days.csv`;
    }

    return new Response(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("Failed to export analytics:", error);
    return new Response("Export failed", { status: 500 });
  }
};
