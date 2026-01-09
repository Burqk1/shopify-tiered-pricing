/**
 * Import Job Model
 *
 * Handles CSV import job tracking and processing
 */

import prisma from "~/db.server";

// Types - will be from Prisma after migrate
type ImportJobType = "PRICING_RULES" | "BUNDLES" | "CUSTOMER_GROUPS" | "BOGO_OFFERS" | "GEO_RULES";
type ImportJobStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";
export type { ImportJobType, ImportJobStatus };

export interface CreateImportJobInput {
  shopId: string;
  jobType: ImportJobType;
  fileName: string;
  fileSize: number;
  totalRows?: number;
}

// Get all import jobs for a shop
export async function getImportJobs(shopId: string, limit: number = 20) {
  return prisma.importJob.findMany({
    where: { shopId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

// Get single import job
export async function getImportJob(id: string) {
  return prisma.importJob.findUnique({
    where: { id },
  });
}

// Create import job
export async function createImportJob(data: CreateImportJobInput) {
  return prisma.importJob.create({
    data: {
      shopId: data.shopId,
      jobType: data.jobType,
      fileName: data.fileName,
      fileSize: data.fileSize,
      totalRows: data.totalRows || 0,
      status: "PENDING",
    },
  });
}

// Start processing job
export async function startImportJob(id: string, totalRows: number) {
  return prisma.importJob.update({
    where: { id },
    data: {
      status: "PROCESSING",
      totalRows,
      startedAt: new Date(),
    },
  });
}

// Update job progress
export async function updateImportProgress(
  id: string,
  processedRows: number,
  successRows: number,
  errorRows: number
) {
  return prisma.importJob.update({
    where: { id },
    data: {
      processedRows,
      successRows,
      errorRows,
    },
  });
}

// Complete job
export async function completeImportJob(
  id: string,
  success: boolean,
  createdIds: string[],
  updatedIds: string[],
  errors?: string[]
) {
  return prisma.importJob.update({
    where: { id },
    data: {
      status: success ? "COMPLETED" : "FAILED",
      completedAt: new Date(),
      createdIds,
      updatedIds,
      errors: errors ? JSON.stringify(errors) : null,
    },
  });
}

// Cancel job
export async function cancelImportJob(id: string) {
  return prisma.importJob.update({
    where: { id },
    data: {
      status: "CANCELLED",
      completedAt: new Date(),
    },
  });
}

// CSV parsing utilities
export interface CSVParseResult<T> {
  data: T[];
  errors: Array<{ row: number; message: string }>;
}

export function parseCSV<T>(
  content: string,
  headers: string[],
  transform: (row: Record<string, string>, rowIndex: number) => T | null
): CSVParseResult<T> {
  const lines = content.split("\n").filter((line) => line.trim());
  const data: T[] = [];
  const errors: Array<{ row: number; message: string }> = [];

  if (lines.length === 0) {
    errors.push({ row: 0, message: "Empty file" });
    return { data, errors };
  }

  // Parse header row
  const headerRow = parseCSVLine(lines[0]);
  const headerMap: Record<string, number> = {};

  for (let i = 0; i < headerRow.length; i++) {
    const header = headerRow[i].trim().toLowerCase();
    headerMap[header] = i;
  }

  // Validate required headers
  for (const required of headers) {
    if (!(required.toLowerCase() in headerMap)) {
      errors.push({ row: 0, message: `Missing required column: ${required}` });
    }
  }

  if (errors.length > 0) {
    return { data, errors };
  }

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    try {
      const values = parseCSVLine(lines[i]);
      const row: Record<string, string> = {};

      for (const [header, index] of Object.entries(headerMap)) {
        row[header] = values[index] || "";
      }

      const transformed = transform(row, i);
      if (transformed) {
        data.push(transformed);
      }
    } catch (error) {
      errors.push({
        row: i + 1,
        message: error instanceof Error ? error.message : "Parse error",
      });
    }
  }

  return { data, errors };
}

// Parse single CSV line handling quoted values
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

// Generate CSV content
export function generateCSV<T extends Record<string, unknown>>(
  headers: string[],
  data: T[],
  transform: (item: T) => string[]
): string {
  const lines: string[] = [];

  // Header row
  lines.push(headers.map(escapeCSVValue).join(","));

  // Data rows
  for (const item of data) {
    const values = transform(item);
    lines.push(values.map(escapeCSVValue).join(","));
  }

  return lines.join("\n");
}

function escapeCSVValue(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";

  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Template generators for each import type
export function getPricingRulesCSVTemplate(): string {
  const headers = [
    "name",
    "description",
    "priority",
    "status",
    "condition_type",
    "condition_value",
    "tier_min_qty",
    "tier_max_qty",
    "tier_discount_type",
    "tier_discount_value",
    "tier_message",
    "start_date",
    "end_date",
  ];

  const example = [
    "Summer Sale",
    "10% off 5+ items",
    "1",
    "DRAFT",
    "ALL_PRODUCTS",
    "",
    "5",
    "",
    "PERCENTAGE",
    "10",
    "Buy 5+ and save 10%!",
    "2024-06-01",
    "2024-08-31",
  ];

  return headers.join(",") + "\n" + example.join(",");
}

export function getBogoCSVTemplate(): string {
  const headers = [
    "name",
    "description",
    "bogo_type",
    "buy_quantity",
    "buy_product_ids",
    "get_quantity",
    "get_product_ids",
    "discount_type",
    "discount_value",
    "max_uses_per_order",
    "start_date",
    "end_date",
  ];

  const example = [
    "Buy 2 Get 1 Free",
    "Summer BOGO offer",
    "BUY_X_GET_Y_FREE",
    "2",
    "",
    "1",
    "",
    "PERCENTAGE",
    "100",
    "1",
    "2024-06-01",
    "2024-08-31",
  ];

  return headers.join(",") + "\n" + example.join(",");
}

export function getGeoRulesCSVTemplate(): string {
  const headers = [
    "name",
    "priority",
    "countries",
    "exclude_countries",
    "adjustment_type",
    "adjustment_value",
    "apply_to",
    "display_currency",
  ];

  const example = [
    "EU Pricing +10%",
    "1",
    "DE,FR,IT,ES,NL",
    "GB",
    "PERCENTAGE",
    "10",
    "ALL_PRODUCTS",
    "EUR",
  ];

  return headers.join(",") + "\n" + example.join(",");
}
