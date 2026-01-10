/**
 * Edit Cart Progress Bar Route
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
  RangeSlider,
  Badge,
  Modal,
} from "@shopify/polaris";
import { useState, useCallback } from "react";

import { authenticate } from "~/shopify.server";
import { getShopByDomain, getLocaleSettings } from "~/models/shop.server";
import { getProgressBar, updateProgressBar, deleteProgressBar, updateProgressBarStatus } from "~/models/cart-progress.server";
import { getTranslations } from "~/i18n";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { id } = params;

  if (!id) {
    throw new Response("Progress bar ID required", { status: 400 });
  }

  const shop = await getShopByDomain(session.shop);
  if (!shop) {
    throw new Response("Shop not found", { status: 404 });
  }

  const bar = await getProgressBar(id);
  if (!bar || bar.shopId !== shop.id) {
    throw new Response("Progress bar not found", { status: 404 });
  }

  const localeSettings = await getLocaleSettings(session.shop);
  const locale = localeSettings?.locale || "en";
  const t = getTranslations(locale);

  return json({
    bar,
    shopId: shop.id,
    currency: shop.currencySymbol || "$",
    t,
  });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { id } = params;

  if (!id) {
    return json({ error: "Progress bar ID required" }, { status: 400 });
  }

  const shop = await getShopByDomain(session.shop);
  if (!shop) {
    return json({ error: "Shop not found" }, { status: 404 });
  }

  const bar = await getProgressBar(id);
  if (!bar || bar.shopId !== shop.id) {
    return json({ error: "Progress bar not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const action = formData.get("_action");

  try {
    if (action === "delete") {
      await deleteProgressBar(id);
      return redirect("/app/cart-progress");
    }

    if (action === "toggle_status") {
      const newStatus = bar.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
      await updateProgressBarStatus(id, newStatus);
      return json({ success: true });
    }

    // Update progress bar
    const data = Object.fromEntries(formData);

    await updateProgressBar(id, {
      name: data.name as string,
      progressType: data.progressType as any,
      threshold: parseFloat(data.threshold as string),
      rewardType: data.rewardType as any,
      rewardValue: data.rewardValue ? parseFloat(data.rewardValue as string) : undefined,
      barStyle: data.barStyle as string,
      barColor: data.barColor as string,
      bgColor: data.bgColor as string,
      textColor: data.textColor as string,
      emptyMessage: data.emptyMessage as string,
      progressMessage: data.progressMessage as string,
      completeMessage: data.completeMessage as string,
      showOn: data.showOn as any,
      startDate: data.startDate ? new Date(data.startDate as string) : null,
      endDate: data.endDate ? new Date(data.endDate as string) : null,
    });

    const status = data.status as string;
    if (status && status !== bar.status) {
      await updateProgressBarStatus(id, status as any);
    }

    return redirect("/app/cart-progress");
  } catch (error) {
    return json({ error: "Failed to update progress bar" }, { status: 500 });
  }
};

export default function EditCartProgress() {
  const { bar, shopId, currency, t } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  // Form state - initialized from bar
  const [name, setName] = useState(bar.name);
  const [progressType, setProgressType] = useState(bar.progressType);
  const [threshold, setThreshold] = useState(String(bar.threshold));
  const [rewardType, setRewardType] = useState(bar.rewardType);
  const [rewardValue, setRewardValue] = useState(bar.rewardValue ? String(bar.rewardValue) : "");
  const [barStyle, setBarStyle] = useState(bar.barStyle || "default");
  const [barColor, setBarColor] = useState(bar.barColor || "#4CAF50");
  const [bgColor, setBgColor] = useState(bar.bgColor || "#e0e0e0");
  const [textColor, setTextColor] = useState(bar.textColor || "#333333");
  const [emptyMessage, setEmptyMessage] = useState(bar.emptyMessage || "Add {amount} to get free shipping!");
  const [progressMessage, setProgressMessage] = useState(bar.progressMessage || "Only {amount} away from free shipping!");
  const [completeMessage, setCompleteMessage] = useState(bar.completeMessage || "🎉 You've unlocked free shipping!");
  const [showOn, setShowOn] = useState(bar.showOn);
  const [useScheduling, setUseScheduling] = useState(!!(bar.startDate || bar.endDate));
  const [startDate, setStartDate] = useState(bar.startDate ? new Date(bar.startDate).toISOString().slice(0, 16) : "");
  const [endDate, setEndDate] = useState(bar.endDate ? new Date(bar.endDate).toISOString().slice(0, 16) : "");
  const [error, setError] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Preview state
  const [previewProgress, setPreviewProgress] = useState(50);

  const handleSubmit = useCallback(
    (status?: string) => {
      if (!name.trim()) {
        setError("Please enter a name");
        return;
      }
      if (!threshold || parseFloat(threshold) <= 0) {
        setError("Please enter a valid threshold");
        return;
      }

      const formData = new FormData();
      formData.append("name", name);
      formData.append("progressType", progressType);
      formData.append("threshold", threshold);
      formData.append("rewardType", rewardType);
      formData.append("rewardValue", rewardValue);
      formData.append("barStyle", barStyle);
      formData.append("barColor", barColor);
      formData.append("bgColor", bgColor);
      formData.append("textColor", textColor);
      formData.append("emptyMessage", emptyMessage);
      formData.append("progressMessage", progressMessage);
      formData.append("completeMessage", completeMessage);
      formData.append("showOn", showOn);

      if (status) {
        formData.append("status", status);
      }

      if (useScheduling) {
        if (startDate) formData.append("startDate", startDate);
        if (endDate) formData.append("endDate", endDate);
      }

      submit(formData, { method: "POST" });
    },
    [name, progressType, threshold, rewardType, rewardValue, barStyle, barColor, bgColor, textColor, emptyMessage, progressMessage, completeMessage, showOn, useScheduling, startDate, endDate, submit]
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

  const progressTypeOptions = [
    { label: "Free Shipping", value: "FREE_SHIPPING" },
    { label: "Discount Unlock", value: "DISCOUNT_UNLOCK" },
    { label: "Free Gift", value: "FREE_GIFT" },
    { label: "Tiered Progress", value: "TIERED_PROGRESS" },
  ];

  const rewardTypeOptions = [
    { label: "Free Shipping", value: "FREE_SHIPPING" },
    { label: "Percentage Discount", value: "PERCENTAGE_DISCOUNT" },
    { label: "Fixed Discount", value: "FIXED_DISCOUNT" },
    { label: "Free Gift", value: "FREE_GIFT" },
  ];

  const barStyleOptions = [
    { label: "Default", value: "default" },
    { label: "Minimal", value: "minimal" },
    { label: "Gradient", value: "gradient" },
    { label: "Animated", value: "animated" },
  ];

  const showOnOptions = [
    { label: "Cart Page", value: "CART_PAGE" },
    { label: "Cart Drawer", value: "CART_DRAWER" },
    { label: "Product Pages", value: "PRODUCT_PAGES" },
    { label: "All Pages", value: "ALL_PAGES" },
    { label: "Announcement Bar", value: "ANNOUNCEMENT_BAR" },
  ];

  // Get preview message
  const getPreviewMessage = () => {
    const thresholdNum = parseFloat(threshold) || 50;
    const remaining = thresholdNum * (1 - previewProgress / 100);

    if (previewProgress >= 100) {
      return completeMessage;
    }
    if (previewProgress === 0) {
      return emptyMessage.replace("{amount}", `${currency}${thresholdNum.toFixed(2)}`);
    }
    return progressMessage.replace("{amount}", `${currency}${remaining.toFixed(2)}`);
  };

  const getStatusBadge = () => {
    switch (bar.status) {
      case "ACTIVE":
        return <Badge tone="success">Active</Badge>;
      case "PAUSED":
        return <Badge tone="warning">Paused</Badge>;
      case "DRAFT":
        return <Badge>Draft</Badge>;
      default:
        return <Badge>{bar.status}</Badge>;
    }
  };

  return (
    <Page
      title={`Edit: ${bar.name}`}
      titleMetadata={getStatusBadge()}
      backAction={{ content: "Cart Progress", url: "/app/cart-progress" }}
      secondaryActions={[
        {
          content: bar.status === "ACTIVE" ? "Pause" : "Activate",
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
              <Text variant="headingXl" as="p">{bar.impressions}</Text>
              <Text variant="bodySm" tone="subdued" as="p">Impressions</Text>
            </BlockStack>
            <BlockStack gap="100">
              <Text variant="headingXl" as="p">{bar.completions}</Text>
              <Text variant="bodySm" tone="subdued" as="p">Completions</Text>
            </BlockStack>
            <BlockStack gap="100">
              <Text variant="headingXl" as="p">{currency}{Number(bar.revenueGenerated).toFixed(2)}</Text>
              <Text variant="bodySm" tone="subdued" as="p">Revenue Generated</Text>
            </BlockStack>
            <BlockStack gap="100">
              <Text variant="headingXl" as="p">
                {bar.impressions > 0 ? ((bar.completions / bar.impressions) * 100).toFixed(1) : 0}%
              </Text>
              <Text variant="bodySm" tone="subdued" as="p">Conversion Rate</Text>
            </BlockStack>
          </InlineStack>
        </Card>

        {/* Live Preview */}
        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between">
              <Text variant="headingSm" as="h3">Live Preview</Text>
              <InlineStack gap="200">
                <Button size="slim" onClick={() => setPreviewProgress(0)}>Empty</Button>
                <Button size="slim" onClick={() => setPreviewProgress(50)}>Half</Button>
                <Button size="slim" onClick={() => setPreviewProgress(100)}>Full</Button>
              </InlineStack>
            </InlineStack>

            <Box
              padding="400"
              borderRadius="200"
              background="bg-surface"
              borderWidth="025"
              borderColor="border"
            >
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text variant="bodyMd" as="span" fontWeight="medium">
                    {previewProgress >= 100 ? "🎉" : "🚚"} {getPreviewMessage()}
                  </Text>
                  {previewProgress < 100 && (
                    <Text variant="bodySm" tone="subdued" as="span">
                      {previewProgress}% complete
                    </Text>
                  )}
                </InlineStack>
                <div style={{
                  background: bgColor,
                  borderRadius: "4px",
                  height: "8px",
                  overflow: "hidden"
                }}>
                  <div style={{
                    background: barColor,
                    width: `${previewProgress}%`,
                    height: "100%",
                    transition: "width 0.3s ease",
                  }} />
                </div>
              </BlockStack>
            </Box>

            <RangeSlider
              label="Preview Progress"
              value={previewProgress}
              onChange={(v) => setPreviewProgress(v as number)}
              min={0}
              max={100}
              output
            />
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
                    label="Name"
                    value={name}
                    onChange={setName}
                    placeholder="e.g., Free Shipping Progress"
                    autoComplete="off"
                    helpText="Internal name for this progress bar"
                  />
                  <InlineStack gap="400">
                    <Select
                      label="Progress Type"
                      options={progressTypeOptions}
                      value={progressType}
                      onChange={setProgressType}
                    />
                    <TextField
                      label={`Threshold (${currency})`}
                      type="number"
                      value={threshold}
                      onChange={setThreshold}
                      min={1}
                      autoComplete="off"
                      helpText="Amount needed to complete"
                    />
                  </InlineStack>
                </FormLayout>
              </BlockStack>
            </Card>

            {/* Reward Settings */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingSm" as="h3">Reward Settings</Text>
                <FormLayout>
                  <Select
                    label="Reward Type"
                    options={rewardTypeOptions}
                    value={rewardType}
                    onChange={setRewardType}
                  />
                  {(rewardType === "PERCENTAGE_DISCOUNT" || rewardType === "FIXED_DISCOUNT") && (
                    <TextField
                      label={rewardType === "PERCENTAGE_DISCOUNT" ? "Discount %" : `Discount Amount (${currency})`}
                      type="number"
                      value={rewardValue}
                      onChange={setRewardValue}
                      autoComplete="off"
                    />
                  )}
                </FormLayout>
              </BlockStack>
            </Card>

            {/* Messages */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingSm" as="h3">Messages</Text>
                <Banner tone="info">
                  Use <code>{"{amount}"}</code> as placeholder for the remaining amount.
                </Banner>
                <FormLayout>
                  <TextField
                    label="Empty Cart Message"
                    value={emptyMessage}
                    onChange={setEmptyMessage}
                    autoComplete="off"
                    helpText="Shown when cart is empty"
                  />
                  <TextField
                    label="Progress Message"
                    value={progressMessage}
                    onChange={setProgressMessage}
                    autoComplete="off"
                    helpText="Shown during progress"
                  />
                  <TextField
                    label="Complete Message"
                    value={completeMessage}
                    onChange={setCompleteMessage}
                    autoComplete="off"
                    helpText="Shown when threshold is reached"
                  />
                </FormLayout>
              </BlockStack>
            </Card>

            {/* Display Settings */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingSm" as="h3">Display Settings</Text>
                <FormLayout>
                  <InlineStack gap="400">
                    <Select
                      label="Bar Style"
                      options={barStyleOptions}
                      value={barStyle}
                      onChange={setBarStyle}
                    />
                    <Select
                      label="Show On"
                      options={showOnOptions}
                      value={showOn}
                      onChange={setShowOn}
                    />
                  </InlineStack>
                  <InlineStack gap="400">
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="Bar Color"
                        value={barColor}
                        onChange={setBarColor}
                        autoComplete="off"
                        helpText="Hex color (e.g., #4CAF50)"
                        prefix={<div style={{ width: 16, height: 16, background: barColor, borderRadius: 4 }} />}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="Background Color"
                        value={bgColor}
                        onChange={setBgColor}
                        autoComplete="off"
                        helpText="Hex color"
                        prefix={<div style={{ width: 16, height: 16, background: bgColor, borderRadius: 4 }} />}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="Text Color"
                        value={textColor}
                        onChange={setTextColor}
                        autoComplete="off"
                        helpText="Hex color"
                        prefix={<div style={{ width: 16, height: 16, background: textColor, borderRadius: 4 }} />}
                      />
                    </div>
                  </InlineStack>
                </FormLayout>
              </BlockStack>
            </Card>

            {/* Scheduling */}
            <Card>
              <BlockStack gap="400">
                <Checkbox
                  label="Schedule this progress bar"
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
                {bar.status === "DRAFT" && (
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
                  onClick={() => navigate("/app/cart-progress")}
                >
                  Cancel
                </Button>
              </BlockStack>
            </Card>

            {/* Info Card */}
            <Card>
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">Progress Bar Info</Text>
                <Text variant="bodySm" tone="subdued" as="p">
                  Created: {new Date(bar.createdAt).toLocaleDateString()}
                </Text>
                <Text variant="bodySm" tone="subdued" as="p">
                  Updated: {new Date(bar.updatedAt).toLocaleDateString()}
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
        title="Delete Progress Bar"
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
            Are you sure you want to delete "{bar.name}"? This action cannot be undone.
          </Text>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
