/**
 * Shopify Server Configuration
 *
 * Initializes Shopify authentication and API access for the app.
 */

// CRITICAL: Import db.server FIRST to ensure DATABASE_URL is set before PrismaSessionStorage initializes
import prisma from "./db.server";

import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";

// Development'ta Shopify CLI tunnel URL'sini otomatik kullanır
const appUrl = process.env.SHOPIFY_APP_URL || process.env.HOST || "https://localhost";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY!,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.January25,
  scopes: process.env.SCOPES?.split(",") || [
    "write_products",
    "read_products",
    "write_discounts",
    "read_discounts",
    "write_customers",
    "read_customers",
    "read_metaobjects",
    "write_metaobjects",
  ],
  appUrl,
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  isEmbeddedApp: false,
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.January25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
