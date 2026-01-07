/**
 * Timer Model Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma
vi.mock("~/db.server", () => ({
  default: {
    countdownTimer: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    pricingRule: {
      update: vi.fn(),
    },
  },
}));

import prisma from "~/db.server";
import {
  validateTimerInput,
  createTimer,
  updateTimer,
  updateTimerStatus,
  deleteTimer,
  getTimerById,
  getTimersByShop,
  getActiveTimersForStorefront,
  processExpiredTimers,
} from "~/models/timer.server";

describe("Timer Model", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // VALIDATION TESTS
  // ============================================================================

  describe("validateTimerInput", () => {
    describe("name validation", () => {
      it("should reject empty name", () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 7);

        const result = validateTimerInput({ endTime: futureDate, name: "" });
        expect(result.valid).toBe(false);
        expect(result.error).toBe("Timer name is required");
      });

      it("should reject whitespace-only name", () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 7);

        const result = validateTimerInput({ endTime: futureDate, name: "   " });
        expect(result.valid).toBe(false);
        expect(result.error).toBe("Timer name is required");
      });

      it("should accept valid name", () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 7);

        const result = validateTimerInput({ endTime: futureDate, name: "Summer Sale" });
        expect(result.valid).toBe(true);
      });
    });

    describe("end time validation", () => {
      it("should reject past date", () => {
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 1);

        const result = validateTimerInput({ endTime: pastDate });
        expect(result.valid).toBe(false);
        expect(result.error).toBe("End time must be in the future");
      });

      it("should reject current time", () => {
        const now = new Date();

        const result = validateTimerInput({ endTime: now });
        expect(result.valid).toBe(false);
        expect(result.error).toBe("End time must be in the future");
      });

      it("should accept future date", () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 7);

        const result = validateTimerInput({ endTime: futureDate });
        expect(result.valid).toBe(true);
      });

      it("should allow past dates when explicitly allowed", () => {
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 1);

        const result = validateTimerInput(
          { endTime: pastDate },
          { allowPastDates: true }
        );
        expect(result.valid).toBe(true);
      });

      it("should reject date more than 1 year in future", () => {
        const farFuture = new Date();
        farFuture.setFullYear(farFuture.getFullYear() + 2);

        const result = validateTimerInput({ endTime: farFuture });
        expect(result.valid).toBe(false);
        expect(result.error).toBe("End time cannot be more than 1 year in the future");
      });

      it("should accept date exactly 1 year in future", () => {
        const oneYear = new Date();
        oneYear.setFullYear(oneYear.getFullYear() + 1);
        oneYear.setDate(oneYear.getDate() - 1); // Just under 1 year

        const result = validateTimerInput({ endTime: oneYear });
        expect(result.valid).toBe(true);
      });

      it("should accept date 1 day in future", () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);

        const result = validateTimerInput({ endTime: tomorrow });
        expect(result.valid).toBe(true);
      });

      it("should accept date 1 hour in future", () => {
        const oneHour = new Date();
        oneHour.setHours(oneHour.getHours() + 1);

        const result = validateTimerInput({ endTime: oneHour });
        expect(result.valid).toBe(true);
      });
    });
  });

  // ============================================================================
  // CRUD TESTS
  // ============================================================================

  describe("createTimer", () => {
    it("should create timer with default values", async () => {
      const endTime = new Date("2024-12-31");
      const mockTimer = {
        id: "timer-1",
        shopId: "shop-1",
        name: "Sale Timer",
        endTime,
        status: "DRAFT",
      };

      vi.mocked(prisma.countdownTimer.create).mockResolvedValue(mockTimer as never);

      const result = await createTimer({
        shopId: "shop-1",
        name: "Sale Timer",
        endTime,
      });

      expect(prisma.countdownTimer.create).toHaveBeenCalledWith({
        data: {
          shopId: "shop-1",
          name: "Sale Timer",
          endTime,
          timezone: "UTC",
          title: "Sale ends in:",
          style: "default",
          bgColor: "#ff4444",
          textColor: "#ffffff",
          expiredMessage: undefined,
          hideOnExpiry: false,
          showOn: "ALL_PAGES",
          productIds: [],
          collectionIds: [],
          linkedRuleId: undefined,
          status: "DRAFT",
        },
      });
      expect(result.id).toBe("timer-1");
    });

    it("should create timer with custom values", async () => {
      const endTime = new Date("2024-12-31");
      const mockTimer = { id: "timer-1" };

      vi.mocked(prisma.countdownTimer.create).mockResolvedValue(mockTimer as never);

      await createTimer({
        shopId: "shop-1",
        name: "Custom Timer",
        endTime,
        timezone: "America/New_York",
        title: "Hurry up!",
        style: "modern",
        bgColor: "#000000",
        textColor: "#ffffff",
        expiredMessage: "Sale ended",
        hideOnExpiry: true,
        showOn: "PRODUCT_PAGES",
        productIds: ["prod-1", "prod-2"],
        collectionIds: ["col-1"],
        linkedRuleId: "rule-1",
      });

      expect(prisma.countdownTimer.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          timezone: "America/New_York",
          title: "Hurry up!",
          style: "modern",
          bgColor: "#000000",
          hideOnExpiry: true,
          showOn: "PRODUCT_PAGES",
          productIds: ["prod-1", "prod-2"],
          collectionIds: ["col-1"],
          linkedRuleId: "rule-1",
        }),
      });
    });
  });

  describe("updateTimer", () => {
    it("should update timer properties", async () => {
      vi.mocked(prisma.countdownTimer.update).mockResolvedValue({
        id: "timer-1",
        name: "Updated Timer",
      } as never);

      await updateTimer("timer-1", { name: "Updated Timer" });

      expect(prisma.countdownTimer.update).toHaveBeenCalledWith({
        where: { id: "timer-1" },
        data: { name: "Updated Timer" },
      });
    });

    it("should update multiple properties", async () => {
      const newEndTime = new Date("2025-01-01");
      vi.mocked(prisma.countdownTimer.update).mockResolvedValue({ id: "timer-1" } as never);

      await updateTimer("timer-1", {
        name: "New Name",
        endTime: newEndTime,
        bgColor: "#00ff00",
      });

      expect(prisma.countdownTimer.update).toHaveBeenCalledWith({
        where: { id: "timer-1" },
        data: {
          name: "New Name",
          endTime: newEndTime,
          bgColor: "#00ff00",
        },
      });
    });
  });

  describe("updateTimerStatus", () => {
    it("should update timer status to ACTIVE", async () => {
      vi.mocked(prisma.countdownTimer.update).mockResolvedValue({
        id: "timer-1",
        status: "ACTIVE",
      } as never);

      await updateTimerStatus("timer-1", "ACTIVE");

      expect(prisma.countdownTimer.update).toHaveBeenCalledWith({
        where: { id: "timer-1" },
        data: { status: "ACTIVE" },
      });
    });

    it("should update timer status to PAUSED", async () => {
      vi.mocked(prisma.countdownTimer.update).mockResolvedValue({
        id: "timer-1",
        status: "PAUSED",
      } as never);

      await updateTimerStatus("timer-1", "PAUSED");

      expect(prisma.countdownTimer.update).toHaveBeenCalledWith({
        where: { id: "timer-1" },
        data: { status: "PAUSED" },
      });
    });
  });

  describe("deleteTimer", () => {
    it("should delete timer", async () => {
      vi.mocked(prisma.countdownTimer.delete).mockResolvedValue({ id: "timer-1" } as never);

      await deleteTimer("timer-1");

      expect(prisma.countdownTimer.delete).toHaveBeenCalledWith({
        where: { id: "timer-1" },
      });
    });
  });

  // ============================================================================
  // QUERY TESTS
  // ============================================================================

  describe("getTimerById", () => {
    it("should return timer by id", async () => {
      const mockTimer = {
        id: "timer-1",
        name: "Test Timer",
        status: "ACTIVE",
      };

      vi.mocked(prisma.countdownTimer.findUnique).mockResolvedValue(mockTimer as never);

      const result = await getTimerById("timer-1");

      expect(prisma.countdownTimer.findUnique).toHaveBeenCalledWith({
        where: { id: "timer-1" },
      });
      expect(result?.name).toBe("Test Timer");
    });

    it("should return null for non-existent timer", async () => {
      vi.mocked(prisma.countdownTimer.findUnique).mockResolvedValue(null);

      const result = await getTimerById("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("getTimersByShop", () => {
    it("should return all timers for shop", async () => {
      const mockTimers = [
        { id: "timer-1", name: "Timer 1" },
        { id: "timer-2", name: "Timer 2" },
      ];

      vi.mocked(prisma.countdownTimer.findMany).mockResolvedValue(mockTimers as never);

      const result = await getTimersByShop("shop-1");

      expect(prisma.countdownTimer.findMany).toHaveBeenCalledWith({
        where: { shopId: "shop-1" },
        orderBy: { createdAt: "desc" },
      });
      expect(result).toHaveLength(2);
    });

    it("should return empty array for shop with no timers", async () => {
      vi.mocked(prisma.countdownTimer.findMany).mockResolvedValue([]);

      const result = await getTimersByShop("shop-1");

      expect(result).toHaveLength(0);
    });
  });

  describe("getActiveTimersForStorefront", () => {
    it("should return only active non-expired timers", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      const mockTimers = [
        { id: "timer-1", status: "ACTIVE", endTime: futureDate },
      ];

      vi.mocked(prisma.countdownTimer.findMany).mockResolvedValue(mockTimers as never);

      const result = await getActiveTimersForStorefront("shop-1");

      expect(prisma.countdownTimer.findMany).toHaveBeenCalledWith({
        where: {
          shopId: "shop-1",
          status: "ACTIVE",
          endTime: { gt: expect.any(Date) },
        },
      });
      expect(result).toHaveLength(1);
    });
  });

  // ============================================================================
  // EXPIRED TIMER PROCESSING
  // ============================================================================

  describe("processExpiredTimers", () => {
    it("should archive expired timers", async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const expiredTimers = [
        { id: "timer-1", status: "ACTIVE", endTime: pastDate, linkedRuleId: null },
      ];

      vi.mocked(prisma.countdownTimer.findMany).mockResolvedValue(expiredTimers as never);
      vi.mocked(prisma.countdownTimer.update).mockResolvedValue({ id: "timer-1" } as never);

      const result = await processExpiredTimers();

      expect(prisma.countdownTimer.findMany).toHaveBeenCalledWith({
        where: {
          status: "ACTIVE",
          endTime: { lte: expect.any(Date) },
        },
      });
      expect(prisma.countdownTimer.update).toHaveBeenCalledWith({
        where: { id: "timer-1" },
        data: { status: "ARCHIVED" },
      });
      expect(result).toBe(1);
    });

    it("should pause linked rule when timer expires", async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const expiredTimers = [
        { id: "timer-1", status: "ACTIVE", endTime: pastDate, linkedRuleId: "rule-1" },
      ];

      vi.mocked(prisma.countdownTimer.findMany).mockResolvedValue(expiredTimers as never);
      vi.mocked(prisma.countdownTimer.update).mockResolvedValue({ id: "timer-1" } as never);
      vi.mocked(prisma.pricingRule.update).mockResolvedValue({ id: "rule-1" } as never);

      await processExpiredTimers();

      expect(prisma.pricingRule.update).toHaveBeenCalledWith({
        where: { id: "rule-1" },
        data: { status: "PAUSED" },
      });
    });

    it("should return 0 when no expired timers", async () => {
      vi.mocked(prisma.countdownTimer.findMany).mockResolvedValue([]);

      const result = await processExpiredTimers();

      expect(result).toBe(0);
    });

    it("should process multiple expired timers", async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const expiredTimers = [
        { id: "timer-1", status: "ACTIVE", endTime: pastDate, linkedRuleId: null },
        { id: "timer-2", status: "ACTIVE", endTime: pastDate, linkedRuleId: "rule-2" },
        { id: "timer-3", status: "ACTIVE", endTime: pastDate, linkedRuleId: null },
      ];

      vi.mocked(prisma.countdownTimer.findMany).mockResolvedValue(expiredTimers as never);
      vi.mocked(prisma.countdownTimer.update).mockResolvedValue({ id: "timer-1" } as never);
      vi.mocked(prisma.pricingRule.update).mockResolvedValue({ id: "rule-2" } as never);

      const result = await processExpiredTimers();

      expect(prisma.countdownTimer.update).toHaveBeenCalledTimes(3);
      expect(prisma.pricingRule.update).toHaveBeenCalledTimes(1);
      expect(result).toBe(3);
    });
  });
});
