/**
 * Create New Bundle Route
 */

import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import {
  Page,
  Card,
  FormLayout,
  TextField,
  Select,
  Button,
  BlockStack,
  InlineStack,
  Text,
  Banner,
  ResourceList,
  ResourceItem,
  Thumbnail,
  Box,
  Divider,
  Badge,
} from "@shopify/polaris";
import { ImageIcon, DeleteIcon } from "@shopify/polaris-icons";
import { useState, useCallback } from "react";

import { authenticate } from "~/shopify.server";
import { getShopByDomain } from "~/models/shop.server";
import { createBundle } from "~/models/bundle.server";
import type { DiscountType } from "@prisma/client";

interface SelectedProduct {
  id: string;
  title: string;
  image?: string;
  variantId?: string;
  variantTitle?: string;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const shop = await getShopByDomain(session.shop);
  if (!shop) {
    throw new Response("Shop not found", { status: 404 });
  }

  return json({ shopId: shop.id });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  const shop = await getShopByDomain(session.shop);
  if (!shop) {
    return json({ error: "Shop not found" }, { status: 404 });
  }

  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const discountType = formData.get("discountType") as DiscountType;
  const discountValue = parseFloat(formData.get("discountValue") as string);
  const requireAll = formData.get("requireAll") === "true";
  const productsJson = formData.get("products") as string;

  if (!name || !discountValue || !productsJson) {
    return json({ error: "Name, discount, and products are required" }, { status: 400 });
  }

  const products = JSON.parse(productsJson) as SelectedProduct[];

  if (products.length < 2) {
    return json({ error: "A bundle must have at least 2 products" }, { status: 400 });
  }

  await createBundle({
    shopId: shop.id,
    name,
    description: description || undefined,
    discountType,
    discountValue,
    requireAll,
    minProducts: requireAll ? products.length : 2,
    products: products.map((p) => ({
      productId: p.id,
      variantId: p.variantId,
      productTitle: p.title,
      minQuantity: 1,
    })),
  });

  return redirect("/app/bundles");
};

