/**
 * Create Cart Progress Bar Route
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
} from "@shopify/polaris";
import { useState, useCallback } from "react";

import { authenticate } from "~/shopify.server";
import { getShopByDomain, getLocaleSettings } from "~/models/shop.server";
import { createProgressBar } from "~/models/cart-progress.server";
import { getTranslations } from "~/i18n";
import { requireFeatureAccess } from "~/utils/plan-guard.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  // Check if user has access (GROWTH+ plan required)
  await requireFeatureAccess(session.shop, "customerTags");

  const shop = await getShopByDomain(session.shop);
  if (!shop) {
    throw new Response("Shop not found", { status: 404 });
  }

  const localeSettings = await getLocaleSettings(session.shop);
  const locale = localeSettings?.locale || "en";
  const t = getTranslations(locale);

  return json({
    shopId: shop.id,
    currency: shop.currencySymbol || "$",
    t,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const shop = await getShopByDomain(session.shop);
  if (!shop) {
    return json({ error: "Shop not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const data = Object.fromEntries(formData);

  try {
    const bar = await createProgressBar({
      shopId: shop.id,
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
      startDate: data.startDate ? new Date(data.startDate as string) : undefined,
      endDate: data.endDate ? new Date(data.endDate as string) : undefined,
    });

    const status = data.status as string;
    if (status === "ACTIVE") {
      const { updateProgressBarStatus } = await import("~/models/cart-progress.server");
      await updateProgressBarStatus(bar.id, "ACTIVE");
    }

    return redirect("/app/cart-progress");
  } catch (error) {
    return json({ error: "Failed to create progress bar" }, { status: 500 });
  }
};

export default function CreateCartProgress() {
  const { shopId, currency, t } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  // Form state
  const [name, setName] = useState("");
  const [progressType, setProgressType] = useState("FREE_SHIPPING");
  const [threshold, setThreshold] = useState("50");
  const [rewardType, setRewardType] = useState("FREE_SHIPPING");
  const [rewardValue, setRewardValue] = useState("");
  const [barStyle, setBarStyle] = useState("default");
  const [barColor, setBarColor] = useState("#4CAF50");
  const [bgColor, setBgColor] = useState("#e0e0e0");
  const [textColor, setTextColor] = useState("#333333");
  const [emptyMessage, setEmptyMessage] = useState("Add {amount} to get free shipping!");
  const [progressMessage, setProgressMessage] = useState("Only {amount} away from free shipping!");
  const [completeMessage, setCompleteMessage] = useState("🎉 You've unlocked free shipping!");
  const [showOn, setShowOn] = useState("CART_PAGE");
  const [useScheduling, setUseScheduling] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState("");

  // Preview state
  const [previewProgress, setPreviewProgress] = useState(50);

  const handleSubmit = useCallback(
    (status: string) => {
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
      formData.append("status", status);

      if (useScheduling) {
        if (startDate) formData.append("startDate", startDate);
        if (endDate) formData.append("endDate", endDate);
      }

      submit(formData, { method: "POST" });
    },
    [name, progressType, threshold, rewardType, rewardValue, barStyle, barColor, bgColor, textColor, emptyMessage, progressMessage, completeMessage, showOn, useScheduling, startDate, endDate, submit]
  );

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

  return (
    <Page
      title="Create Cart Progress Bar"
      backAction={{ content: "Cart Progress", url: "/app/cart-progress" }}
    >
      <BlockStack gap="500">
        {error && (
          <Banner tone="critical" onDismiss={() => setError("")}>
            {error}
          </Banner>
        )}

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
            {/* Tips */}
            <Card>
              <BlockStack gap="300">
                <Text variant="headingSm" as="h3">💡 Best Practices</Text>
                <BlockStack gap="200">
                  <Text variant="bodySm" as="p">
                    <strong>Threshold:</strong> Set slightly above average order value to encourage upsells.
                  </Text>
                  <Text variant="bodySm" as="p">
                    <strong>Messages:</strong> Use urgency words like "Only" and emojis for attention.
                  </Text>
                  <Text variant="bodySm" as="p">
                    <strong>Position:</strong> Cart drawer/page placement has highest conversion.
                  </Text>
                </BlockStack>
                <Divider />
                <Text variant="bodySm" tone="success" as="p">
                  📈 Stores using progress bars see 15-30% increase in AOV!
                </Text>
              </BlockStack>
            </Card>

            {/* Actions */}
            <Card>
              <BlockStack gap="300">
                <Button
                  variant="primary"
                  size="large"
                  fullWidth
                  onClick={() => handleSubmit("ACTIVE")}
                  loading={isSubmitting}
                >
                  Save & Activate
                </Button>
                <Button
                  fullWidth
                  onClick={() => handleSubmit("DRAFT")}
                  loading={isSubmitting}
                >
                  Save as Draft
                </Button>
                <Button
                  fullWidth
                  variant="plain"
                  onClick={() => navigate("/app/cart-progress")}
                >
                  Cancel
                </Button>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
