/**
 * Scheduled Analytics Sync Endpoint
 *
 * This endpoint is called daily by a cron job to sync analytics data.
 * Can be triggered by:
 * 1. External cron service (e.g., cron-job.org, Vercel Cron, AWS EventBridge)
 * 2. Shopify Flow automation
 * 3. Manual trigger via admin UI
 *
 * Security: Requires a secret key to prevent unauthorized access
 */

import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import prisma from "~/db.server";
import { syncDailyAnalytics, backfillAnalytics } from "~/services/analytics-sync.server";
import { processAutoApply } from "~/services/auto-apply.server";
import { runScheduledCompetitorSync } from "~/services/competitor-sync.server";
import { authenticate } from "~/shopify.server";

// Secret key for cron authentication (set in environment variables)
const CRON_SECRET = process.env.CRON_SECRET || "your-secret-key-change-in-production";

// Batch size for processing shops (prevents timeout on large scale)
const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 1000; // Delay between batches to prevent rate limiting

/**
 * Verify cron request authenticity
 */
function verifyCronAuth(request: Request): boolean {
  const authHeader = request.headers.get("Authorization");
  const cronSecret = request.headers.get("X-Cron-Secret");

  // Check either Bearer token or X-Cron-Secret header
  if (authHeader === `Bearer ${CRON_SECRET}`) return true;
  if (cronSecret === CRON_SECRET) return true;

  // Also allow Vercel Cron format
  const vercelCronSignature = request.headers.get("x-vercel-cron-signature");
  if (vercelCronSignature) {
    // Vercel Cron automatically includes this header when configured
    return true;
  }

  return false;
}

/**
 * GET handler - Status check and manual trigger
 */
export async function loader({ request }: LoaderFunctionArgs) {
  // Allow status check without auth
  const url = new URL(request.url);
  if (url.searchParams.get("status") === "check") {
    return json({
      status: "ok",
      service: "analytics-sync",
      timestamp: new Date().toISOString(),
    });
  }

  // For manual trigger, require auth
  if (!verifyCronAuth(request)) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  // Return instructions
  return json({
    message: "Analytics Sync Cron Endpoint",
    endpoints: {
      "POST /api/cron/analytics-sync": "Run daily sync for all shops",
      "POST /api/cron/analytics-sync?shop=xxx.myshopify.com": "Run sync for specific shop",
      "POST /api/cron/analytics-sync?action=backfill&days=30": "Backfill last N days",
    },
    authentication: "Include 'Authorization: Bearer YOUR_CRON_SECRET' header",
  });
}

/**
 * POST handler - Execute sync
 */
