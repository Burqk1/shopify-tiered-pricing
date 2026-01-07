/**
 * Bundle Model Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma
vi.mock("~/db.server", () => ({
  default: {
    bundle: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    bundleProduct: {
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import prisma from "~/db.server";
import {
  createBundle,
  updateBundle,
  updateBundleStatus,
  deleteBundle,
  getBundleById,
  getBundlesByShop,
  getActiveBundlesForStorefront,
  addProductToBundle,
  removeProductFromBundle,
} from "~/models/bundle.server";

describe("Bundle Model", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createBundle", () => {
    it("should create a bundle with products", async () => {
      const mockBundle = {
        id: "bundle-1",
        shopId: "shop-1",
        name: "Summer Bundle",
        status: "DRAFT",
        products: [{ id: "bp-1", productId: "prod-1" }],
      };

      vi.mocked(prisma.bundle.create).mockResolvedValue(mockBundle as never);

      const result = await createBundle({
        shopId: "shop-1",
        name: "Summer Bundle",
        discountType: "PERCENTAGE",
        discountValue: 15,
        products: [{ productId: "prod-1", productTitle: "T-Shirt" }],
      });

      expect(prisma.bundle.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          shopId: "shop-1",
          name: "Summer Bundle",
          discountType: "PERCENTAGE",
          discountValue: 15,
          status: "DRAFT",
        }),
        include: { products: true },
      });
      expect(result.id).toBe("bundle-1");
    });

    it("should set default values for requireAll and minProducts", async () => {
      vi.mocked(prisma.bundle.create).mockResolvedValue({ id: "bundle-1" } as never);

      await createBundle({
        shopId: "shop-1",
        name: "Test Bundle",
        discountType: "FIXED_AMOUNT",
        discountValue: 10,
        products: [{ productId: "prod-1" }],
      });

      expect(prisma.bundle.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          requireAll: true,
          minProducts: 2,
        }),
        include: { products: true },
      });
    });

    it("should accept optional scheduling dates", async () => {
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-12-31");

      vi.mocked(prisma.bundle.create).mockResolvedValue({ id: "bundle-1" } as never);

      await createBundle({
        shopId: "shop-1",
        name: "Scheduled Bundle",
        discountType: "PERCENTAGE",
        discountValue: 20,
        startDate,
        endDate,
        products: [{ productId: "prod-1" }],
      });

      expect(prisma.bundle.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          startDate,
          endDate,
        }),
        include: { products: true },
      });
    });
  });

  describe("updateBundle", () => {
    it("should update bundle properties", async () => {
      vi.mocked(prisma.bundle.update).mockResolvedValue({ id: "bundle-1", name: "Updated Bundle" } as never);

      await updateBundle("bundle-1", { name: "Updated Bundle" });

      expect(prisma.bundle.update).toHaveBeenCalledWith({
        where: { id: "bundle-1" },
        data: { name: "Updated Bundle" },
      });
    });
  });

  describe("updateBundleStatus", () => {
    it("should update bundle status to ACTIVE", async () => {
      vi.mocked(prisma.bundle.update).mockResolvedValue({ id: "bundle-1", status: "ACTIVE" } as never);

      await updateBundleStatus("bundle-1", "ACTIVE");

      expect(prisma.bundle.update).toHaveBeenCalledWith({
        where: { id: "bundle-1" },
        data: { status: "ACTIVE" },
      });
    });

    it("should update bundle status to PAUSED", async () => {
      vi.mocked(prisma.bundle.update).mockResolvedValue({ id: "bundle-1", status: "PAUSED" } as never);

      await updateBundleStatus("bundle-1", "PAUSED");

      expect(prisma.bundle.update).toHaveBeenCalledWith({
        where: { id: "bundle-1" },
        data: { status: "PAUSED" },
      });
    });
  });

  describe("deleteBundle", () => {
    it("should delete a bundle", async () => {
      vi.mocked(prisma.bundle.delete).mockResolvedValue({ id: "bundle-1" } as never);

      await deleteBundle("bundle-1");

      expect(prisma.bundle.delete).toHaveBeenCalledWith({
        where: { id: "bundle-1" },
      });
    });
  });

  describe("getBundleById", () => {
    it("should return bundle with products", async () => {
      const mockBundle = {
        id: "bundle-1",
        name: "Test Bundle",
        products: [{ id: "bp-1", productId: "prod-1" }],
      };

      vi.mocked(prisma.bundle.findUnique).mockResolvedValue(mockBundle as never);

      const result = await getBundleById("bundle-1");

      expect(prisma.bundle.findUnique).toHaveBeenCalledWith({
        where: { id: "bundle-1" },
        include: { products: true },
      });
      expect(result?.products).toHaveLength(1);
    });

    it("should return null for non-existent bundle", async () => {
      vi.mocked(prisma.bundle.findUnique).mockResolvedValue(null);

      const result = await getBundleById("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("getBundlesByShop", () => {
    it("should return all bundles for a shop", async () => {
      const mockBundles = [
        { id: "bundle-1", name: "Bundle 1", products: [] },
        { id: "bundle-2", name: "Bundle 2", products: [] },
      ];

      vi.mocked(prisma.bundle.findMany).mockResolvedValue(mockBundles as never);

      const result = await getBundlesByShop("shop-1");

      expect(prisma.bundle.findMany).toHaveBeenCalledWith({
        where: { shopId: "shop-1" },
        include: { products: true },
        orderBy: { createdAt: "desc" },
      });
      expect(result).toHaveLength(2);
    });
  });

  describe("getActiveBundlesForStorefront", () => {
    it("should return only active bundles within date range", async () => {
      const mockBundles = [{ id: "bundle-1", status: "ACTIVE", products: [] }];

      vi.mocked(prisma.bundle.findMany).mockResolvedValue(mockBundles as never);

      const result = await getActiveBundlesForStorefront("shop-1");

      expect(prisma.bundle.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          shopId: "shop-1",
          status: "ACTIVE",
        }),
        include: { products: true },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe("addProductToBundle", () => {
    it("should add a product to bundle", async () => {
      vi.mocked(prisma.bundleProduct.create).mockResolvedValue({
        id: "bp-1",
        bundleId: "bundle-1",
        productId: "prod-1",
      } as never);

      await addProductToBundle("bundle-1", "prod-1", "var-1", "T-Shirt", 2);

      expect(prisma.bundleProduct.create).toHaveBeenCalledWith({
        data: {
          bundleId: "bundle-1",
          productId: "prod-1",
          variantId: "var-1",
          productTitle: "T-Shirt",
          minQuantity: 2,
        },
      });
    });

    it("should use default minQuantity of 1", async () => {
      vi.mocked(prisma.bundleProduct.create).mockResolvedValue({ id: "bp-1" } as never);

      await addProductToBundle("bundle-1", "prod-1");

      expect(prisma.bundleProduct.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          minQuantity: 1,
        }),
      });
    });
  });

  describe("removeProductFromBundle", () => {
    it("should remove a product from bundle", async () => {
      vi.mocked(prisma.bundleProduct.delete).mockResolvedValue({ id: "bp-1" } as never);

      await removeProductFromBundle("bp-1");

      expect(prisma.bundleProduct.delete).toHaveBeenCalledWith({
        where: { id: "bp-1" },
      });
    });
  });
});
