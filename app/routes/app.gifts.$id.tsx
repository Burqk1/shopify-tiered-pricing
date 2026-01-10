/**
 * Edit Gift with Purchase Route
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useNavigate, useSubmit, useNavigation } from "@remix-run/react";
import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  TextField,
  Select,
  Checkbox,
  Banner,
  Layout,
  FormLayout,
  Divider,
  Box,
  ProgressBar,
  Badge,
  Modal,
} from "@shopify/polaris";
import { useState, useCallback } from "react";

import { authenticate } from "~/shopify.server";
import { getShopByDomain, getLocaleSettings } from "~/models/shop.server";
import { getGiftWithPurchase, updateGiftWithPurchase, deleteGiftWithPurchase, updateGiftStatus } from "~/models/gift-with-purchase.server";
import { getTranslations } from "~/i18n";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { id } = params;

  if (!id) {
    throw new Response("Gift ID required", { status: 400 });
  }

  const shop = await getShopByDomain(session.shop);
  if (!shop) {
    throw new Response("Shop not found", { status: 404 });
  }

  const gift = await getGiftWithPurchase(id);
  if (!gift || gift.shopId !== shop.id) {
    throw new Response("Gift not found", { status: 404 });
  }

  const localeSettings = await getLocaleSettings(session.shop);
  const locale = localeSettings?.locale || "en";
  const t = getTranslations(locale);

  return json({
    gift,
    shopId: shop.id,
    currency: shop.currencySymbol || "$",
    t,
  });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { id } = params;

  if (!id) {
    return json({ error: "Gift ID required" }, { status: 400 });
  }

  const shop = await getShopByDomain(session.shop);
  if (!shop) {
    return json({ error: "Shop not found" }, { status: 404 });
  }

  const gift = await getGiftWithPurchase(id);
  if (!gift || gift.shopId !== shop.id) {
    return json({ error: "Gift not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const action = formData.get("_action");

  try {
    if (action === "delete") {
      await deleteGiftWithPurchase(id);
      return redirect("/app/gifts");
    }

    if (action === "toggle_status") {
      const newStatus = gift.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
      await updateGiftStatus(id, newStatus);
      return json({ success: true });
    }

    // Update gift
    const data = Object.fromEntries(formData);

    await updateGiftWithPurchase(id, {
      name: data.name as string,
      triggerType: data.triggerType as any,
      triggerValue: parseFloat(data.triggerValue as string),
      giftProductId: data.giftProductId as string || gift.giftProductId,
      giftTitle: data.giftTitle as string || undefined,
      giftQuantity: parseInt(data.giftQuantity as string) || 1,
      giftDiscountPercent: parseFloat(data.giftDiscountPercent as string) || 100,
      showProgressBar: data.showProgressBar === "true",
      progressMessage: data.progressMessage as string,
      claimedMessage: data.claimedMessage as string,
      maxPerOrder: parseInt(data.maxPerOrder as string) || 1,
      maxTotal: data.maxTotal ? parseInt(data.maxTotal as string) : null,
      autoAddToCart: data.autoAddToCart === "true",
      newCustomersOnly: data.newCustomersOnly === "true",
      startDate: data.startDate ? new Date(data.startDate as string) : null,
      endDate: data.endDate ? new Date(data.endDate as string) : null,
    });

    const status = data.status as string;
    if (status && status !== gift.status) {
      await updateGiftStatus(id, status as any);
    }

    return redirect("/app/gifts");
  } catch (error) {
    console.error("Failed to update gift:", error);
    return json({ error: "Failed to update gift offer" }, { status: 500 });
  }
};

export default function EditGift() {
  const { gift, shopId, currency, t } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  // Form state - initialized from gift
  const [name, setName] = useState(gift.name);
  const [triggerType, setTriggerType] = useState(gift.triggerType);
  const [triggerValue, setTriggerValue] = useState(String(gift.triggerValue));
  const [giftProductId, setGiftProductId] = useState(gift.giftProductId || "");
  const [giftTitle, setGiftTitle] = useState(gift.giftTitle || "Free Gift");
  const [giftQuantity, setGiftQuantity] = useState(String(gift.giftQuantity));
  const [giftDiscountPercent, setGiftDiscountPercent] = useState(String(gift.giftDiscountPercent));
  const [showProgressBar, setShowProgressBar] = useState(gift.showProgressBar);
  const [progressMessage, setProgressMessage] = useState(gift.progressMessage || "Spend {amount} more to get a FREE gift!");
  const [claimedMessage, setClaimedMessage] = useState(gift.claimedMessage || "🎉 FREE Gift Added to Cart!");
  const [maxPerOrder, setMaxPerOrder] = useState(String(gift.maxPerOrder));
  const [maxTotal, setMaxTotal] = useState(gift.maxTotal ? String(gift.maxTotal) : "");
  const [autoAddToCart, setAutoAddToCart] = useState(gift.autoAddToCart);
  const [newCustomersOnly, setNewCustomersOnly] = useState(gift.newCustomersOnly);
  const [useScheduling, setUseScheduling] = useState(!!(gift.startDate || gift.endDate));
  const [startDate, setStartDate] = useState(gift.startDate ? new Date(gift.startDate).toISOString().slice(0, 16) : "");
  const [endDate, setEndDate] = useState(gift.endDate ? new Date(gift.endDate).toISOString().slice(0, 16) : "");
  const [error, setError] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleSubmit = useCallback(
    (status?: string) => {
      if (!name.trim()) {
        setError("Please enter an offer name");
        return;
      }
      if (!triggerValue || parseFloat(triggerValue) <= 0) {
        setError("Please enter a valid trigger value");
        return;
      }

      const formData = new FormData();
      formData.append("name", name);
      formData.append("triggerType", triggerType);
      formData.append("triggerValue", triggerValue);
      formData.append("giftProductId", giftProductId);
      formData.append("giftTitle", giftTitle);
      formData.append("giftQuantity", giftQuantity);
      formData.append("giftDiscountPercent", giftDiscountPercent);
      formData.append("showProgressBar", showProgressBar.toString());
      formData.append("progressMessage", progressMessage);
      formData.append("claimedMessage", claimedMessage);
      formData.append("maxPerOrder", maxPerOrder);
      formData.append("maxTotal", maxTotal);
      formData.append("autoAddToCart", autoAddToCart.toString());
      formData.append("newCustomersOnly", newCustomersOnly.toString());

      if (status) {
        formData.append("status", status);
      }

      if (useScheduling) {
        if (startDate) formData.append("startDate", startDate);
        if (endDate) formData.append("endDate", endDate);
      }

      submit(formData, { method: "POST" });
    },
    [name, triggerType, triggerValue, giftProductId, giftTitle, giftQuantity, giftDiscountPercent, showProgressBar, progressMessage, claimedMessage, maxPerOrder, maxTotal, autoAddToCart, newCustomersOnly, useScheduling, startDate, endDate, submit]
  );

  const handleDelete = useCallback(() => {
    const formData = new FormData();
    formData.append("_action", "delete");
    submit(formData, { method: "POST" });
  }, [submit]);

  const handleToggleStatus = useCallback(() => {
    const formData = new FormData();
    formData.append("_action", "toggle_status");
    submit(formData, { method: "POST" });
  }, [submit]);

  const triggerTypeOptions = [
    { label: "Minimum Spend", value: "MIN_SPEND" },
    { label: "Minimum Quantity", value: "MIN_QUANTITY" },
    { label: "Specific Product", value: "SPECIFIC_PRODUCT" },
    { label: "From Collection", value: "SPECIFIC_COLLECTION" },
  ];

  // Preview progress
  const previewProgress = 60;
  const threshold = parseFloat(triggerValue) || 100;
  const remaining = threshold * (1 - previewProgress / 100);

  const getStatusBadge = () => {
    switch (gift.status) {
      case "ACTIVE":
        return <Badge tone="success">Active</Badge>;
      case "PAUSED":
        return <Badge tone="warning">Paused</Badge>;
      case "DRAFT":
        return <Badge>Draft</Badge>;
      default:
        return <Badge>{gift.status}</Badge>;
    }
  };

  return (
    <Page
      title={`Edit: ${gift.name}`}
      titleMetadata={getStatusBadge()}
      backAction={{ content: "Gifts", url: "/app/gifts" }}
      secondaryActions={[
        {
          content: gift.status === "ACTIVE" ? "Pause" : "Activate",
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
        {error && (
          <Banner tone="critical" onDismiss={() => setError("")}>
            {error}
          </Banner>
        )}

        {/* Stats */}
        <Card>
          <InlineStack gap="800" align="center">
            <BlockStack gap="100">
              <Text variant="headingXl" as="p">{gift.givenCount}</Text>
              <Text variant="bodySm" tone="subdued" as="p">Gifts Given</Text>
            </BlockStack>
            {gift.maxTotal && (
              <BlockStack gap="100">
                <Text variant="headingXl" as="p">{gift.maxTotal - gift.givenCount}</Text>
                <Text variant="bodySm" tone="subdued" as="p">Remaining</Text>
              </BlockStack>
            )}
          </InlineStack>
        </Card>

        {/* Preview */}
        <Card>
          <BlockStack gap="300">
            <Text variant="headingSm" as="h3">Customer Preview</Text>
            <Box padding="400" background="bg-surface-success" borderRadius="200">
              <BlockStack gap="200">
                <Text variant="headingMd" as="p" alignment="center">
                  🎁 {progressMessage.replace("{amount}", `${currency}${remaining.toFixed(0)}`)}
                </Text>
                {showProgressBar && (
                  <>
                    <ProgressBar progress={previewProgress} size="small" tone="success" />
                    <Text variant="bodySm" tone="subdued" as="p" alignment="center">
                      {previewProgress}% complete
                    </Text>
                  </>
                )}
              </BlockStack>
            </Box>
          </BlockStack>
        </Card>

        <Layout>
          <Layout.Section>
            {/* Basic Info */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingSm" as="h3">Basic Information</Text>
                <FormLayout>
                  <TextField
                    label="Offer Name"
                    value={name}
                    onChange={setName}
                    placeholder="e.g., Free Tote Bag with $100 Purchase"
                    autoComplete="off"
                    helpText="Internal name for this offer"
                  />
                </FormLayout>
              </BlockStack>
            </Card>

            {/* Trigger Settings */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingSm" as="h3">Trigger Condition</Text>
                <FormLayout>
                  <Select
                    label="Trigger Type"
                    options={triggerTypeOptions}
                    value={triggerType}
                    onChange={setTriggerType}
                  />
                  <TextField
                    label={triggerType === "MIN_SPEND" ? `Minimum Spend (${currency})` : "Minimum Quantity"}
                    type="number"
                    value={triggerValue}
                    onChange={setTriggerValue}
                    min={1}
                    autoComplete="off"
                    helpText={triggerType === "MIN_SPEND" ? "Cart total needed to qualify" : "Number of items needed"}
                  />
                </FormLayout>
              </BlockStack>
            </Card>

            {/* Gift Settings */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingSm" as="h3">Gift Product</Text>
                <FormLayout>
                  <TextField
                    label="Gift Title"
                    value={giftTitle}
                    onChange={setGiftTitle}
                    placeholder="Free Gift"
                    autoComplete="off"
                    helpText="Display name for the gift"
                  />
                  <InlineStack gap="400">
                    <TextField
                      label="Quantity"
                      type="number"
                      value={giftQuantity}
                      onChange={setGiftQuantity}
                      min={1}
                      autoComplete="off"
                    />
                    <TextField
                      label="Discount %"
                      type="number"
                      value={giftDiscountPercent}
                      onChange={setGiftDiscountPercent}
                      min={0}
                      max={100}
                      autoComplete="off"
                      helpText="100% = completely free"
                    />
                  </InlineStack>
                  <TextField
                    label="Gift Product ID"
                    value={giftProductId}
                    onChange={setGiftProductId}
                    placeholder="gid://shopify/Product/123456"
                    autoComplete="off"
                  />
                </FormLayout>
              </BlockStack>
            </Card>

            {/* Display Settings */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingSm" as="h3">Display Settings</Text>
                <FormLayout>
                  <Checkbox
                    label="Show progress bar"
                    checked={showProgressBar}
                    onChange={setShowProgressBar}
                    helpText="Display visual progress towards the gift"
                  />
                  <TextField
                    label="Progress Message"
                    value={progressMessage}
                    onChange={setProgressMessage}
                    autoComplete="off"
                    helpText="Use {amount} for remaining amount"
                  />
                  <TextField
                    label="Claimed Message"
                    value={claimedMessage}
                    onChange={setClaimedMessage}
                    autoComplete="off"
                    helpText="Shown when gift is added"
                  />
                </FormLayout>
              </BlockStack>
            </Card>

            {/* Limits & Options */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingSm" as="h3">Limits & Options</Text>
                <FormLayout>
                  <InlineStack gap="400">
                    <TextField
                      label="Max Per Order"
                      type="number"
                      value={maxPerOrder}
                      onChange={setMaxPerOrder}
                      min={1}
                      autoComplete="off"
                    />
                    <TextField
                      label="Max Total Gifts"
                      type="number"
                      value={maxTotal}
                      onChange={setMaxTotal}
                      placeholder="Unlimited"
                      autoComplete="off"
                      helpText="Leave empty for unlimited"
                    />
                  </InlineStack>
                  <Checkbox
                    label="Auto-add gift to cart"
                    checked={autoAddToCart}
                    onChange={setAutoAddToCart}
                    helpText="Automatically add gift when threshold is met"
                  />
                  <Checkbox
                    label="New customers only"
                    checked={newCustomersOnly}
                    onChange={setNewCustomersOnly}
                    helpText="Only offer to first-time buyers"
                  />
                </FormLayout>
              </BlockStack>
            </Card>

            {/* Scheduling */}
            <Card>
              <BlockStack gap="400">
                <Checkbox
                  label="Schedule this offer"
                  checked={useScheduling}
                  onChange={setUseScheduling}
                />
                {useScheduling && (
                  <FormLayout>
                    <InlineStack gap="400">
                      <TextField
                        label="Start Date"
                        type="datetime-local"
                        value={startDate}
                        onChange={setStartDate}
                        autoComplete="off"
                      />
                      <TextField
                        label="End Date"
                        type="datetime-local"
                        value={endDate}
                        onChange={setEndDate}
                        autoComplete="off"
                      />
                    </InlineStack>
                  </FormLayout>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            {/* Actions */}
            <Card>
              <BlockStack gap="300">
                <Button
                  variant="primary"
                  size="large"
                  fullWidth
                  onClick={() => handleSubmit()}
                  loading={isSubmitting}
                >
                  Save Changes
                </Button>
                {gift.status === "DRAFT" && (
                  <Button
                    fullWidth
                    onClick={() => handleSubmit("ACTIVE")}
                    loading={isSubmitting}
                  >
                    Save & Activate
                  </Button>
                )}
                <Button
                  fullWidth
                  variant="plain"
                  onClick={() => navigate("/app/gifts")}
                >
                  Cancel
                </Button>
              </BlockStack>
            </Card>

            {/* Info Card */}
            <Card>
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">Gift Info</Text>
                <Text variant="bodySm" tone="subdued" as="p">
                  Created: {new Date(gift.createdAt).toLocaleDateString()}
                </Text>
                <Text variant="bodySm" tone="subdued" as="p">
                  Updated: {new Date(gift.updatedAt).toLocaleDateString()}
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>

      {/* Delete Confirmation Modal */}
      <Modal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Gift Offer"
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
            Are you sure you want to delete "{gift.name}"? This action cannot be undone.
          </Text>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