export async function action({ request }: ActionFunctionArgs) {
  // Verify authentication
  if (!verifyCronAuth(request)) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const specificShop = url.searchParams.get("shop");
  const actionType = url.searchParams.get("action") || "sync";
  const days = parseInt(url.searchParams.get("days") || "30");

  const results: {
    shop: string;
    action: string;
    success: boolean;
    synced?: number;
    errors?: string[];
  }[] = [];

  try {
    // Get shops to process
    let shops: { id: string; shopDomain: string }[];

    if (specificShop) {
      const shop = await prisma.shop.findUnique({
        where: { shopDomain: specificShop },
        select: { id: true, shopDomain: true },
      });

      if (!shop) {
        return json({ error: "Shop not found" }, { status: 404 });
      }

      shops = [shop];
    } else {
      // Get all shops that have valid sessions
      const activeSessions = await prisma.session.findMany({
        where: {
          accessToken: { not: "" },
          OR: [
            { expires: null },
            { expires: { gt: new Date() } },
          ],
        },
        select: { shop: true },
        distinct: ["shop"],
      });

      const activeShopDomains = activeSessions.map((s) => s.shop);

      shops = await prisma.shop.findMany({
        where: {
          shopDomain: { in: activeShopDomains },
        },
        select: { id: true, shopDomain: true },
      });
    }

    // Process shops in batches to prevent timeout and rate limiting
    const processBatch = async (batch: typeof shops) => {
      const batchPromises = batch.map(async (shop) => {
        try {
          // Get admin API access for this shop
          const session = await prisma.session.findFirst({
            where: { shop: shop.shopDomain },
            orderBy: { expires: "desc" },
          });

          if (!session || !session.accessToken) {
            return {
              shop: shop.shopDomain,
              action: actionType,
              success: false,
              errors: ["No valid session found"] as string[],
            };
          }

          // Create admin API client
          const admin = createAdminClient(shop.shopDomain, session.accessToken);

          return await processShopSync(shop, admin, actionType, days);
        } catch (error) {
          return {
            shop: shop.shopDomain,
            action: actionType,
            success: false,
            errors: [(error as Error).message] as string[],
          };
        }
      });

      return Promise.all(batchPromises);
    };

    // Split shops into batches
    for (let i = 0; i < shops.length; i += BATCH_SIZE) {
      const batch = shops.slice(i, i + BATCH_SIZE);
      const batchResults = await processBatch(batch);
      results.push(...batchResults);

      // Add delay between batches (except for the last one)
      if (i + BATCH_SIZE < shops.length) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    // Summary
    const summary = {
      timestamp: new Date().toISOString(),
      action: actionType,
      totalShops: shops.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      totalSynced: results.reduce((sum, r) => sum + (r.synced || 0), 0),
      results,
    };

    return json(summary);
  } catch (error) {
    return json(
      {
        error: "Cron execution failed",
        message: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

/**
 * Process sync for a single shop
 */
async function processShopSync(
  shop: { id: string; shopDomain: string },
  admin: ReturnType<typeof createAdminClient>,
  actionType: string,
  days: number
): Promise<{
  shop: string;
  action: string;
  success: boolean;
  synced?: number;
  errors?: string[];
}> {
  switch (actionType) {
    case "sync": {
      // Run daily analytics sync
      const syncResult = await syncDailyAnalytics(shop.id, admin);

      // Also run auto-apply if enabled
      const autoApplyResult = await processAutoApply(shop.id, admin);

      return {
        shop: shop.shopDomain,
        action: "sync",
        success: syncResult.errors.length === 0,
        synced: syncResult.synced,
        errors: [
          ...syncResult.errors,
          ...autoApplyResult.filter((r) => !r.success).map((r) => r.error || "Auto-apply failed"),
        ],
      };
    }

    case "backfill": {
      // Backfill historical data
      const backfillResult = await backfillAnalytics(shop.id, admin, days);

      return {
        shop: shop.shopDomain,
        action: "backfill",
        success: backfillResult.errors.length === 0,
        synced: backfillResult.synced,
        errors: backfillResult.errors,
      };
    }

    case "competitor-sync": {
      // Sync competitor prices
      const competitorResult = await runScheduledCompetitorSync(shop.id);

      return {
        shop: shop.shopDomain,
        action: "competitor-sync",
        success: competitorResult.failed === 0,
        synced: competitorResult.synced,
        errors: competitorResult.errors,
      };
    }

    case "full": {
      // Run all sync operations
      const [syncResult, competitorResult] = await Promise.all([
        syncDailyAnalytics(shop.id, admin),
        runScheduledCompetitorSync(shop.id),
      ]);

      const autoApplyResult = await processAutoApply(shop.id, admin);

      return {
        shop: shop.shopDomain,
        action: "full",
        success:
          syncResult.errors.length === 0 &&
          competitorResult.failed === 0 &&
          autoApplyResult.every((r) => r.success),
        synced: syncResult.synced + competitorResult.synced,
        errors: [
          ...syncResult.errors,
          ...competitorResult.errors,
          ...autoApplyResult.filter((r) => !r.success).map((r) => r.error || "Auto-apply failed"),
        ],
      };
    }

    default:
      return {
        shop: shop.shopDomain,
        action: actionType,
        success: false,
        errors: [`Unknown action: ${actionType}`],
      };
  }
}

/**
 * Create admin GraphQL client for a shop
 */
function createAdminClient(shopDomain: string, accessToken: string) {
  return {
    async graphql(query: string, options?: { variables?: Record<string, unknown> }) {
      const response = await fetch(`https://${shopDomain}/admin/api/2024-01/graphql.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({
          query,
          variables: options?.variables,
        }),
      });

      return response;
    },
  };
}

/**
 * Example cron configurations:
 *
 * 1. Vercel Cron (vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/cron/analytics-sync",
 *     "schedule": "0 2 * * *"  // Daily at 2 AM UTC
 *   }]
 * }
 *
 * 2. External cron service (cURL):
 * curl -X POST https://your-app.com/api/cron/analytics-sync \
 *   -H "Authorization: Bearer YOUR_CRON_SECRET"
 *
 * 3. Shopify Flow:
 * - Create a Flow with scheduled trigger
 * - Add HTTP action pointing to this endpoint
 * - Include Authorization header
 */
