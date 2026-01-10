/**
 * Edit Bundle Route
 */

import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation, useNavigate } from "@remix-run/react";
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
  Modal,
} from "@shopify/polaris";
import { ImageIcon, DeleteIcon } from "@shopify/polaris-icons";
import { useState, useCallback } from "react";

import { authenticate } from "~/shopify.server";
import { getShopByDomain, getLocaleSettings } from "~/models/shop.server";
import { getBundleById, updateBundle, updateBundleStatus, deleteBundle, addProductToBundle, removeProductFromBundle } from "~/models/bundle.server";
import { getTranslations } from "~/i18n";
import type { DiscountType } from "@prisma/client";

interface SelectedProduct {
  id: string;
  bundleProductId?: string;
  productId: string;
  title: string;
  image?: string;
  variantId?: string;
  variantTitle?: string;
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { id } = params;

  if (!id) {
    throw new Response("Bundle ID required", { status: 400 });
  }

  const shop = await getShopByDomain(session.shop);
  if (!shop) {
    throw new Response("Shop not found", { status: 404 });
  }

  const bundle = await getBundleById(id);
  if (!bundle || bundle.shopId !== shop.id) {
    throw new Response("Bundle not found", { status: 404 });
  }

  const localeSettings = await getLocaleSettings(session.shop);
  const locale = localeSettings?.locale || "en";
  const t = getTranslations(locale);

  return json({ bundle, shopId: shop.id, t });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { id } = params;

  if (!id) {
    return json({ error: "Bundle ID required" }, { status: 400 });
  }

  const shop = await getShopByDomain(session.shop);
  if (!shop) {
    return json({ error: "Shop not found" }, { status: 404 });
  }

