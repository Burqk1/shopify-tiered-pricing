/**
 * Gift with Purchase List Route
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
  Grid,
} from "@shopify/polaris";
import { useState } from "react";
import { PlusIcon } from "@shopify/polaris-icons";

import { authenticate } from "~/shopify.server";
import { DeleteConfirmModal } from "~/components/DeleteConfirmModal";
import { getShopByDomain, getLocaleSettings } from "~/models/shop.server";
import { getGiftsWithPurchase, updateGiftStatus, deleteGiftWithPurchase } from "~/models/gift-with-purchase.server";
import { getTranslations } from "~/i18n";
import { requireFeatureAccess } from "~/utils/plan-guard.server";
import type { RuleStatus } from "@prisma/client";

// Local type until Prisma migration
type GiftTriggerType = "MIN_SPEND" | "MIN_QUANTITY" | "SPECIFIC_PRODUCT" | "SPECIFIC_COLLECTION";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  // Check if user has access (GROWTH+ plan required)
  await requireFeatureAccess(session.shop, "customerTags");

  const shop = await getShopByDomain(session.shop);
  if (!shop) {
    throw new Response("Shop not found", { status: 404 });
  }

  const gifts = await getGiftsWithPurchase(shop.id);

  const localeSettings = await getLocaleSettings(session.shop);
  const locale = localeSettings?.locale || "en";
  const t = getTranslations(locale);

  return json({
    gifts: gifts.map((g) => ({
      id: g.id,
      name: g.name,
      status: g.status,
      triggerType: g.triggerType,
      triggerValue: Number(g.triggerValue),
      giftProductId: g.giftProductId,
      giftTitle: g.giftTitle,
      giftQuantity: g.giftQuantity,
      giftDiscountPercent: Number(g.giftDiscountPercent),
      givenCount: g.givenCount,
      maxTotal: g.maxTotal,
      autoAddToCart: g.autoAddToCart,
      showProgressBar: g.showProgressBar,
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
      const giftId = formData.get("giftId") as string;
      const status = formData.get("status") as RuleStatus;
      await updateGiftStatus(giftId, status);
      return json({ success: true });
    }
    case "delete": {
      const giftId = formData.get("giftId") as string;
      await deleteGiftWithPurchase(giftId);
      return json({ success: true });
    }
    default:
      return json({ error: "Unknown action" }, { status: 400 });
  }
};

export default function GiftsList() {
  const { gifts, currency, t } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const submit = useSubmit();

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [giftToDelete, setGiftToDelete] = useState<{ id: string; name: string } | null>(null);

  // Get giftsPage translations with fallback
  const gp = t.giftsPage || {
    title: "Gift with Purchase",
    subtitle: "Free gifts to boost order value",
    createGift: "Create Gift Offer",
    activeOffers: "Active Offers",
    totalGiftsGiven: "Total Gifts Given",
    conversionBoost: "Conversion Boost",
    avgIncreaseInAOV: "avg. increase in AOV",
    howItWorks: "How it works",
    exampleTitle: "Spend $75 more to get a FREE Tote Bag!",
    exampleProgress: "You're 60% there!",
    triggerTypes: "Trigger Types",
    minSpend: "Minimum Spend",
    minSpendDesc: "\"Spend $100, get free gift\"",
    minQuantity: "Minimum Quantity",
    minQuantityDesc: "\"Buy 5 items, get free gift\"",
    specificProduct: "Specific Product",
    specificProductDesc: "\"Buy X, get Y free\"",
    offer: "Offer",
    status: "Status",
    gift: "Gift",
    usage: "Usage",
    features: "Features",
    actions: "Actions",
    given: "given",
    ofMax: "of {max} max",
    autoAdd: "Auto-add",
    progressBar: "Progress Bar",
    activate: "Activate",
    pause: "Pause",
    createFirst: "Create your first Gift with Purchase",
    emptyStateDesc: "Increase average order value by offering free gifts when customers reach spending thresholds.",
    off: "off",
  };

  const handleStatusChange = (giftId: string, status: RuleStatus) => {
    submit({ action: "updateStatus", giftId, status }, { method: "POST" });
  };

  const openDeleteModal = (gift: { id: string; name: string }) => {
    setGiftToDelete(gift);
    setDeleteModalOpen(true);
  };

  const handleDelete = () => {
    if (giftToDelete) {
      submit({ action: "delete", giftId: giftToDelete.id }, { method: "POST" });
      setDeleteModalOpen(false);
      setGiftToDelete(null);
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

  const formatTrigger = (type: GiftTriggerType, value: number) => {
    switch (type) {
      case "MIN_SPEND":
        return `${currency}${value}+`;
      case "MIN_QUANTITY":
        return `${value}+`;
      default:
        return type;
    }
  };

  const rowMarkup = gifts.map((gift, index) => (
    <IndexTable.Row id={gift.id} key={gift.id} position={index}>
      <IndexTable.Cell>
        <BlockStack gap="100">
          <Text variant="bodyMd" fontWeight="semibold" as="span">
            {gift.name}
          </Text>
          <Text variant="bodySm" tone="subdued" as="span">
            {formatTrigger(gift.triggerType as GiftTriggerType, gift.triggerValue)}
          </Text>
        </BlockStack>
      </IndexTable.Cell>
      <IndexTable.Cell>{getStatusBadge(gift.status as RuleStatus)}</IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodyMd" as="span">
          {gift.giftTitle || gp.gift}
        </Text>
        {gift.giftDiscountPercent < 100 && (
          <Text variant="bodySm" tone="subdued" as="span">
            {" "}({gift.giftDiscountPercent}% {gp.off})
          </Text>
        )}
      </IndexTable.Cell>
      <IndexTable.Cell>
        <BlockStack gap="100">
          <Text variant="bodyMd" as="span">
            {gift.givenCount} {gp.given}
          </Text>
          {gift.maxTotal && (
            <Text variant="bodySm" tone="subdued" as="span">
              max {gift.maxTotal}
            </Text>
          )}
        </BlockStack>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <InlineStack gap="100">
          {gift.autoAddToCart && <Badge tone="success">{gp.autoAdd}</Badge>}
          {gift.showProgressBar && <Badge>{gp.progressBar}</Badge>}
        </InlineStack>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <InlineStack gap="200">
          <Button size="slim" onClick={() => navigate(`/app/gifts/${gift.id}`)}>
            {t.common.edit}
          </Button>
          {gift.status === "DRAFT" && (
            <Button size="slim" tone="success" onClick={() => handleStatusChange(gift.id, "ACTIVE")}>
              {gp.activate}
            </Button>
          )}
          {gift.status === "ACTIVE" && (
            <Button size="slim" onClick={() => handleStatusChange(gift.id, "PAUSED")}>
              {gp.pause}
            </Button>
          )}
          <Button size="slim" tone="critical" onClick={() => openDeleteModal(gift)}>
            {t.common.delete}
          </Button>
        </InlineStack>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  const emptyState = (
    <EmptyState
      heading={gp.createFirst}
      action={{
        content: gp.createGift,
        onAction: () => navigate("/app/gifts/new"),
      }}
      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
    >
      <p>{gp.emptyStateDesc}</p>
    </EmptyState>
  );

  // Stats
  const activeGifts = gifts.filter((g) => g.status === "ACTIVE").length;
  const totalGiven = gifts.reduce((sum, g) => sum + g.givenCount, 0);

  return (
    <Page
      title={gp.title}
      subtitle={gp.subtitle}
      primaryAction={{
        content: gp.createGift,
        icon: PlusIcon,
        onAction: () => navigate("/app/gifts/new"),
      }}
      backAction={{ content: t.nav.dashboard, url: "/app" }}
    >
      <BlockStack gap="500">
        {/* Example Banner */}
        <Card>
          <BlockStack gap="300">
            <Text variant="headingSm" as="h3">{gp.howItWorks}</Text>
            <Box padding="400" background="bg-surface-success" borderRadius="200">
              <BlockStack gap="200">
                <Text variant="headingMd" as="p" alignment="center">
                  🎁 {gp.exampleTitle}
                </Text>
                <ProgressBar progress={60} size="small" tone="success" />
                <Text variant="bodySm" tone="subdued" as="p" alignment="center">
                  {gp.exampleProgress}
                </Text>
              </BlockStack>
            </Box>
          </BlockStack>
        </Card>

        {/* Stats Cards - Using Grid for equal sizing */}
        <Grid>
          <Grid.Cell columnSpan={{ xs: 6, sm: 2, md: 2, lg: 4, xl: 4 }}>
            <Card>
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">{gp.activeOffers}</Text>
                <Text variant="heading2xl" as="p">{activeGifts}</Text>
              </BlockStack>
            </Card>
          </Grid.Cell>
          <Grid.Cell columnSpan={{ xs: 6, sm: 2, md: 2, lg: 4, xl: 4 }}>
            <Card>
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">{gp.totalGiftsGiven}</Text>
                <Text variant="heading2xl" as="p">{totalGiven}</Text>
              </BlockStack>
            </Card>
          </Grid.Cell>
          <Grid.Cell columnSpan={{ xs: 6, sm: 2, md: 2, lg: 4, xl: 4 }}>
            <Card>
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">{gp.conversionBoost}</Text>
                <Text variant="heading2xl" as="p" tone="success">+18%</Text>
                <Text variant="bodySm" tone="subdued" as="span">{gp.avgIncreaseInAOV}</Text>
              </BlockStack>
            </Card>
          </Grid.Cell>
        </Grid>

        {/* Trigger Types */}
        <Card>
          <BlockStack gap="300">
            <Text variant="headingSm" as="h3">{gp.triggerTypes}</Text>
            <Grid>
              <Grid.Cell columnSpan={{ xs: 6, sm: 2, md: 2, lg: 4, xl: 4 }}>
                <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                  <BlockStack gap="100">
                    <Text variant="bodyMd" fontWeight="semibold" as="span">💰 {gp.minSpend}</Text>
                    <Text variant="bodySm" tone="subdued" as="span">{gp.minSpendDesc}</Text>
                  </BlockStack>
                </Box>
              </Grid.Cell>
              <Grid.Cell columnSpan={{ xs: 6, sm: 2, md: 2, lg: 4, xl: 4 }}>
                <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                  <BlockStack gap="100">
                    <Text variant="bodyMd" fontWeight="semibold" as="span">📦 {gp.minQuantity}</Text>
                    <Text variant="bodySm" tone="subdued" as="span">{gp.minQuantityDesc}</Text>
                  </BlockStack>
                </Box>
              </Grid.Cell>
              <Grid.Cell columnSpan={{ xs: 6, sm: 2, md: 2, lg: 4, xl: 4 }}>
                <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                  <BlockStack gap="100">
                    <Text variant="bodyMd" fontWeight="semibold" as="span">🎯 {gp.specificProduct}</Text>
                    <Text variant="bodySm" tone="subdued" as="span">{gp.specificProductDesc}</Text>
                  </BlockStack>
                </Box>
              </Grid.Cell>
            </Grid>
          </BlockStack>
        </Card>

        {/* Gifts Table */}
        <Card padding="0">
          {gifts.length === 0 ? (
            emptyState
          ) : (
            <IndexTable
              resourceName={{ singular: "gift offer", plural: "gift offers" }}
              itemCount={gifts.length}
              headings={[
                { title: gp.offer },
                { title: gp.status },
                { title: gp.gift },
                { title: gp.usage },
                { title: gp.features },
                { title: gp.actions },
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
          setGiftToDelete(null);
        }}
        onConfirm={handleDelete}
        itemName={giftToDelete?.name}
        itemType="gift offer"
      />
    </Page>
  );
}
