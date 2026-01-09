/**
 * Cart Progress Bar List Route
 *
 * Manage cart progress bars (free shipping, discount unlock, etc.)
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate, useSubmit } from "@remix-run/react";
import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Badge,
  IndexTable,
  EmptyState,
  Box,
  ProgressBar,
} from "@shopify/polaris";
import { useState } from "react";
import { PlusIcon } from "@shopify/polaris-icons";

import { authenticate } from "~/shopify.server";
import { DeleteConfirmModal } from "~/components/DeleteConfirmModal";
import { getShopByDomain, getLocaleSettings } from "~/models/shop.server";
import { getProgressBars, updateProgressBarStatus, deleteProgressBar } from "~/models/cart-progress.server";
import { getTranslations } from "~/i18n";
import type { RuleStatus } from "@prisma/client";

// Local types until Prisma migration
type ProgressBarType = "FREE_SHIPPING" | "DISCOUNT_UNLOCK" | "FREE_GIFT" | "TIERED_PROGRESS";
type RewardType = "FREE_SHIPPING" | "PERCENTAGE_DISCOUNT" | "FIXED_DISCOUNT" | "FREE_GIFT";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const shop = await getShopByDomain(session.shop);
  if (!shop) {
    throw new Response("Shop not found", { status: 404 });
  }

  const bars = await getProgressBars(shop.id);

  const localeSettings = await getLocaleSettings(session.shop);
  const locale = localeSettings?.locale || "en";
  const t = getTranslations(locale);

  return json({
    bars: bars.map((b) => ({
      id: b.id,
      name: b.name,
      status: b.status,
      progressType: b.progressType,
      threshold: Number(b.threshold),
      rewardType: b.rewardType,
      rewardValue: b.rewardValue ? Number(b.rewardValue) : null,
      barStyle: b.barStyle,
      barColor: b.barColor,
      showOn: b.showOn,
      impressions: b.impressions,
      completions: b.completions,
      revenueGenerated: Number(b.revenueGenerated),
    })),
    shopId: shop.id,
    currency: shop.currencySymbol || "$",
    t,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("action");

  switch (action) {
    case "updateStatus": {
      const barId = formData.get("barId") as string;
      const status = formData.get("status") as RuleStatus;
      await updateProgressBarStatus(barId, status);
      return json({ success: true });
    }
    case "delete": {
      const barId = formData.get("barId") as string;
      await deleteProgressBar(barId);
      return json({ success: true });
    }
    default:
      return json({ error: "Unknown action" }, { status: 400 });
  }
};

const PROGRESS_TYPE_LABELS: Record<ProgressBarType, string> = {
  FREE_SHIPPING: "Free Shipping",
  DISCOUNT_UNLOCK: "Discount Unlock",
  FREE_GIFT: "Free Gift",
  TIERED_PROGRESS: "Tiered Progress",
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _REWARD_TYPE_LABELS: Record<RewardType, string> = {
  FREE_SHIPPING: "Free Shipping",
  PERCENTAGE_DISCOUNT: "% Discount",
  FIXED_DISCOUNT: "$ Discount",
  FREE_GIFT: "Free Gift",
};

export default function CartProgressList() {
  const { bars, currency, t } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const submit = useSubmit();

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [barToDelete, setBarToDelete] = useState<{ id: string; name: string } | null>(null);

  const handleStatusChange = (barId: string, status: RuleStatus) => {
    submit({ action: "updateStatus", barId, status }, { method: "POST" });
  };

  const openDeleteModal = (bar: { id: string; name: string }) => {
    setBarToDelete(bar);
    setDeleteModalOpen(true);
  };

  const handleDelete = () => {
    if (barToDelete) {
      submit({ action: "delete", barId: barToDelete.id }, { method: "POST" });
      setDeleteModalOpen(false);
      setBarToDelete(null);
    }
  };

  const getStatusBadge = (status: RuleStatus) => {
    const config = {
      DRAFT: { tone: "info" as const, label: t.rules.draft },
      ACTIVE: { tone: "success" as const, label: t.rules.active },
      PAUSED: { tone: "warning" as const, label: t.rules.paused },
      ARCHIVED: { tone: "critical" as const, label: t.rules.archived },
    };
    const c = config[status];
    return <Badge tone={c.tone}>{c.label}</Badge>;
  };

  const getConversionRate = (impressions: number, completions: number) => {
    if (impressions === 0) return "0%";
    return `${((completions / impressions) * 100).toFixed(1)}%`;
  };

  const rowMarkup = bars.map((bar, index) => (
    <IndexTable.Row id={bar.id} key={bar.id} position={index}>
      <IndexTable.Cell>
        <BlockStack gap="100">
          <Text variant="bodyMd" fontWeight="semibold" as="span">
            {bar.name}
          </Text>
          <Text variant="bodySm" tone="subdued" as="span">
            {PROGRESS_TYPE_LABELS[bar.progressType as ProgressBarType]} • {currency}{bar.threshold}
          </Text>
        </BlockStack>
      </IndexTable.Cell>
      <IndexTable.Cell>{getStatusBadge(bar.status as RuleStatus)}</IndexTable.Cell>
      <IndexTable.Cell>
        <Box width="100px">
          <ProgressBar progress={65} size="small" tone="primary" />
        </Box>
        <Text variant="bodySm" tone="subdued" as="span">
          Preview
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodyMd" as="span">
          {bar.impressions.toLocaleString()}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodyMd" as="span">
          {bar.completions.toLocaleString()}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodyMd" as="span">
          {getConversionRate(bar.impressions, bar.completions)}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodyMd" as="span">
          {currency}{bar.revenueGenerated.toFixed(2)}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <InlineStack gap="200">
          <Button size="slim" onClick={() => navigate(`/app/cart-progress/${bar.id}`)}>
            {t.common.edit}
          </Button>
          {bar.status === "DRAFT" && (
            <Button size="slim" tone="success" onClick={() => handleStatusChange(bar.id, "ACTIVE")}>
              Activate
            </Button>
          )}
          {bar.status === "ACTIVE" && (
            <Button size="slim" onClick={() => handleStatusChange(bar.id, "PAUSED")}>
              Pause
            </Button>
          )}
          <Button size="slim" tone="critical" onClick={() => openDeleteModal(bar)}>
            {t.common.delete}
          </Button>
        </InlineStack>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  const emptyState = (
    <EmptyState
      heading="Create your first Cart Progress Bar"
      action={{
        content: "Create Progress Bar",
        onAction: () => navigate("/app/cart-progress/new"),
      }}
      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
    >
      <p>
        Encourage customers to add more to their cart with progress bars like "Add $X more for free shipping!"
      </p>
    </EmptyState>
  );

  // Stats
  const activeBars = bars.filter((b) => b.status === "ACTIVE").length;
  const totalImpressions = bars.reduce((sum, b) => sum + b.impressions, 0);
  const totalCompletions = bars.reduce((sum, b) => sum + b.completions, 0);
  const totalRevenue = bars.reduce((sum, b) => sum + b.revenueGenerated, 0);

  return (
    <Page
      title="Cart Progress Bars"
      subtitle="Motivate customers to spend more"
      primaryAction={{
        content: "Create Progress Bar",
        icon: PlusIcon,
        onAction: () => navigate("/app/cart-progress/new"),
      }}
      backAction={{ content: t.nav.dashboard, url: "/app" }}
    >
      <BlockStack gap="500">
        {/* Preview Banner */}
        <Card>
          <BlockStack gap="300">
            <Text variant="headingSm" as="h3">How it looks to customers</Text>
            <Box padding="400" background="bg-surface-secondary" borderRadius="200">
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text variant="bodyMd" as="span">🚚 Add $25.00 more for FREE shipping!</Text>
                  <Text variant="bodySm" tone="subdued" as="span">$25 away</Text>
                </InlineStack>
                <ProgressBar progress={50} size="small" tone="success" />
              </BlockStack>
            </Box>
          </BlockStack>
        </Card>

        {/* Stats Cards */}
        <InlineStack gap="400" wrap>
          <Box minWidth="200px">
            <Card>
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">Active Bars</Text>
                <Text variant="headingXl" as="p">{activeBars}</Text>
              </BlockStack>
            </Card>
          </Box>
          <Box minWidth="200px">
            <Card>
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">Impressions</Text>
                <Text variant="headingXl" as="p">{totalImpressions.toLocaleString()}</Text>
              </BlockStack>
            </Card>
          </Box>
          <Box minWidth="200px">
            <Card>
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">Completions</Text>
                <Text variant="headingXl" as="p">{totalCompletions.toLocaleString()}</Text>
              </BlockStack>
            </Card>
          </Box>
          <Box minWidth="200px">
            <Card>
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">Revenue Impact</Text>
                <Text variant="headingXl" as="p">{currency}{totalRevenue.toFixed(0)}</Text>
              </BlockStack>
            </Card>
          </Box>
        </InlineStack>

        {/* Progress Bar Types */}
        <Card>
          <BlockStack gap="300">
            <Text variant="headingSm" as="h3">Progress Bar Types</Text>
            <InlineStack gap="400" wrap>
              <Box padding="300" background="bg-surface-success" borderRadius="200">
                <BlockStack gap="100">
                  <Text variant="bodyMd" fontWeight="semibold" as="span">🚚 Free Shipping</Text>
                  <Text variant="bodySm" tone="subdued" as="span">"Add $X for free shipping"</Text>
                </BlockStack>
              </Box>
              <Box padding="300" background="bg-surface-warning" borderRadius="200">
                <BlockStack gap="100">
                  <Text variant="bodyMd" fontWeight="semibold" as="span">💰 Discount Unlock</Text>
                  <Text variant="bodySm" tone="subdued" as="span">"Add $X for 10% off"</Text>
                </BlockStack>
              </Box>
              <Box padding="300" background="bg-surface-critical" borderRadius="200">
                <BlockStack gap="100">
                  <Text variant="bodyMd" fontWeight="semibold" as="span">🎁 Free Gift</Text>
                  <Text variant="bodySm" tone="subdued" as="span">"Add $X for free gift"</Text>
                </BlockStack>
              </Box>
              <Box padding="300" background="bg-surface-info" borderRadius="200">
                <BlockStack gap="100">
                  <Text variant="bodyMd" fontWeight="semibold" as="span">📊 Tiered Progress</Text>
                  <Text variant="bodySm" tone="subdued" as="span">Multiple reward tiers</Text>
                </BlockStack>
              </Box>
            </InlineStack>
          </BlockStack>
        </Card>

        {/* Progress Bars Table */}
        <Card padding="0">
          {bars.length === 0 ? (
            emptyState
          ) : (
            <IndexTable
              resourceName={{ singular: "progress bar", plural: "progress bars" }}
              itemCount={bars.length}
              headings={[
                { title: "Name" },
                { title: "Status" },
                { title: "Preview" },
                { title: "Impressions" },
                { title: "Completions" },
                { title: "Conv. Rate" },
                { title: "Revenue" },
                { title: "Actions" },
              ]}
              selectable={false}
            >
              {rowMarkup}
            </IndexTable>
          )}
        </Card>
      </BlockStack>

      <DeleteConfirmModal
        open={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setBarToDelete(null);
        }}
        onConfirm={handleDelete}
        itemName={barToDelete?.name}
        itemType="progress bar"
      />
    </Page>
  );
}
