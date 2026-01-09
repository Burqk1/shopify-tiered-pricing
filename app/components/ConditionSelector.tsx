/**
 * ConditionSelector Component
 *
 * Select products, collections, or customer tags
 * that a pricing rule applies to.
 */

import {
  BlockStack,
  InlineStack,
  Select,
  TextField,
  Button,
  Tag,
  Card,
  Text,
  Autocomplete,
  Icon,
  Box,
  Thumbnail,
} from "@shopify/polaris";
import { DeleteIcon, PlusIcon, SearchIcon } from "@shopify/polaris-icons";
import { useState, useCallback, useMemo } from "react";
import type { ConditionType } from "@prisma/client";

export interface Condition {
  type: ConditionType;
  value: string;
  label?: string | null | undefined;
}

interface Product {
  id: string;
  title: string;
  image?: string;
}

interface Collection {
  id: string;
  title: string;
}

interface ConditionSelectorProps {
  conditions: Condition[];
  onChange: (conditions: Condition[]) => void;
  products: Product[];
  collections: Collection[];
  allowCustomerTags?: boolean;
}

export function ConditionSelector({
  conditions,
  onChange,
  products,
  collections,
  allowCustomerTags = false,
}: ConditionSelectorProps) {
  const [conditionType, setConditionType] = useState<ConditionType>("PRODUCT");
  const [searchValue, setSearchValue] = useState("");
  const [tagInput, setTagInput] = useState("");

  const conditionTypeOptions = useMemo(() => {
    const options = [
      { label: "Specific Product", value: "PRODUCT" },
      { label: "Collection", value: "COLLECTION" },
      { label: "All Products", value: "ALL_PRODUCTS" },
    ];

    if (allowCustomerTags) {
      options.push({ label: "Customer Tag", value: "CUSTOMER_TAG" });
    }

    return options;
  }, [allowCustomerTags]);

  const filteredProducts = useMemo(() => {
    if (!searchValue) return products.slice(0, 10);
    const lower = searchValue.toLowerCase();
    return products
      .filter((p) => p.title.toLowerCase().includes(lower))
      .slice(0, 10);
  }, [products, searchValue]);

  const filteredCollections = useMemo(() => {
    if (!searchValue) return collections.slice(0, 10);
    const lower = searchValue.toLowerCase();
    return collections
      .filter((c) => c.title.toLowerCase().includes(lower))
      .slice(0, 10);
  }, [collections, searchValue]);

  const handleAddCondition = useCallback(
    (type: ConditionType, value: string, label?: string) => {
      // Prevent duplicates
      const exists = conditions.some(
        (c) => c.type === type && c.value === value
      );
      if (exists) return;

      onChange([...conditions, { type, value, label }]);
      setSearchValue("");
      setTagInput("");
    },
    [conditions, onChange]
  );

  const handleRemoveCondition = useCallback(
    (index: number) => {
      const newConditions = conditions.filter((_, i) => i !== index);
      onChange(newConditions);
    },
    [conditions, onChange]
  );

  const handleAddAllProducts = useCallback(() => {
    const filtered = conditions.filter((c) => c.type !== "ALL_PRODUCTS");
    onChange([...filtered, { type: "ALL_PRODUCTS", value: "*", label: "All Products" }]);
  }, [conditions, onChange]);

  const handleAddTag = useCallback(() => {
    if (!tagInput.trim()) return;
    handleAddCondition("CUSTOMER_TAG", tagInput.trim(), tagInput.trim());
  }, [tagInput, handleAddCondition]);

  const getConditionTypeLabel = (type: ConditionType): string => {
    const labels: Record<ConditionType, string> = {
      PRODUCT: "Product",
      VARIANT: "Variant",
      COLLECTION: "Collection",
      CUSTOMER_TAG: "Customer Tag",
      ALL_PRODUCTS: "All Products",
    };
    return labels[type];
  };

  return (
    <BlockStack gap="400">
      {conditions.length > 0 && (
        <Card background="bg-surface-secondary">
          <BlockStack gap="200">
            <Text variant="headingSm" as="h4">
              Applied Conditions ({conditions.length})
            </Text>
            <InlineStack gap="200" wrap>
              {conditions.map((condition, index) => (
                <Tag
                  key={`${condition.type}-${condition.value}-${index}`}
                  onRemove={() => handleRemoveCondition(index)}
                >
                  <InlineStack gap="100" blockAlign="center">
                    <Text variant="bodySm" tone="subdued" as="span">
                      {getConditionTypeLabel(condition.type)}:
                    </Text>
                    <Text variant="bodySm" as="span">
                      {condition.label || condition.value}
                    </Text>
                  </InlineStack>
                </Tag>
              ))}
            </InlineStack>
          </BlockStack>
        </Card>
      )}

      <Card>
        <BlockStack gap="300">
          <Text variant="headingSm" as="h4">
            Add Condition
          </Text>

          <Select
            label="Condition Type"
            options={conditionTypeOptions}
            value={conditionType}
            onChange={(value) => setConditionType(value as ConditionType)}
          />

          {conditionType === "PRODUCT" && (
            <BlockStack gap="200">
              <TextField
                label="Search Products"
                value={searchValue}
                onChange={setSearchValue}
                autoComplete="off"
                placeholder="Type to search..."
                prefix={<Icon source={SearchIcon} />}
              />
              {filteredProducts.length > 0 && (
                <BlockStack gap="100">
                  {filteredProducts.map((product) => (
                    <Box
                      key={product.id}
                      padding="200"
                      background="bg-surface-hover"
                      borderRadius="100"
                    >
                      <InlineStack align="space-between" blockAlign="center">
                        <InlineStack gap="200" blockAlign="center">
                          {product.image && (
                            <Thumbnail
                              source={product.image}
                              alt={product.title}
                              size="small"
                            />
                          )}
                          <Text variant="bodyMd" as="span">
                            {product.title}
                          </Text>
                        </InlineStack>
                        <Button
                          size="slim"
                          onClick={() =>
                            handleAddCondition("PRODUCT", product.id, product.title)
                          }
                        >
                          Add
                        </Button>
                      </InlineStack>
                    </Box>
                  ))}
                </BlockStack>
              )}
            </BlockStack>
          )}

          {conditionType === "COLLECTION" && (
            <BlockStack gap="200">
              <TextField
                label="Search Collections"
                value={searchValue}
                onChange={setSearchValue}
                autoComplete="off"
                placeholder="Type to search..."
                prefix={<Icon source={SearchIcon} />}
              />
              {filteredCollections.length > 0 && (
                <BlockStack gap="100">
                  {filteredCollections.map((collection) => (
                    <Box
                      key={collection.id}
                      padding="200"
                      background="bg-surface-hover"
                      borderRadius="100"
                    >
                      <InlineStack align="space-between" blockAlign="center">
                        <Text variant="bodyMd" as="span">
                          {collection.title}
                        </Text>
                        <Button
                          size="slim"
                          onClick={() =>
                            handleAddCondition(
                              "COLLECTION",
                              collection.id,
                              collection.title
                            )
                          }
                        >
                          Add
                        </Button>
                      </InlineStack>
                    </Box>
                  ))}
                </BlockStack>
              )}
            </BlockStack>
          )}

          {conditionType === "CUSTOMER_TAG" && (
            <InlineStack gap="200" blockAlign="end">
              <Box minWidth="300px">
                <TextField
                  label="Customer Tag"
                  value={tagInput}
                  onChange={setTagInput}
                  autoComplete="off"
                  placeholder="e.g., wholesale, vip"
                  helpText="Customers with this tag will see the discount"
                />
              </Box>
              <Button onClick={handleAddTag} disabled={!tagInput.trim()}>
                Add Tag
              </Button>
            </InlineStack>
          )}

          {conditionType === "ALL_PRODUCTS" && (
            <BlockStack gap="200">
              <Text variant="bodyMd" as="p">
                This rule will apply to all products in your store.
              </Text>
              <Button onClick={handleAddAllProducts}>
                Apply to All Products
              </Button>
            </BlockStack>
          )}
        </BlockStack>
      </Card>

      {!allowCustomerTags && (
        <Box background="bg-surface-warning" padding="300" borderRadius="200">
          <Text variant="bodySm" as="p">
            <strong>Upgrade to Growth</strong> to filter by customer tags and
            create B2B-specific pricing.
          </Text>
        </Box>
      )}
    </BlockStack>
  );
}
