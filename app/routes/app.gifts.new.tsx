/**
 * Create Gift with Purchase Route
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
} from "@shopify/polaris";
import { useState, useCallback } from "react";

import { authenticate } from "~/shopify.server";
import { getShopByDomain, getLocaleSettings } from "~/models/shop.server";
import { createGiftWithPurchase } from "~/models/gift-with-purchase.server";
import { getTranslations } from "~/i18n";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

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
    const gift = await createGiftWithPurchase({
      shopId: shop.id,
      name: data.name as string,
      triggerType: data.triggerType as any,
      triggerValue: parseFloat(data.triggerValue as string),
      giftProductId: data.giftProductId as string || "placeholder",
      giftTitle: data.giftTitle as string || undefined,
      giftQuantity: parseInt(data.giftQuantity as string) || 1,
      giftDiscountPercent: parseFloat(data.giftDiscountPercent as string) || 100,
      showProgressBar: data.showProgressBar === "true",
      progressMessage: data.progressMessage as string,
      claimedMessage: data.claimedMessage as string,
      maxPerOrder: parseInt(data.maxPerOrder as string) || 1,
      maxTotal: data.maxTotal ? parseInt(data.maxTotal as string) : undefined,
      autoAddToCart: data.autoAddToCart === "true",
      newCustomersOnly: data.newCustomersOnly === "true",
      startDate: data.startDate ? new Date(data.startDate as string) : undefined,
      endDate: data.endDate ? new Date(data.endDate as string) : undefined,
    });

    const status = data.status as string;
    if (status === "ACTIVE") {
      const { updateGiftStatus } = await import("~/models/gift-with-purchase.server");
      await updateGiftStatus(gift.id, "ACTIVE");
    }

    return redirect("/app/gifts");
  } catch (error) {
    console.error("Failed to create gift:", error);
    return json({ error: "Failed to create gift offer" }, { status: 500 });
  }
};

export default function CreateGift() {
  const { shopId, currency, t } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  // Form state
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState("MIN_SPEND");
  const [triggerValue, setTriggerValue] = useState("100");
  const [giftProductId, setGiftProductId] = useState("");
  const [giftTitle, setGiftTitle] = useState("Free Gift");
  const [giftQuantity, setGiftQuantity] = useState("1");
  const [giftDiscountPercent, setGiftDiscountPercent] = useState("100");
  const [showProgressBar, setShowProgressBar] = useState(true);
  const [progressMessage, setProgressMessage] = useState("Spend {amount} more to get a FREE gift!");
  const [claimedMessage, setClaimedMessage] = useState("🎉 FREE Gift Added to Cart!");
  const [maxPerOrder, setMaxPerOrder] = useState("1");
  const [maxTotal, setMaxTotal] = useState("");
  const [autoAddToCart, setAutoAddToCart] = useState(true);
  const [newCustomersOnly, setNewCustomersOnly] = useState(false);
  const [useScheduling, setUseScheduling] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = useCallback(
    (status: string) => {
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
      formData.append("status", status);

      if (useScheduling) {
        if (startDate) formData.append("startDate", startDate);
        if (endDate) formData.append("endDate", endDate);
      }

      submit(formData, { method: "POST" });
    },
    [name, triggerType, triggerValue, giftProductId, giftTitle, giftQuantity, giftDiscountPercent, showProgressBar, progressMessage, claimedMessage, maxPerOrder, maxTotal, autoAddToCart, newCustomersOnly, useScheduling, startDate, endDate, submit]
  );

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

  return (
    <Page
      title="Create Gift with Purchase"
      backAction={{ content: "Gifts", url: "/app/gifts" }}
    >
      <BlockStack gap="500">
        {error && (
          <Banner tone="critical" onDismiss={() => setError("")}>
            {error}
          </Banner>
        )}

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
                  <Banner tone="info">
                    Product picker will be available after app publish. For now, enter product ID manually.
                  </Banner>
                  <TextField
                    label="Gift Product ID (Optional)"
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
            {/* Tips */}
            <Card>
              <BlockStack gap="300">
                <Text variant="headingSm" as="h3">💡 Tips</Text>
                <BlockStack gap="200">
                  <Text variant="bodySm" as="p">
                    <strong>Threshold:</strong> Set 20-30% above your average order value.
                  </Text>
                  <Text variant="bodySm" as="p">
                    <strong>Gift value:</strong> Choose something with high perceived value but low cost.
                  </Text>
                  <Text variant="bodySm" as="p">
                    <strong>Progress bar:</strong> Customers are 2x more likely to add more when they see progress.
                  </Text>
                </BlockStack>
                <Divider />
                <Text variant="bodySm" tone="success" as="p">
                  📈 GWP campaigns increase AOV by 15-25% on average!
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
                  onClick={() => navigate("/app/gifts")}
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
