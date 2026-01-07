/**
 * Sync Log Model Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma
vi.mock("~/db.server", () => ({
  default: {
    syncLog: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      groupBy: vi.fn(),
      aggregate: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import prisma from "~/db.server";
import {
  getSyncLogs,
  getLastSuccessfulSync,
  getSyncStats,
  createSyncLog,
  cleanupSyncLogs,
} from "~/models/sync-log.server";

describe("Sync Log Model", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // QUERIES
  // ============================================================================

  describe("getSyncLogs", () => {
    it("should return recent sync logs with default limit", async () => {
      const mockLogs = [
        { id: "log-1", status: "SUCCESS", createdAt: new Date() },
        { id: "log-2", status: "FAILED", createdAt: new Date() },
      ];

      vi.mocked(prisma.syncLog.findMany).mockResolvedValue(mockLogs as never);

      const result = await getSyncLogs("shop-1");

      expect(prisma.syncLog.findMany).toHaveBeenCalledWith({
        where: { shopId: "shop-1" },
        orderBy: { createdAt: "desc" },
        take: 10,
      });
      expect(result).toHaveLength(2);
    });

    it("should return logs with custom limit", async () => {
      vi.mocked(prisma.syncLog.findMany).mockResolvedValue([]);

      await getSyncLogs("shop-1", 50);

      expect(prisma.syncLog.findMany).toHaveBeenCalledWith({
        where: { shopId: "shop-1" },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
    });
  });

  describe("getLastSuccessfulSync", () => {
    it("should return last successful sync", async () => {
      const mockLog = {
        id: "log-1",
        status: "SUCCESS",
        createdAt: new Date("2024-01-15"),
      };

      vi.mocked(prisma.syncLog.findFirst).mockResolvedValue(mockLog as never);

      const result = await getLastSuccessfulSync("shop-1");

      expect(prisma.syncLog.findFirst).toHaveBeenCalledWith({
        where: {
          shopId: "shop-1",
          status: "SUCCESS",
        },
        orderBy: { createdAt: "desc" },
      });
      expect(result?.status).toBe("SUCCESS");
    });

    it("should return null if no successful sync", async () => {
      vi.mocked(prisma.syncLog.findFirst).mockResolvedValue(null);

      const result = await getLastSuccessfulSync("shop-1");

      expect(result).toBeNull();
    });
  });

  describe("getSyncStats", () => {
    it("should return sync statistics", async () => {
      vi.mocked(prisma.syncLog.groupBy).mockResolvedValue([
        { status: "SUCCESS", _count: 50 },
        { status: "FAILED", _count: 5 },
        { status: "PARTIAL", _count: 2 },
      ] as never);

      vi.mocked(prisma.syncLog.findFirst).mockResolvedValue({
        createdAt: new Date("2024-01-15T10:00:00"),
      } as never);

      vi.mocked(prisma.syncLog.aggregate).mockResolvedValue({
        _avg: { duration: 1500 },
      } as never);

      const result = await getSyncStats("shop-1");

      expect(result.totalSyncs).toBe(57);
      expect(result.successCount).toBe(50);
      expect(result.failedCount).toBe(7); // 5 + 2 (partial counts as failed)
      expect(result.averageDuration).toBe(1500);
    });

    it("should handle empty stats", async () => {
      vi.mocked(prisma.syncLog.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.syncLog.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.syncLog.aggregate).mockResolvedValue({
        _avg: { duration: null },
      } as never);

      const result = await getSyncStats("shop-1");

      expect(result.totalSyncs).toBe(0);
      expect(result.successCount).toBe(0);
      expect(result.failedCount).toBe(0);
      expect(result.lastSync).toBeNull();
      expect(result.averageDuration).toBeNull();
    });
  });

  // ============================================================================
  // MUTATIONS
  // ============================================================================

  describe("createSyncLog", () => {
    it("should create sync log with success", async () => {
      const mockLog = {
        id: "log-1",
        shopId: "shop-1",
        status: "SUCCESS",
        rulesCount: 5,
      };

      vi.mocked(prisma.syncLog.create).mockResolvedValue(mockLog as never);

      const result = await createSyncLog({
        shopId: "shop-1",
        status: "SUCCESS",
        rulesCount: 5,
        duration: 1200,
      });

      expect(prisma.syncLog.create).toHaveBeenCalledWith({
        data: {
          shopId: "shop-1",
          status: "SUCCESS",
          rulesCount: 5,
          payload: undefined,
          error: undefined,
          duration: 1200,
        },
      });
      expect(result.id).toBe("log-1");
    });

    it("should create sync log with failure", async () => {
      vi.mocked(prisma.syncLog.create).mockResolvedValue({
        id: "log-1",
        status: "FAILED",
      } as never);

      await createSyncLog({
        shopId: "shop-1",
        status: "FAILED",
        rulesCount: 0,
        error: "API connection error",
      });

      expect(prisma.syncLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: "FAILED",
          error: "API connection error",
        }),
      });
    });

    it("should create sync log with payload", async () => {
      const payload = JSON.stringify({ rules: [{ id: "rule-1" }] });

      vi.mocked(prisma.syncLog.create).mockResolvedValue({ id: "log-1" } as never);

      await createSyncLog({
        shopId: "shop-1",
        status: "SUCCESS",
        rulesCount: 1,
        payload,
      });

      expect(prisma.syncLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          payload,
        }),
      });
    });
  });

  describe("cleanupSyncLogs", () => {
    it("should cleanup old logs keeping specified count", async () => {
      const logsToKeep = [
        { id: "log-1" },
        { id: "log-2" },
        { id: "log-3" },
      ];

      vi.mocked(prisma.syncLog.findMany).mockResolvedValue(logsToKeep as never);
      vi.mocked(prisma.syncLog.deleteMany).mockResolvedValue({ count: 50 } as never);

      const result = await cleanupSyncLogs("shop-1", 3);

      expect(prisma.syncLog.findMany).toHaveBeenCalledWith({
        where: { shopId: "shop-1" },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { id: true },
      });

      expect(prisma.syncLog.deleteMany).toHaveBeenCalledWith({
        where: {
          shopId: "shop-1",
          id: { notIn: ["log-1", "log-2", "log-3"] },
        },
      });

      expect(result).toBe(50);
    });

    it("should use default keep count of 100", async () => {
      vi.mocked(prisma.syncLog.findMany).mockResolvedValue([]);
      vi.mocked(prisma.syncLog.deleteMany).mockResolvedValue({ count: 0 } as never);

      await cleanupSyncLogs("shop-1");

      expect(prisma.syncLog.findMany).toHaveBeenCalledWith({
        where: { shopId: "shop-1" },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: { id: true },
      });
    });

    it("should return 0 when no logs to delete", async () => {
      vi.mocked(prisma.syncLog.findMany).mockResolvedValue([]);
      vi.mocked(prisma.syncLog.deleteMany).mockResolvedValue({ count: 0 } as never);

      const result = await cleanupSyncLogs("shop-1");

      expect(result).toBe(0);
    });
  });
});
