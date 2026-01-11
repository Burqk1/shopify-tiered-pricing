/**
 * App Proxy API Route
 *
 * Provides product tier data to the storefront Theme Extension.
 * Called via Shopify App Proxy: /apps/tiered-pricing/product-tiers -> /api/product-tiers
 */

import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import crypto from "crypto";
import { getActiveRulesForSync } from "~/models/pricing-rule.server";
import { getShopByDomain } from "~/models/shop.server";
import {
  checkRateLimit,
  getRateLimitHeaders,
  getIdentifierFromRequest,
  createRateLimitResponse,
} from "~/services/rate-limiter.server";

/**
 * Verify Shopify App Proxy signature
 * @see https://shopify.dev/docs/apps/online-store/app-proxies#verify-signatures
 */
function verifyAppProxySignature(url: URL): boolean {
  const signature = url.searchParams.get("signature");
  if (!signature) return false;

  const secret = process.env.SHOPIFY_API_SECRET;
  if (!secret) return false;

  // Build query string without signature
  const params = new URLSearchParams();
  url.searchParams.forEach((value, key) => {
    if (key !== "signature") {
      params.append(key, value);
    }
  });

  // Sort parameters alphabetically
  const sortedParams = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("");

  // Calculate HMAC
  const calculatedSignature = crypto
    .createHmac("sha256", secret)
    .update(sortedParams)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(calculatedSignature, "hex")
  );
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  // Rate limiting check
  const identifier = getIdentifierFromRequest(request);
  const rateLimitResult = checkRateLimit(identifier, "appProxy");

  if (!rateLimitResult.allowed) {
    return createRateLimitResponse(rateLimitResult.retryAfter!);
  }

  // Verify App Proxy signature in production
  if (process.env.NODE_ENV === "production") {
    if (!verifyAppProxySignature(url)) {
      return json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  // Get shop domain from App Proxy query params (Shopify adds these)
  const shopDomain = url.searchParams.get("shop") || request.headers.get("X-Shopify-Shop-Domain");

  if (!shopDomain) {
    return json({ error: "Missing shop domain" }, { status: 400 });
  }

  // Get product ID from query params
  const productId = url.searchParams.get("product_id");

  if (!productId) {
    return json({ error: "Missing product_id" }, { status: 400 });
  }

  try {
    // Get shop from database
    const shop = await getShopByDomain(shopDomain);

    if (!shop) {
      return json({ tiers: [] });
    }

    // Get active rules for this shop
    const rules = await getActiveRulesForSync(shop.id);

    // Find applicable rule for this product
    const applicableRule = rules.find((rule) =>
      rule.conditions.some((condition) => {
        if (condition.type === "ALL_PRODUCTS") return true;
        if (condition.type === "PRODUCT" && condition.value === productId) return true;
        // Collection matching would require additional logic
        return false;
      })
    );

    if (!applicableRule) {
      return json({ tiers: [] });
    }

    // Return tiers
    const tiers = applicableRule.tiers.map((tier) => ({
      min: tier.minQuantity,
      max: tier.maxQuantity,
      valueType: tier.valueType,
      value: Number(tier.value),
      message: tier.message,
    }));

    // Add rate limit headers to response
    const headers = getRateLimitHeaders(identifier, "appProxy");

    return json(
      {
        tiers,
        ruleName: applicableRule.name,
      },
      { headers }
    );
  } catch (error) {
    console.error("Failed to get product tiers:", error);
    return json({ tiers: [] });
  }
};