  const bundle = await getBundleById(id);
  if (!bundle || bundle.shopId !== shop.id) {
    return json({ error: "Bundle not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const action = formData.get("_action");

  try {
    if (action === "delete") {
      await deleteBundle(id);
      return redirect("/app/bundles");
    }

    if (action === "toggle_status") {
      const newStatus = bundle.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
      await updateBundleStatus(id, newStatus);
      return json({ success: true });
    }

    if (action === "add_product") {
      const productId = formData.get("productId") as string;
      const productTitle = formData.get("productTitle") as string;
      await addProductToBundle(id, productId, undefined, productTitle, 1);
      return json({ success: true });
    }

    if (action === "remove_product") {
      const bundleProductId = formData.get("bundleProductId") as string;
      await removeProductFromBundle(bundleProductId);
      return json({ success: true });
    }

    // Update bundle
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const discountType = formData.get("discountType") as DiscountType;
    const discountValue = parseFloat(formData.get("discountValue") as string);
    const requireAll = formData.get("requireAll") === "true";

    if (!name || !discountValue) {
      return json({ error: "Name and discount are required" }, { status: 400 });
    }

    await updateBundle(id, {
      name,
      description: description || undefined,
      discountType,
      discountValue,
      requireAll,
    });

    const status = formData.get("status") as string;
    if (status && status !== bundle.status) {
      await updateBundleStatus(id, status as any);
    }

    return redirect("/app/bundles");
  } catch (error) {
    return json({ error: "Failed to update bundle" }, { status: 500 });
  }
};

export default function EditBundle() {
  const { bundle, shopId, t } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const navigate = useNavigate();

  const [name, setName] = useState(bundle.name);
  const [description, setDescription] = useState(bundle.description || "");
  const [discountType, setDiscountType] = useState<DiscountType>(bundle.discountType);
  const [discountValue, setDiscountValue] = useState(String(bundle.discountValue));
  const [requireAll, setRequireAll] = useState(bundle.requireAll);
  const [productInput, setProductInput] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const isLoading = navigation.state === "submitting";

  const products: SelectedProduct[] = bundle.products.map((p) => ({
    id: p.productId,
    bundleProductId: p.id,
    productId: p.productId,
    title: p.productTitle || p.productId,
    variantId: p.variantId || undefined,
  }));

  const handleAddProduct = useCallback(() => {
    if (!productInput.trim()) return;

    const formData = new FormData();
    formData.append("_action", "add_product");
    formData.append("productId", `gid://shopify/Product/${Date.now()}`);
    formData.append("productTitle", productInput);
    submit(formData, { method: "POST" });
    setProductInput("");
  }, [productInput, submit]);

  const handleRemoveProduct = useCallback((bundleProductId: string) => {
    const formData = new FormData();
    formData.append("_action", "remove_product");
    formData.append("bundleProductId", bundleProductId);
    submit(formData, { method: "POST" });
  }, [submit]);

  const handleToggleStatus = useCallback(() => {
    const formData = new FormData();
    formData.append("_action", "toggle_status");
    submit(formData, { method: "POST" });
  }, [submit]);

  const handleDelete = useCallback(() => {
    const formData = new FormData();
    formData.append("_action", "delete");
    submit(formData, { method: "POST" });
  }, [submit]);

  const handleSubmit = useCallback(() => {
    const formData = new FormData();
    formData.append("name", name);
    formData.append("description", description);
    formData.append("discountType", discountType);
    formData.append("discountValue", discountValue);
    formData.append("requireAll", requireAll.toString());
    submit(formData, { method: "POST" });
  }, [name, description, discountType, discountValue, requireAll, submit]);

  const calculateSavings = () => {
    const samplePrice = 100;
    if (discountType === "PERCENTAGE") {
      return `${discountValue}% = $${(samplePrice * parseFloat(discountValue) / 100).toFixed(2)} ${t.bundlesPage.off} $${samplePrice}`;
    }
    return `$${discountValue} ${t.bundlesPage.off}`;
  };

  const getStatusBadge = () => {
    switch (bundle.status) {
      case "ACTIVE":
        return <Badge tone="success">Active</Badge>;
      case "PAUSED":
        return <Badge tone="warning">Paused</Badge>;
      case "DRAFT":
        return <Badge>Draft</Badge>;
      default:
        return <Badge>{bundle.status}</Badge>;
    }
  };

  return (
    <Page
      title={`Edit: ${bundle.name}`}
      titleMetadata={getStatusBadge()}
      backAction={{ content: t.bundlesPage.bundles, url: "/app/bundles" }}
      secondaryActions={[
        {
          content: bundle.status === "ACTIVE" ? "Pause" : "Activate",
          onAction: handleToggleStatus,
        },
        {
          content: "Delete",
          destructive: true,
          onAction: () => setShowDeleteModal(true),
        },
      ]}
    >
      <BlockStack gap="500">
        {/* Stats */}
        <Card>
          <InlineStack gap="800" align="center">
            <BlockStack gap="100">
              <Text variant="headingXl" as="p">{bundle.usesCount}</Text>
              <Text variant="bodySm" tone="subdued" as="p">Times Used</Text>
            </BlockStack>
            <BlockStack gap="100">
              <Text variant="headingXl" as="p">${Number(bundle.totalDiscountGiven).toFixed(2)}</Text>
              <Text variant="bodySm" tone="subdued" as="p">Total Discounted</Text>
            </BlockStack>
          </InlineStack>
        </Card>

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
                        onClick={() => product.bundleProductId && handleRemoveProduct(product.bundleProductId)}
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

        {/* Info Card */}
        <Card>
          <BlockStack gap="200">
            <Text variant="headingSm" as="h3">Bundle Info</Text>
            <Text variant="bodySm" tone="subdued" as="p">
              Created: {new Date(bundle.createdAt).toLocaleDateString()}
            </Text>
            <Text variant="bodySm" tone="subdued" as="p">
              Updated: {new Date(bundle.updatedAt).toLocaleDateString()}
            </Text>
          </BlockStack>
        </Card>

        <InlineStack align="end" gap="200">
          <Button url="/app/bundles">{t.bundlesPage.cancel}</Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={isLoading}
            disabled={!name || !discountValue || products.length < 2}
          >
            Save Changes
          </Button>
        </InlineStack>
      </BlockStack>

      {/* Delete Confirmation Modal */}
      <Modal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Bundle"
        primaryAction={{
          content: "Delete",
          destructive: true,
          onAction: handleDelete,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => setShowDeleteModal(false),
          },
        ]}
      >
        <Modal.Section>
          <Text as="p">
            Are you sure you want to delete "{bundle.name}"? This action cannot be undone.
          </Text>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
