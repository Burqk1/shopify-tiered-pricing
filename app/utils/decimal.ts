/**
 * Decimal Utilities
 *
 * Shared utilities for consistent decimal/number handling across the app.
 * Handles money formatting, percentage calculations, and precision.
 */

import { Decimal } from "@prisma/client/runtime/library";

/**
 * Safely convert a Decimal or number to a number.
 * Handles null/undefined values with optional default.
 */
export function toNumber(value: Decimal | number | string | null | undefined, defaultValue = 0): number {
  if (value === null || value === undefined) {
    return defaultValue;
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  // Handle Prisma Decimal
  if (typeof value === "object" && "toNumber" in value) {
    return value.toNumber();
  }

  return defaultValue;
}

/**
 * Format a number as currency.
 * Uses Intl.NumberFormat for proper localization.
 */
export function formatCurrency(
  value: Decimal | number | string | null | undefined,
  currency = "USD",
  locale = "en-US"
): string {
  const num = toNumber(value, 0);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(num);
}

/**
 * Format a number as percentage.
 * @param value - The decimal value (e.g., 0.15 for 15%)
 * @param decimals - Number of decimal places to show
 */
export function formatPercent(
  value: Decimal | number | string | null | undefined,
  decimals = 1
): string {
  const num = toNumber(value, 0);
  return `${(num * 100).toFixed(decimals)}%`;
}

/**
 * Format a percentage value that's already in percentage form (e.g., 15 for 15%).
 */
export function formatPercentValue(
  value: Decimal | number | string | null | undefined,
  decimals = 1
): string {
  const num = toNumber(value, 0);
  return `${num.toFixed(decimals)}%`;
}

/**
 * Round a number to specified decimal places.
 * Useful for price calculations to avoid floating point errors.
 */
export function roundTo(value: number, decimals = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Calculate percentage discount.
 * @param originalPrice - The original price
 * @param discountedPrice - The price after discount
 * @returns The discount percentage (0-100)
 */
export function calculateDiscountPercent(
  originalPrice: Decimal | number | null | undefined,
  discountedPrice: Decimal | number | null | undefined
): number {
  const original = toNumber(originalPrice);
  const discounted = toNumber(discountedPrice);

  if (original <= 0) return 0;
  if (discounted >= original) return 0;

  return roundTo(((original - discounted) / original) * 100, 1);
}

/**
 * Apply percentage discount to a price.
 * @param price - The original price
 * @param discountPercent - The discount percentage (0-100)
 * @returns The discounted price
 */
export function applyDiscount(
  price: Decimal | number | null | undefined,
  discountPercent: Decimal | number | null | undefined
): number {
  const priceNum = toNumber(price);
  const discountNum = toNumber(discountPercent);

  if (discountNum <= 0 || discountNum > 100) return priceNum;

  return roundTo(priceNum * (1 - discountNum / 100), 2);
}

/**
 * Format a number with thousands separators.
 */
export function formatNumber(
  value: Decimal | number | string | null | undefined,
  decimals = 0,
  locale = "en-US"
): string {
  const num = toNumber(value, 0);
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

/**
 * Parse a price string (with currency symbol) to number.
 * Handles various formats like "$10.00", "10,00 €", etc.
 */
export function parsePriceString(priceString: string): number {
  // Remove currency symbols and non-numeric characters except . and ,
  const cleaned = priceString.replace(/[^\d.,\-]/g, "");

  // Handle European format (1.234,56) vs US format (1,234.56)
  const hasCommaDecimal = /,\d{2}$/.test(cleaned);

  if (hasCommaDecimal) {
    // European format: convert comma to dot, remove dots
    const normalized = cleaned.replace(/\./g, "").replace(",", ".");
    return parseFloat(normalized) || 0;
  } else {
    // US format: remove commas
    const normalized = cleaned.replace(/,/g, "");
    return parseFloat(normalized) || 0;
  }
}

/**
 * Check if a value is a valid positive number.
 */
export function isValidPrice(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  const num = typeof value === "number" ? value : parseFloat(String(value));
  return !isNaN(num) && num >= 0 && isFinite(num);
}

/**
 * Clamp a value between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
