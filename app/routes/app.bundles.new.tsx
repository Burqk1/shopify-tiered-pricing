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
import { getShopByDomain, getLocaleSettings } from "~/models/shop.server";
import { createBundle } from "~/models/bundle.server";
import { getTranslations } from "~/i18n";
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

  const localeSettings = await getLocaleSettings(session.shop);
  const locale = localeSettings?.locale || "en";
  const t = getTranslations(locale);

  return json({ shopId: shop.id, t });
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
  const { shopId, t } = useLoaderData<typeof loader>();
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
      return `${discountValue}% = $${(samplePrice * parseFloat(discountValue) / 100).toFixed(2)} ${t.bundlesPage.off} $${samplePrice}`;
    }
    return `$${discountValue} ${t.bundlesPage.off}`;
  };

  return (
    <Page
      title={t.bundlesPage.createProductBundle}
      backAction={{ content: t.bundlesPage.bundles, url: "/app/bundles" }}
    >
      <BlockStack gap="500">
        <Banner tone="info">
          <p>
            {t.bundlesPage.bannerInfo}
          </p>
        </Banner>

        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">
              {t.bundlesPage.bundleDetails}
            </Text>
            <FormLayout>
              <TextField
                label={t.bundlesPage.bundleName}
                value={name}
                onChange={setName}
                placeholder={t.bundlesPage.bundleNamePlaceholder}
                helpText={t.bundlesPage.bundleNameHelp}
                autoComplete="off"
              />

              <TextField
                label={t.bundlesPage.descriptionOptional}
                value={description}
                onChange={setDescription}
                placeholder={t.bundlesPage.descriptionPlaceholder}
                multiline={2}
                autoComplete="off"
              />
            </FormLayout>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">
              {t.bundlesPage.discount}
            </Text>
            <FormLayout>
              <FormLayout.Group>
                <Select
                  label={t.bundlesPage.discountType}
                  options={[
                    { label: t.bundlesPage.percentageOff, value: "PERCENTAGE" },
                    { label: t.bundlesPage.fixedAmountOff, value: "FIXED_AMOUNT" },
                  ]}
                  value={discountType}
                  onChange={(v) => setDiscountType(v as DiscountType)}
                />
                <TextField
                  type="number"
                  label={discountType === "PERCENTAGE" ? t.bundlesPage.percentage : t.bundlesPage.amount}
                  value={discountValue}
                  onChange={setDiscountValue}
                  suffix={discountType === "PERCENTAGE" ? "%" : ""}
                  prefix={discountType === "FIXED_AMOUNT" ? "$" : ""}
                  autoComplete="off"
                />
              </FormLayout.Group>

              <Select
                label={t.bundlesPage.bundleType}
                options={[
                  { label: t.bundlesPage.mustBuyAllProducts, value: "true" },
                  { label: t.bundlesPage.mixMatchAny, value: "false" },
                ]}
                value={requireAll.toString()}
                onChange={(v) => setRequireAll(v === "true")}
                helpText={
                  requireAll
                    ? t.bundlesPage.mustBuyAllHelp
                    : t.bundlesPage.mixMatchHelp
                }
              />
            </FormLayout>

            <Box padding="300" background="bg-surface-secondary" borderRadius="200">
              <Text variant="bodySm" as="p">
                {t.bundlesPage.exampleSavings}: {calculateSavings()}
              </Text>
            </Box>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">
              {t.bundlesPage.productsInBundle} ({products.length})
            </Text>

            {products.length < 2 && (
              <Banner tone="warning">
                {t.bundlesPage.addAtLeast2}
              </Banner>
            )}

            {/* Add Product Input */}
            <InlineStack gap="200" align="end">
              <Box minWidth="300px">
                <TextField
                  label={t.bundlesPage.addProduct}
                  labelHidden
                  value={productInput}
                  onChange={setProductInput}
                  placeholder={t.bundlesPage.enterProductName}
                  autoComplete="off"
                  connectedRight={
                    <Button onClick={handleAddProduct}>{t.bundlesPage.add}</Button>
                  }
                />
              </Box>
            </InlineStack>

            <Text variant="bodySm" tone="subdued" as="p">
              {t.bundlesPage.productPickerNote}
            </Text>

            <Divider />

            {/* Product List */}
            {products.length > 0 ? (
              <ResourceList
                resourceName={{ singular: t.bundlesPage.bundle, plural: t.bundlesPage.products }}
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
                    accessibilityLabel={`View ${product.title}`}
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
                        accessibilityLabel={`${t.bundlesPage.delete} ${product.title}`}
                      />
                    </InlineStack>
                  </ResourceItem>
                )}
              />
            ) : (
              <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                <Text as="p" alignment="center" tone="subdued">
                  {t.bundlesPage.noProductsYet}
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
                {t.bundlesPage.bundlePreview}
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
                    {name || t.bundlesPage.bundleName}
                  </Text>
                  <Text variant="bodySm" tone="subdued" as="p">
                    {products.map((p) => p.title).join(" + ")}
                  </Text>
                  <Badge tone="success">
                    {discountType === "PERCENTAGE"
                      ? `${discountValue}% ${t.bundlesPage.off}`
                      : `$${discountValue} ${t.bundlesPage.off}`}
                  </Badge>
                </BlockStack>
              </Box>
            </BlockStack>
          </Card>
        )}

        <InlineStack align="end" gap="200">
          <Button url="/app/bundles">{t.bundlesPage.cancel}</Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={isLoading}
            disabled={!name || !discountValue || products.length < 2}
          >
            {t.bundlesPage.createBundle}
          </Button>
        </InlineStack>
      </BlockStack>
    </Page>
  );
}
