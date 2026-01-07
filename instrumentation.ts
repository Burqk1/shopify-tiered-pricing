/**
 * Vercel Instrumentation
 *
 * This file runs before any other code in the serverless function.
 * Used to normalize environment variables before Prisma initializes.
 */

export function register() {
  // Normalize DATABASE_URL from various possible environment variable names
  // Vercel's Neon integration uses POSTGRES_URL instead of DATABASE_URL
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL =
      process.env.POSTGRES_PRISMA_URL ||
      process.env.POSTGRES_URL ||
      process.env.DATABASE_URL_UNPOOLED ||
      "";

    if (process.env.DATABASE_URL) {
      console.log("[instrumentation] DATABASE_URL set from alternative env var");
    }
  }
}
