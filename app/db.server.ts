
import { PrismaClient } from "@prisma/client";

export const DATABASE_URL =
  process.env.DATABASE_URL ||
  process.env.DATABASE_POSTGRES_PRISMA_URL ||
  process.env.DATABASE_POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL_UNPOOLED ||
  "";
if (typeof process !== "undefined") {
  console.log("[db.server] DATABASE_URL resolved:", DATABASE_URL ? "SET (length: " + DATABASE_URL.length + ")" : "NOT SET");
}

if (!process.env.DATABASE_URL && DATABASE_URL) {
  process.env.DATABASE_URL = DATABASE_URL;
}

declare global {
  var __prismaClient: PrismaClient | undefined;
}

function createPrismaClient() {
  console.log("[db.server] Creating PrismaClient with DATABASE_URL from env");

  return new PrismaClient({
    log: process.env.NODE_ENV === "development"
      ? ["query", "error", "warn"]
      : ["error"],
  });
}

const prisma = globalThis.__prismaClient ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prismaClient = prisma;
}

export default prisma;
