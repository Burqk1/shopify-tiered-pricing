/**
 * Edit BOGO Offer Route
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
  Badge,
  Modal,
} from "@shopify/polaris";
import { useState, useCallback } from "react";

import { authenticate } from "~/shopify.server";
import { getShopByDomain, getLocaleSettings } from "~/models/shop.server";
import { getBogoOffer, updateBogoOffer, deleteBogoOffer, updateBogoStatus } from "~/models/bogo.server";
import { getTranslations } from "~/i18n";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { id } = params;

  if (!id) {
    throw new Response("BOGO ID required", { status: 400 });
  }

  const shop = await getShopByDomain(session.shop);
  if (!shop) {
    throw new Response("Shop not found", { status: 404 });
  }

  const offer = await getBogoOffer(id);
  if (!offer || offer.shopId !== shop.id) {
    throw new Response("BOGO offer not found", { status: 404 });
  }

  const localeSettings = await getLocaleSettings(session.shop);
  const locale = localeSettings?.locale || "en";
  const t = getTranslations(locale);

  return json({
    offer,
    shopId: shop.id,
    currency: shop.currencySymbol || "$",
    t,
  });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { id } = params;

  if (!id) {
    return json({ error: "BOGO ID required" }, { status: 400 });
  }

  const shop = await getShopByDomain(session.shop);
  if (!shop) {
    return json({ error: "Shop not found" }, { status: 404 });
  }

  const offer = await getBogoOffer(id);
  if (!offer || offer.shopId !== shop.id) {
    return json({ error: "BOGO offer not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const action = formData.get("_action");

  try {
    if (action === "delete") {
      await deleteBogoOffer(id);
      return redirect("/app/bogo");
    }

    if (action === "toggle_status") {
      const newStatus = offer.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
      await updateBogoStatus(id, newStatus);
      return json({ success: true });
    }

    // Update offer
    const data = Object.fromEntries(formData);

    await updateBogoOffer(id, {
      name: data.name as string,
      description: data.description as string || undefined,
      bogoType: data.bogoType as any,
      buyQuantity: parseInt(data.buyQuantity as string) || 1,
      getQuantity: parseInt(data.getQuantity as string) || 1,
      discountType: data.discountType as any,
      discountValue: parseFloat(data.discountValue as string) || 100,
      maxUsesPerOrder: data.maxUsesPerOrder ? parseInt(data.maxUsesPerOrder as string) : null,
      maxUsesTotal: data.maxUsesTotal ? parseInt(data.maxUsesTotal as string) : null,
      stackable: data.stackable === "true",
      priority: parseInt(data.priority as string) || 0,
      startDate: data.startDate ? new Date(data.startDate as string) : null,
      endDate: data.endDate ? new Date(data.endDate as string) : null,
    });

    const status = data.status as string;
    if (status && status !== offer.status) {
      await updateBogoStatus(id, status as any);
    }

    return redirect("/app/bogo");
  } catch (error) {
    return json({ error: "Failed to update BOGO offer" }, { status: 500 });
  }
};

export default function EditBogo() {
  const { offer, shopId, currency, t } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  // Form state - initialized from offer
  const [name, setName] = useState(offer.name);
  const [description, setDescription] = useState(offer.description || "");
  const [bogoType, setBogoType] = useState(offer.bogoType);
  const [buyQuantity, setBuyQuantity] = useState(String(offer.buyQuantity));
  const [getQuantity, setGetQuantity] = useState(String(offer.getQuantity));
  const [discountType, setDiscountType] = useState(offer.discountType);
  const [discountValue, setDiscountValue] = useState(String(offer.discountValue));
  const [maxUsesPerOrder, setMaxUsesPerOrder] = useState(offer.maxUsesPerOrder ? String(offer.maxUsesPerOrder) : "");
  const [maxUsesTotal, setMaxUsesTotal] = useState(offer.maxUsesTotal ? String(offer.maxUsesTotal) : "");
  const [stackable, setStackable] = useState(offer.stackable);
  const [priority, setPriority] = useState(String(offer.priority));
  const [useScheduling, setUseScheduling] = useState(!!(offer.startDate || offer.endDate));
  const [startDate, setStartDate] = useState(offer.startDate ? new Date(offer.startDate).toISOString().slice(0, 16) : "");
  const [endDate, setEndDate] = useState(offer.endDate ? new Date(offer.endDate).toISOString().slice(0, 16) : "");
  const [error, setError] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleSubmit = useCallback(
    (status: string) => {
      if (!name.trim()) {
        setError("Please enter an offer name");
        return;
      }

      const formData = new FormData();
      formData.append("name", name);
      formData.append("description", description);
      formData.append("bogoType", bogoType);
      formData.append("buyQuantity", buyQuantity);
      formData.append("getQuantity", getQuantity);
      formData.append("discountType", discountType);
      formData.append("discountValue", discountValue);
      formData.append("maxUsesPerOrder", maxUsesPerOrder);
      formData.append("maxUsesTotal", maxUsesTotal);
      formData.append("stackable", stackable.toString());
      formData.append("priority", priority);
      formData.append("status", status);

      if (useScheduling) {
        if (startDate) formData.append("startDate", startDate);
        if (endDate) formData.append("endDate", endDate);
      }

      submit(formData, { method: "POST" });
    },
    [name, description, bogoType, buyQuantity, getQuantity, discountType, discountValue, maxUsesPerOrder, maxUsesTotal, stackable, priority, useScheduling, startDate, endDate, submit]
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

  const bogoTypeOptions = [
    { label: "Buy X Get Y Free", value: "BUY_X_GET_Y_FREE" },
    { label: "Buy X Get Y at % Off", value: "BUY_X_GET_Y_PERCENT" },
    { label: "Buy X Get Y at Fixed Price", value: "BUY_X_GET_Y_FIXED" },
    { label: "Spend X Get Free Item", value: "SPEND_X_GET_Y" },
  ];

  const discountTypeOptions = [
    { label: "Percentage Off", value: "PERCENTAGE" },
    { label: "Fixed Amount Off", value: "FIXED_AMOUNT" },
  ];

  const priorityOptions = [
    { label: "Low (0)", value: "0" },
    { label: "Medium (5)", value: "5" },
    { label: "High (10)", value: "10" },
  ];

  // Preview text
  const getPreviewText = () => {
    const buy = parseInt(buyQuantity) || 1;
    const get = parseInt(getQuantity) || 1;
    const discount = parseFloat(discountValue) || 0;

    switch (bogoType) {
      case "BUY_X_GET_Y_FREE":
        return `Buy ${buy}, Get ${get} FREE`;
      case "BUY_X_GET_Y_PERCENT":
        return `Buy ${buy}, Get ${get} at ${discount}% OFF`;
      case "BUY_X_GET_Y_FIXED":
        return `Buy ${buy}, Get ${get} for ${currency}${discount}`;
      case "SPEND_X_GET_Y":
        return `Spend ${currency}${buy}+, Get FREE Item`;
      default:
        return "";
    }
  };

  const getStatusBadge = () => {
    switch (offer.status) {
      case "ACTIVE":
        return <Badge tone="success">Active</Badge>;
      case "PAUSED":
        return <Badge tone="warning">Paused</Badge>;
      case "DRAFT":
        return <Badge>Draft</Badge>;
      default:
        return <Badge>{offer.status}</Badge>;
    }
  };

  return (
    <Page
      title={`Edit: ${offer.name}`}
      titleMetadata={getStatusBadge()}
      backAction={{ content: "BOGO Offers", url: "/app/bogo" }}
      secondaryActions={[
        {
          content: offer.status === "ACTIVE" ? "Pause" : "Activate",
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

        {/* Stats Banner */}
        <Card>
          <InlineStack gap="800" align="center">
            <BlockStack gap="100">
              <Text variant="headingXl" as="p">{offer.usesCount}</Text>
              <Text variant="bodySm" tone="subdued" as="p">Times Used</Text>
            </BlockStack>
            <BlockStack gap="100">
              <Text variant="headingXl" as="p">{offer.ordersUsed}</Text>
              <Text variant="bodySm" tone="subdued" as="p">Orders</Text>
            </BlockStack>
            <BlockStack gap="100">
              <Text variant="headingXl" as="p">{currency}{Number(offer.totalDiscountGiven).toFixed(2)}</Text>
              <Text variant="bodySm" tone="subdued" as="p">Total Discounted</Text>
            </BlockStack>
          </InlineStack>
        </Card>

        {/* Preview Banner */}
        <Card>
          <BlockStack gap="300">
            <Text variant="headingSm" as="h3">Preview</Text>
            <Box padding="400" background="bg-surface-success" borderRadius="200">
              <Text variant="headingLg" as="p" alignment="center">
                🎁 {getPreviewText()}
              </Text>
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
                    placeholder="e.g., Buy 2 Get 1 Free"
                    autoComplete="off"
                    helpText="Internal name to identify this offer"
                  />
                  <TextField
                    label="Description"
                    value={description}
                    onChange={setDescription}
                    placeholder="Optional description"
                    multiline={2}
                    autoComplete="off"
                  />
                </FormLayout>
              </BlockStack>
            </Card>

            {/* BOGO Configuration */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingSm" as="h3">BOGO Configuration</Text>
                <FormLayout>
                  <Select
                    label="BOGO Type"
                    options={bogoTypeOptions}
                    value={bogoType}
                    onChange={setBogoType}
                    helpText="Select the type of BOGO offer"
                  />

                  <InlineStack gap="400">
                    <TextField
                      label={bogoType === "SPEND_X_GET_Y" ? `Minimum Spend (${currency})` : "Buy Quantity"}
                      type="number"
                      value={buyQuantity}
                      onChange={setBuyQuantity}
                      min={1}
                      autoComplete="off"
                    />
                    {bogoType !== "SPEND_X_GET_Y" && (
                      <TextField
                        label="Get Quantity"
                        type="number"
                        value={getQuantity}
                        onChange={setGetQuantity}
                        min={1}
                        autoComplete="off"
                      />
                    )}
                  </InlineStack>

                  {bogoType !== "BUY_X_GET_Y_FREE" && (
                    <InlineStack gap="400">
                      <Select
                        label="Discount Type"
                        options={discountTypeOptions}
                        value={discountType}
                        onChange={setDiscountType}
                      />
                      <TextField
                        label={discountType === "PERCENTAGE" ? "Discount %" : `Discount Amount (${currency})`}
                        type="number"
                        value={discountValue}
                        onChange={setDiscountValue}
                        min={0}
                        max={discountType === "PERCENTAGE" ? 100 : undefined}
                        autoComplete="off"
                      />
                    </InlineStack>
                  )}
                </FormLayout>
              </BlockStack>
            </Card>

            {/* Limits & Stacking */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingSm" as="h3">Limits & Stacking</Text>
                <FormLayout>
                  <InlineStack gap="400">
                    <TextField
                      label="Max Uses Per Order"
                      type="number"
                      value={maxUsesPerOrder}
                      onChange={setMaxUsesPerOrder}
                      placeholder="Unlimited"
                      autoComplete="off"
                      helpText="Leave empty for unlimited"
                    />
                    <TextField
                      label="Max Total Uses"
                      type="number"
                      value={maxUsesTotal}
                      onChange={setMaxUsesTotal}
                      placeholder="Unlimited"
                      autoComplete="off"
                      helpText="Total times this offer can be used"
                    />
                  </InlineStack>

                  <Select
                    label="Priority"
                    options={priorityOptions}
                    value={priority}
                    onChange={setPriority}
                    helpText="Higher priority offers are applied first"
                  />

                  <Checkbox
                    label="Allow stacking with other discounts"
                    checked={stackable}
                    onChange={setStackable}
                    helpText="If disabled, this offer won't combine with other promotions"
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
                        helpText="Leave empty to start immediately"
                      />
                      <TextField
                        label="End Date"
                        type="datetime-local"
                        value={endDate}
                        onChange={setEndDate}
                        autoComplete="off"
                        helpText="Leave empty for no end date"
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
                  onClick={() => handleSubmit(offer.status === "DRAFT" ? "ACTIVE" : offer.status)}
                  loading={isSubmitting}
                >
                  Save Changes
                </Button>
                {offer.status === "DRAFT" && (
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
                  onClick={() => navigate("/app/bogo")}
                >
                  Cancel
                </Button>
              </BlockStack>
            </Card>

            {/* Info Card */}
            <Card>
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">Offer Info</Text>
                <Text variant="bodySm" tone="subdued" as="p">
                  Created: {new Date(offer.createdAt).toLocaleDateString()}
                </Text>
                <Text variant="bodySm" tone="subdued" as="p">
                  Updated: {new Date(offer.updatedAt).toLocaleDateString()}
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
        title="Delete BOGO Offer"
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
            Are you sure you want to delete "{offer.name}"? This action cannot be undone.
          </Text>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
