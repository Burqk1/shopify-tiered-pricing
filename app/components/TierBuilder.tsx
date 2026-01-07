/**
 * TierBuilder Component
 *
 * Dynamic form for building quantity-based discount tiers.
 * Supports percentage and fixed amount discounts.
 */

import {
  BlockStack,
  InlineStack,
  TextField,
  Select,
  Button,
  Card,
  Text,
  Icon,
  Divider,
  Box,
} from "@shopify/polaris";
import { DeleteIcon, PlusIcon } from "@shopify/polaris-icons";
import { useCallback } from "react";
import type { DiscountType } from "@prisma/client";

export interface Tier {
  minQuantity: number;
  maxQuantity?: number | null | undefined;
  valueType: DiscountType;
  value: number;
  message?: string | null | undefined;
}

interface TierBuilderProps {
  tiers: Tier[];
  onChange: (tiers: Tier[]) => void;
}

export function TierBuilder({ tiers, onChange }: TierBuilderProps) {
  const handleTierChange = useCallback(
    (index: number, field: keyof Tier, value: Tier[keyof Tier]) => {
      const newTiers = [...tiers];
      newTiers[index] = { ...newTiers[index], [field]: value };
      onChange(newTiers);
    },
    [tiers, onChange]
  );

  const handleAddTier = useCallback(() => {
    // Auto-calculate next min based on last tier's max
    const lastTier = tiers[tiers.length - 1];
    const nextMin = lastTier?.maxQuantity
      ? lastTier.maxQuantity + 1
      : (lastTier?.minQuantity || 0) + 10;

    onChange([
      ...tiers,
      {
        minQuantity: nextMin,
        maxQuantity: null,
        valueType: "PERCENTAGE",
        value: 0,
      },
    ]);
  }, [tiers, onChange]);

  const handleRemoveTier = useCallback(
    (index: number) => {
      const newTiers = tiers.filter((_, i) => i !== index);
      onChange(newTiers);
    },
    [tiers, onChange]
  );

  const discountTypeOptions = [
    { label: "Percentage (%)", value: "PERCENTAGE" },
    { label: "Fixed Amount ($)", value: "FIXED_AMOUNT" },
  ];

  return (
    <BlockStack gap="400">
      {tiers.map((tier, index) => (
        <Card key={index} background="bg-surface-secondary">
          <BlockStack gap="300">
            <InlineStack align="space-between">
              <Text variant="headingSm" as="h4">
                Tier {index + 1}
              </Text>
              {tiers.length > 1 && (
                <Button
                  icon={DeleteIcon}
                  tone="critical"
                  variant="plain"
                  onClick={() => handleRemoveTier(index)}
                  accessibilityLabel="Remove tier"
                />
              )}
            </InlineStack>

            <InlineStack gap="300" wrap={false}>
              <Box minWidth="120px">
                <TextField
                  label="Min Quantity"
                  type="number"
                  value={tier.minQuantity.toString()}
                  onChange={(value) =>
                    handleTierChange(index, "minQuantity", parseInt(value) || 1)
                  }
                  autoComplete="off"
                  min={1}
                />
              </Box>
              <Box minWidth="120px">
                <TextField
                  label="Max Quantity"
                  type="number"
                  value={tier.maxQuantity?.toString() || ""}
                  onChange={(value) =>
                    handleTierChange(
                      index,
                      "maxQuantity",
                      value ? parseInt(value) : null
                    )
                  }
                  autoComplete="off"
                  placeholder="Unlimited"
                  helpText="Leave empty for unlimited"
                />
              </Box>
              <Box minWidth="150px">
                <Select
                  label="Discount Type"
                  options={discountTypeOptions}
                  value={tier.valueType}
                  onChange={(value) =>
                    handleTierChange(index, "valueType", value as DiscountType)
                  }
                />
              </Box>
              <Box minWidth="120px">
                <TextField
                  label={tier.valueType === "PERCENTAGE" ? "Discount %" : "Discount $"}
                  type="number"
                  value={tier.value.toString()}
                  onChange={(value) =>
                    handleTierChange(index, "value", parseFloat(value) || 0)
                  }
                  autoComplete="off"
                  suffix={tier.valueType === "PERCENTAGE" ? "%" : "$"}
                  min={0}
                  max={tier.valueType === "PERCENTAGE" ? 100 : undefined}
                />
              </Box>
            </InlineStack>

            <TextField
              label="Custom Message (optional)"
              value={tier.message || ""}
              onChange={(value) => handleTierChange(index, "message", value || undefined)}
              autoComplete="off"
              placeholder="e.g., Buy 10+ and save 20%!"
              helpText="Shown to customers in the cart"
            />

            {/* Preview */}
            <Box
              background="bg-surface"
              padding="300"
              borderRadius="200"
              borderColor="border"
              borderWidth="025"
            >
              <Text variant="bodySm" tone="subdued" as="p">
                Preview:{" "}
                <Text variant="bodySm" fontWeight="semibold" as="span">
                  {tier.minQuantity}
                  {tier.maxQuantity ? `-${tier.maxQuantity}` : "+"} items
                </Text>{" "}
                →{" "}
                <Text variant="bodySm" fontWeight="semibold" tone="success" as="span">
                  {tier.valueType === "PERCENTAGE"
                    ? `${tier.value}% off`
                    : `$${tier.value} off each`}
                </Text>
              </Text>
            </Box>
          </BlockStack>
        </Card>
      ))}

      <Button icon={PlusIcon} onClick={handleAddTier}>
        Add Another Tier
      </Button>

      {/* Help Text */}
      <Box
        background="bg-surface-info"
        padding="300"
        borderRadius="200"
      >
        <Text variant="bodySm" as="p">
          <strong>Tip:</strong> Create multiple tiers to encourage larger orders.
          Example: 5-9 items = 10% off, 10-24 items = 15% off, 25+ items = 20% off.
        </Text>
      </Box>
    </BlockStack>
  );
}
