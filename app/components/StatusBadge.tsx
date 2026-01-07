/**
 * StatusBadge Component
 *
 * Reusable status badge component for displaying entity statuses
 * (rules, bundles, timers, etc.) with consistent styling.
 */

import { Badge } from "@shopify/polaris";
import type { RuleStatus } from "@prisma/client";

export type StatusType = RuleStatus | "SCHEDULED" | "EXPIRED" | "RUNNING" | "COMPLETED" | "FAILED";

interface StatusConfig {
  label: string;
  tone: "success" | "warning" | "critical" | "info" | "attention" | undefined;
  progress?: "complete" | "incomplete" | "partiallyComplete";
}

const STATUS_CONFIG: Record<StatusType, StatusConfig> = {
  ACTIVE: {
    label: "Active",
    tone: "success",
    progress: "complete",
  },
  DRAFT: {
    label: "Draft",
    tone: "info",
    progress: "incomplete",
  },
  PAUSED: {
    label: "Paused",
    tone: "warning",
    progress: "partiallyComplete",
  },
  ARCHIVED: {
    label: "Archived",
    tone: undefined,
    progress: "incomplete",
  },
  SCHEDULED: {
    label: "Scheduled",
    tone: "attention",
    progress: "partiallyComplete",
  },
  EXPIRED: {
    label: "Expired",
    tone: "critical",
    progress: "complete",
  },
  RUNNING: {
    label: "Running",
    tone: "success",
    progress: "partiallyComplete",
  },
  COMPLETED: {
    label: "Completed",
    tone: "success",
    progress: "complete",
  },
  FAILED: {
    label: "Failed",
    tone: "critical",
    progress: "complete",
  },
};

interface StatusBadgeProps {
  status: StatusType;
  size?: "small" | "medium" | "large";
}

export function StatusBadge({ status, size = "medium" }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || {
    label: status,
    tone: undefined,
    progress: undefined,
  };

  return (
    <Badge
      tone={config.tone}
      progress={config.progress}
      size={size}
    >
      {config.label}
    </Badge>
  );
}

export function getStatusConfig(status: StatusType): StatusConfig {
  return STATUS_CONFIG[status] || {
    label: status,
    tone: undefined,
    progress: undefined,
  };
}
