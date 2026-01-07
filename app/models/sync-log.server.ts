/**
 * Sync Log Model - Data Access Layer
 *
 * Tracks synchronization history between PostgreSQL and Shopify Metaobjects.
 * Useful for debugging and audit trails.
 */

import prisma from "~/db.server";
import type { SyncLog, SyncStatus } from "@prisma/client";

export type { SyncLog, SyncStatus };

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get recent sync logs for a shop
 */
export async function getSyncLogs(
  shopId: string,
  limit: number = 10
): Promise<SyncLog[]> {
  return prisma.syncLog.findMany({
    where: { shopId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/**
 * Get the last successful sync
 */
export async function getLastSuccessfulSync(
  shopId: string
): Promise<SyncLog | null> {
  return prisma.syncLog.findFirst({
    where: {
      shopId,
      status: "SUCCESS",
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Get sync statistics for a shop
 */
export async function getSyncStats(shopId: string): Promise<{
  totalSyncs: number;
  successCount: number;
  failedCount: number;
  lastSync: Date | null;
  averageDuration: number | null;
}> {
  const [counts, lastSync, avgDuration] = await Promise.all([
    prisma.syncLog.groupBy({
      by: ["status"],
      where: { shopId },
      _count: true,
    }),
    prisma.syncLog.findFirst({
      where: { shopId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    prisma.syncLog.aggregate({
      where: {
        shopId,
        status: "SUCCESS",
        duration: { not: null },
      },
      _avg: { duration: true },
    }),
  ]);

  const successCount = counts.find((c) => c.status === "SUCCESS")?._count ?? 0;
  const failedCount = counts.find((c) => c.status === "FAILED")?._count ?? 0;
  const partialCount = counts.find((c) => c.status === "PARTIAL")?._count ?? 0;

  return {
    totalSyncs: successCount + failedCount + partialCount,
    successCount,
    failedCount: failedCount + partialCount,
    lastSync: lastSync?.createdAt ?? null,
    averageDuration: avgDuration._avg.duration,
  };
}

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Create a sync log entry
 */
export async function createSyncLog(data: {
  shopId: string;
  status: SyncStatus;
  rulesCount: number;
  payload?: string;
  error?: string;
  duration?: number;
}): Promise<SyncLog> {
  return prisma.syncLog.create({
    data: {
      shopId: data.shopId,
      status: data.status,
      rulesCount: data.rulesCount,
      payload: data.payload,
      error: data.error,
      duration: data.duration,
    },
  });
}

/**
 * Clean up old sync logs (keep last N entries per shop)
 */
export async function cleanupSyncLogs(
  shopId: string,
  keepCount: number = 100
): Promise<number> {
  // Get IDs to keep
  const logsToKeep = await prisma.syncLog.findMany({
    where: { shopId },
    orderBy: { createdAt: "desc" },
    take: keepCount,
    select: { id: true },
  });

  const idsToKeep = logsToKeep.map((l) => l.id);

  // Delete all others
  const result = await prisma.syncLog.deleteMany({
    where: {
      shopId,
      id: { notIn: idsToKeep },
    },
  });

  return result.count;
}
