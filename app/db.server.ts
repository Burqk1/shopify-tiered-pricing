/**
 * Database Client Configuration
 *
 * This module provides a singleton Prisma client instance for PostgreSQL.
 * Uses connection pooling for optimal performance.
 */

import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prismaClient: PrismaClient | undefined;
}

// Prevent multiple Prisma Client instances in development
// due to hot module replacement
const prisma = globalThis.__prismaClient ?? new PrismaClient({
  log: process.env.NODE_ENV === "development"
    ? ["query", "error", "warn"]
    : ["error"],
});

if (process.env.NODE_ENV !== "production") {
  globalThis.__prismaClient = prisma;
}

export default prisma;
