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

declare global {
  // eslint-disable-next-line no-var
  var __prismaClient: PrismaClient | undefined;
}

// Configure Neon for serverless environments
neonConfig.webSocketConstructor = ws;

function createPrismaClient() {
  // Check if we're using Neon (pooler URL contains 'neon')
  const databaseUrl = process.env.DATABASE_URL || "";
  const isNeon = databaseUrl.includes("neon");

  if (isNeon) {
    // Use Neon serverless driver for better cold start performance
    const pool = new Pool({ connectionString: databaseUrl });
    const adapter = new PrismaNeon(pool);
    return new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
    });
  }

  // Fallback to standard Prisma client
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
