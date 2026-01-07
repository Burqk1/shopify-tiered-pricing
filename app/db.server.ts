/**
 * Database Client Configuration
 *
 * This module provides a singleton Prisma client instance for PostgreSQL.
 * Uses connection pooling for optimal performance with Neon serverless.
 */

import { PrismaClient } from "@prisma/client";

// Get database URL from multiple possible environment variable names
// Vercel's Neon integration uses various naming conventions
export const DATABASE_URL =
  process.env.DATABASE_URL ||
  process.env.DATABASE_POSTGRES_PRISMA_URL ||
  process.env.DATABASE_POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL_UNPOOLED ||
  "";

// Debug log for troubleshooting (will appear in Vercel logs)
if (typeof process !== "undefined") {
  console.log("[db.server] DATABASE_URL resolved:", DATABASE_URL ? "SET (length: " + DATABASE_URL.length + ")" : "NOT SET");
}

// CRITICAL: Set DATABASE_URL for libraries that read it directly (like @shopify/shopify-app-session-storage-prisma)
if (!process.env.DATABASE_URL && DATABASE_URL) {
  process.env.DATABASE_URL = DATABASE_URL;
}

declare global {
  // eslint-disable-next-line no-var
  var __prismaClient: PrismaClient | undefined;
}

function createPrismaClient() {
  // Use standard Prisma client - Neon adapter is incompatible with PrismaSessionStorage
  // The DATABASE_URL is already set in process.env, Prisma will use it automatically
  console.log("[db.server] Creating PrismaClient with DATABASE_URL from env");

  return new PrismaClient({
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
