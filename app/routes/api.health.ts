/**
 * Health Check API Endpoint
 * Used to verify the app is running and database connection works
 */

import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const checks: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    status: "ok",
  };

  // Check environment variables
  checks.env = {
    DATABASE_URL: process.env.DATABASE_URL ? "SET" : "NOT SET",
    DATABASE_POSTGRES_URL: process.env.DATABASE_POSTGRES_URL ? "SET" : "NOT SET",
    DATABASE_POSTGRES_PRISMA_URL: process.env.DATABASE_POSTGRES_PRISMA_URL ? "SET" : "NOT SET",
    POSTGRES_URL: process.env.POSTGRES_URL ? "SET" : "NOT SET",
    POSTGRES_PRISMA_URL: process.env.POSTGRES_PRISMA_URL ? "SET" : "NOT SET",
    SHOPIFY_API_KEY: process.env.SHOPIFY_API_KEY ? "SET" : "NOT SET",
    SHOPIFY_API_SECRET: process.env.SHOPIFY_API_SECRET ? "SET" : "NOT SET",
    SHOPIFY_APP_URL: process.env.SHOPIFY_APP_URL ? "SET" : "NOT SET",
    NODE_ENV: process.env.NODE_ENV || "NOT SET",
  };

  // Try to import db module
  try {
    const { DATABASE_URL } = await import("~/db.server");
    checks.dbModule = {
      loaded: true,
      urlLength: DATABASE_URL?.length || 0,
      hasNeon: DATABASE_URL?.includes("neon") || false,
    };
  } catch (error) {
    checks.dbModule = {
      loaded: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  // Try database connection
  try {
    const prisma = (await import("~/db.server")).default;
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { connected: true };
  } catch (error) {
    checks.database = {
      connected: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  return json(checks);
};