export default function NewBundle() {
  const { shopId } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState<DiscountType>("PERCENTAGE");
  const [discountValue, setDiscountValue] = useState("15");
  const [requireAll, setRequireAll] = useState(true);
  const [products, setProducts] = useState<SelectedProduct[]>([]);
  const [productInput, setProductInput] = useState("");

  const isLoading = navigation.state === "submitting";

  // Add demo product (in real app, would use Shopify Resource Picker)
  const handleAddProduct = () => {
    if (!productInput.trim()) return;

    const newProduct: SelectedProduct = {
      id: `gid://shopify/Product/${Date.now()}`,
      title: productInput,
    };

    setProducts([...products, newProduct]);
    setProductInput("");
  };

  const handleRemoveProduct = (id: string) => {
    setProducts(products.filter((p) => p.id !== id));
  };

  const handleSubmit = () => {
    const formData = new FormData();
    formData.append("name", name);
    formData.append("description", description);
    formData.append("discountType", discountType);
    formData.append("discountValue", discountValue);
    formData.append("requireAll", requireAll.toString());
    formData.append("products", JSON.stringify(products));
    submit(formData, { method: "post" });
  };

  // Calculate savings preview
  const calculateSavings = () => {
    const samplePrice = 100; // $100 total
    if (discountType === "PERCENTAGE") {
      return `${discountValue}% = $${(samplePrice * parseFloat(discountValue) / 100).toFixed(2)} off $${samplePrice}`;
    }
    return `$${discountValue} off total`;
  };

  return (
    <Page
      title="Create Product Bundle"
      backAction={{ content: "Bundles", url: "/app/bundles" }}
    >
      <BlockStack gap="500">
        <Banner tone="info">
          <p>
            Product bundles encourage customers to buy more items together at a
            special discount price.
          </p>
        </Banner>

        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">
              Bundle Details
            </Text>
            <FormLayout>
              <TextField
                label="Bundle Name"
                value={name}
                onChange={setName}
                placeholder="e.g., Summer Outfit Bundle"
                helpText="Customers will see this name"
                autoComplete="off"
              />

              <TextField
                label="Description (Optional)"
                value={description}
                onChange={setDescription}
                placeholder="e.g., Get the complete summer look!"
                multiline={2}
                autoComplete="off"
              />
            </FormLayout>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">
              Discount
            </Text>
            <FormLayout>
              <FormLayout.Group>
                <Select
                  label="Discount Type"
                  options={[
                    { label: "Percentage off", value: "PERCENTAGE" },
                    { label: "Fixed amount off", value: "FIXED_AMOUNT" },
                  ]}
                  value={discountType}
                  onChange={(v) => setDiscountType(v as DiscountType)}
                />
                <TextField
                  type="number"
                  label={discountType === "PERCENTAGE" ? "Percentage" : "Amount ($)"}
                  value={discountValue}
                  onChange={setDiscountValue}
                  suffix={discountType === "PERCENTAGE" ? "%" : ""}
                  prefix={discountType === "FIXED_AMOUNT" ? "$" : ""}
                  autoComplete="off"
                />
              </FormLayout.Group>

              <Select
                label="Bundle Type"
                options={[
                  { label: "Must buy ALL products", value: "true" },
                  { label: "Mix & match (any 2+)", value: "false" },
                ]}
                value={requireAll.toString()}
                onChange={(v) => setRequireAll(v === "true")}
                helpText={
                  requireAll
                    ? "Customer must add all products to cart"
                    : "Customer can pick any 2 or more products"
                }
              />
            </FormLayout>

            <Box padding="300" background="bg-surface-secondary" borderRadius="200">
              <Text variant="bodySm" as="p">
                Example savings: {calculateSavings()}
              </Text>
            </Box>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">
              Products in Bundle ({products.length})
            </Text>

            {products.length < 2 && (
              <Banner tone="warning">
                Add at least 2 products to create a bundle
              </Banner>
            )}

            {/* Add Product Input */}
            <InlineStack gap="200" align="end">
              <Box minWidth="300px">
                <TextField
                  label="Add Product"
                  labelHidden
                  value={productInput}
                  onChange={setProductInput}
                  placeholder="Enter product name"
                  autoComplete="off"
                  connectedRight={
                    <Button onClick={handleAddProduct}>Add</Button>
                  }
                />
              </Box>
            </InlineStack>

            <Text variant="bodySm" tone="subdued" as="p">
              In production, this would open Shopify's Product Picker. For demo,
              type product names manually.
            </Text>

            <Divider />

            {/* Product List */}
            {products.length > 0 ? (
              <ResourceList
                resourceName={{ singular: "product", plural: "products" }}
                items={products}
                renderItem={(product) => (
                  <ResourceItem
                    id={product.id}
                    onClick={() => {}}
                    media={
                      <Thumbnail
                        source={product.image || ImageIcon}
                        alt={product.title}
                        size="small"
                      />
                    }
                    accessibilityLabel={`View details for ${product.title}`}
                  >
                    <InlineStack align="space-between" blockAlign="center">
                      <BlockStack gap="100">
                        <Text variant="bodyMd" fontWeight="semibold" as="span">
                          {product.title}
                        </Text>
                        {product.variantTitle && (
                          <Text variant="bodySm" tone="subdued" as="span">
                            {product.variantTitle}
                          </Text>
                        )}
                      </BlockStack>
                      <Button
                        icon={DeleteIcon}
                        tone="critical"
                        variant="plain"
                        onClick={() => handleRemoveProduct(product.id)}
                        accessibilityLabel={`Remove ${product.title}`}
                      />
                    </InlineStack>
                  </ResourceItem>
                )}
              />
            ) : (
              <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                <Text as="p" alignment="center" tone="subdued">
                  No products added yet
                </Text>
              </Box>
            )}
          </BlockStack>
        </Card>

        {/* Preview */}
        {products.length >= 2 && (
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h2">
                Bundle Preview
              </Text>
              <Box
                padding="400"
                background="bg-surface-secondary"
                borderRadius="200"
                borderWidth="025"
                borderColor="border"
              >
                <BlockStack gap="200">
                  <Text variant="headingSm" as="h3">
                    {name || "Bundle Name"}
                  </Text>
                  <Text variant="bodySm" tone="subdued" as="p">
                    {products.map((p) => p.title).join(" + ")}
                  </Text>
                  <Badge tone="success">
                    {discountType === "PERCENTAGE"
                      ? `${discountValue}% OFF`
                      : `$${discountValue} OFF`}
                  </Badge>
                </BlockStack>
              </Box>
            </BlockStack>
          </Card>
        )}

        <InlineStack align="end" gap="200">
          <Button url="/app/bundles">Cancel</Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={isLoading}
            disabled={!name || !discountValue || products.length < 2}
          >
            Create Bundle
          </Button>
        </InlineStack>
      </BlockStack>
    </Page>
  );
}
