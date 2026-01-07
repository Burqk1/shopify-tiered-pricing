/**
 * Database Client Configuration
 *
 * This module provides a singleton Prisma client instance for PostgreSQL.
 * Uses connection pooling for optimal performance with Neon serverless.
 */

import { PrismaClient } from "@prisma/client";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";

// Get database URL from multiple possible environment variable names
// Vercel's Neon integration uses POSTGRES_URL or POSTGRES_PRISMA_URL
export const DATABASE_URL =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL_UNPOOLED ||
  "";

// CRITICAL: Set DATABASE_URL for libraries that read it directly (like @shopify/shopify-app-session-storage-prisma)
if (!process.env.DATABASE_URL && DATABASE_URL) {
  process.env.DATABASE_URL = DATABASE_URL;
}

declare global {
  // eslint-disable-next-line no-var
  var __prismaClient: PrismaClient | undefined;
}

// Configure Neon for serverless environments
neonConfig.webSocketConstructor = ws;

function createPrismaClient() {
  // Check if we're using Neon (pooler URL contains 'neon')
  const isNeon = DATABASE_URL.includes("neon");

  if (isNeon && DATABASE_URL) {
    // Use Neon serverless driver for better cold start performance
    // Note: When using Driver Adapters, do NOT use datasourceUrl - it's incompatible
    const pool = new Pool({ connectionString: DATABASE_URL });
    const adapter = new PrismaNeon(pool);
    return new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
    });
  }

  // Fallback to standard Prisma client with explicit datasource URL
  return new PrismaClient({
    datasourceUrl: DATABASE_URL || undefined,
    log: process.env.NODE_ENV === "development"
      ? ["query", "error", "warn"]
      : ["error"],
  });
}

// Prevent multiple Prisma Client instances in development
// due to hot module replacement
const prisma = globalThis.__prismaClient ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prismaClient = prisma;
}

export default prisma;
