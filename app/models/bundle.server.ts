/**
 * Bundle Server Functions
 */

import prisma from "~/db.server";
import type { RuleStatus, DiscountType } from "@prisma/client";

interface CreateBundleInput {
  shopId: string;
  name: string;
  description?: string;
  discountType: DiscountType;
  discountValue: number;
  startDate?: Date;
  endDate?: Date;
  requireAll?: boolean;
  minProducts?: number;
  products: Array<{
    productId: string;
    variantId?: string;
    productTitle?: string;
    minQuantity?: number;
  }>;
}

export async function createBundle(input: CreateBundleInput) {
  return prisma.bundle.create({
    data: {
      shopId: input.shopId,
      name: input.name,
      description: input.description,
      discountType: input.discountType,
      discountValue: input.discountValue,
      startDate: input.startDate,
      endDate: input.endDate,
      requireAll: input.requireAll ?? true,
      minProducts: input.minProducts ?? 2,
      status: "DRAFT",
      products: {
        create: input.products.map((p) => ({
          productId: p.productId,
          variantId: p.variantId,
          productTitle: p.productTitle,
          minQuantity: p.minQuantity ?? 1,
        })),
      },
    },
    include: {
      products: true,
    },
  });
}

export async function updateBundle(
  id: string,
  data: Partial<Omit<CreateBundleInput, "shopId" | "products">>
) {
  return prisma.bundle.update({
    where: { id },
    data,
  });
}

export async function updateBundleStatus(id: string, status: RuleStatus) {
  return prisma.bundle.update({
    where: { id },
    data: { status },
  });
}

export async function deleteBundle(id: string) {
  return prisma.bundle.delete({
    where: { id },
  });
}

export async function getBundleById(id: string) {
  return prisma.bundle.findUnique({
    where: { id },
    include: { products: true },
  });
}

export async function getBundlesByShop(shopId: string) {
  return prisma.bundle.findMany({
    where: { shopId },
    include: { products: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getActiveBundlesForStorefront(shopId: string) {
  const now = new Date();
  return prisma.bundle.findMany({
    where: {
      shopId,
      status: "ACTIVE",
      OR: [
        { startDate: null },
        { startDate: { lte: now } },
      ],
      AND: [
        {
          OR: [
            { endDate: null },
            { endDate: { gte: now } },
          ],
        },
      ],
    },
    include: { products: true },
  });
}

export async function addProductToBundle(
  bundleId: string,
  productId: string,
  variantId?: string,
  productTitle?: string,
  minQuantity?: number
) {
  return prisma.bundleProduct.create({
    data: {
      bundleId,
      productId,
      variantId,
      productTitle,
      minQuantity: minQuantity ?? 1,
    },
  });
}

export async function removeProductFromBundle(bundleProductId: string) {
  return prisma.bundleProduct.delete({
    where: { id: bundleProductId },
  });
}
