/**
 * BOGO Offers List Route
 *
 * Manage Buy One Get One offers
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
  Grid,
} from "@shopify/polaris";
import { useState } from "react";
import { PlusIcon } from "@shopify/polaris-icons";

import { authenticate } from "~/shopify.server";
import { DeleteConfirmModal } from "~/components/DeleteConfirmModal";
import { getShopByDomain, getLocaleSettings } from "~/models/shop.server";
import { getBogoOffers, updateBogoStatus, deleteBogoOffer, type BogoType } from "~/models/bogo.server";
import { getTranslations } from "~/i18n";
import { requireFeatureAccess } from "~/utils/plan-guard.server";
import type { RuleStatus } from "@prisma/client";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  // Check if user has access (GROWTH+ plan required)
  await requireFeatureAccess(session.shop, "customerTags");

  const shop = await getShopByDomain(session.shop);
  if (!shop) {
    throw new Response("Shop not found", { status: 404 });
  }

  const offers = await getBogoOffers(shop.id);

  const localeSettings = await getLocaleSettings(session.shop);
  const locale = localeSettings?.locale || "en";
  const t = getTranslations(locale);

  return json({
    offers: offers.map((o) => ({
      id: o.id,
      name: o.name,
      status: o.status,
      bogoType: o.bogoType,
      buyQuantity: o.buyQuantity,
      getQuantity: o.getQuantity,
      discountValue: Number(o.discountValue),
      discountType: o.discountType,
      usesCount: o.usesCount,
      ordersUsed: o.ordersUsed,
      totalDiscountGiven: Number(o.totalDiscountGiven),
      stackable: o.stackable,
      startDate: o.startDate?.toISOString(),
      endDate: o.endDate?.toISOString(),
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
      const offerId = formData.get("offerId") as string;
      const status = formData.get("status") as RuleStatus;
      await updateBogoStatus(offerId, status);
      return json({ success: true });
    }
    case "delete": {
      const offerId = formData.get("offerId") as string;
      await deleteBogoOffer(offerId);
      return json({ success: true });
    }
    default:
      return json({ error: "Unknown action" }, { status: 400 });
  }
};

export default function BogoList() {
  const { offers, currency, t } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const submit = useSubmit();

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [offerToDelete, setOfferToDelete] = useState<{ id: string; name: string } | null>(null);

  // Get bogoPage translations with fallback
  const bp = t.bogoPage || {
    title: "BOGO Offers",
    subtitle: "Buy One Get One deals to boost sales",
    createOffer: "Create BOGO Offer",
    activeOffers: "Active Offers",
    totalRedemptions: "Total Redemptions",
    revenueLift: "Revenue Lift",
    fromBogoSales: "from BOGO sales",
    offerTypes: "Offer Types",
    buyXGetYFree: "Buy X Get Y Free",
    buyXGetYFreeDesc: "\"Buy 2, Get 1 Free\"",
    buyXGetYPercent: "Buy X Get Y % Off",
    buyXGetYPercentDesc: "\"Buy 1, Get 2nd 50% Off\"",
    spendXGetY: "Spend X Get Y",
    spendXGetYDesc: "\"Spend $50, Get Free Gift\"",
    offer: "Offer",
    type: "Type",
    status: "Status",
    buyCondition: "Buy Condition",
    getReward: "Get Reward",
    redemptions: "Redemptions",
    actions: "Actions",
    activate: "Activate",
    pause: "Pause",
    free: "FREE",
    offItem: "off {item}",
    createFirst: "Create your first BOGO offer",
    emptyStateDesc: "BOGO (Buy One Get One) offers are proven to increase average order value and customer engagement.",
  };

  const handleStatusChange = (offerId: string, status: RuleStatus) => {
    submit({ action: "updateStatus", offerId, status }, { method: "POST" });
  };

  const openDeleteModal = (offer: { id: string; name: string }) => {
    setOfferToDelete(offer);
    setDeleteModalOpen(true);
  };

  const handleDelete = () => {
    if (offerToDelete) {
      submit({ action: "delete", offerId: offerToDelete.id }, { method: "POST" });
      setDeleteModalOpen(false);
      setOfferToDelete(null);
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

  const formatBogoType = (type: BogoType, buyQty: number, getQty: number, discountValue: number) => {
    switch (type) {
      case "BUY_X_GET_Y_FREE":
        return `${buyQty} al ${getQty} ${bp.free}`;
      case "BUY_X_GET_Y_PERCENT":
        return `${buyQty} al ${getQty}. %${discountValue}`;
      case "BUY_X_GET_Y_FIXED":
        return `${buyQty} al ${getQty}. ${currency}${discountValue}`;
      case "SPEND_X_GET_Y":
        return `${currency}${buyQty}+ harca`;
      default:
        return type;
    }
  };

  const rowMarkup = offers.map((offer, index) => (
    <IndexTable.Row id={offer.id} key={offer.id} position={index}>
      <IndexTable.Cell>
        <BlockStack gap="100">
          <Text variant="bodyMd" fontWeight="semibold" as="span">
            {offer.name}
          </Text>
          <Text variant="bodySm" tone="subdued" as="span">
            {formatBogoType(offer.bogoType as BogoType, offer.buyQuantity, offer.getQuantity, offer.discountValue)}
          </Text>
        </BlockStack>
      </IndexTable.Cell>
      <IndexTable.Cell>{getStatusBadge(offer.status as RuleStatus)}</IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodyMd" as="span">
          {offer.ordersUsed}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodyMd" as="span">
          {currency}{offer.totalDiscountGiven.toFixed(2)}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {offer.stackable ? (
          <Badge tone="success">Stackable</Badge>
        ) : (
          <Badge tone="attention">Exclusive</Badge>
        )}
      </IndexTable.Cell>
      <IndexTable.Cell>
        <InlineStack gap="200">
          <Button size="slim" onClick={() => navigate(`/app/bogo/${offer.id}`)}>
            {t.common.edit}
          </Button>
          {offer.status === "DRAFT" && (
            <Button size="slim" tone="success" onClick={() => handleStatusChange(offer.id, "ACTIVE")}>
              {bp.activate}
            </Button>
          )}
          {offer.status === "ACTIVE" && (
            <Button size="slim" onClick={() => handleStatusChange(offer.id, "PAUSED")}>
              {bp.pause}
            </Button>
          )}
          <Button size="slim" tone="critical" onClick={() => openDeleteModal(offer)}>
            {t.common.delete}
          </Button>
        </InlineStack>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  const emptyState = (
    <EmptyState
      heading={bp.createFirst}
      action={{
        content: bp.createOffer,
        onAction: () => navigate("/app/bogo/new"),
      }}
      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
    >
      <p>{bp.emptyStateDesc}</p>
    </EmptyState>
  );

  // Stats
  const activeOffers = offers.filter((o) => o.status === "ACTIVE").length;
  const totalOrders = offers.reduce((sum, o) => sum + o.ordersUsed, 0);
  const totalDiscounts = offers.reduce((sum, o) => sum + o.totalDiscountGiven, 0);

  return (
    <Page
      title={bp.title}
      subtitle={bp.subtitle}
      primaryAction={{
        content: bp.createOffer,
        icon: PlusIcon,
        onAction: () => navigate("/app/bogo/new"),
      }}
      backAction={{ content: t.nav.dashboard, url: "/app" }}
    >
      <BlockStack gap="500">
        {/* Stats Cards - Using Grid for equal sizing */}
        <Grid>
          <Grid.Cell columnSpan={{ xs: 6, sm: 2, md: 2, lg: 4, xl: 4 }}>
            <Card>
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">{bp.activeOffers}</Text>
                <Text variant="heading2xl" as="p">{activeOffers}</Text>
              </BlockStack>
            </Card>
          </Grid.Cell>
          <Grid.Cell columnSpan={{ xs: 6, sm: 2, md: 2, lg: 4, xl: 4 }}>
            <Card>
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">{bp.totalRedemptions}</Text>
                <Text variant="heading2xl" as="p">{totalOrders}</Text>
              </BlockStack>
            </Card>
          </Grid.Cell>
          <Grid.Cell columnSpan={{ xs: 6, sm: 2, md: 2, lg: 4, xl: 4 }}>
            <Card>
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">{bp.revenueLift}</Text>
                <Text variant="heading2xl" as="p">{currency}{totalDiscounts.toFixed(2)}</Text>
                <Text variant="bodySm" tone="subdued" as="span">{bp.fromBogoSales}</Text>
              </BlockStack>
            </Card>
          </Grid.Cell>
        </Grid>

        {/* BOGO Types Info */}
        <Card>
          <BlockStack gap="300">
            <Text variant="headingSm" as="h3">{bp.offerTypes}</Text>
            <Grid>
              <Grid.Cell columnSpan={{ xs: 6, sm: 2, md: 2, lg: 4, xl: 4 }}>
                <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                  <BlockStack gap="100">
                    <Text variant="bodyMd" fontWeight="semibold" as="span">🎁 {bp.buyXGetYFree}</Text>
                    <Text variant="bodySm" tone="subdued" as="span">{bp.buyXGetYFreeDesc}</Text>
                  </BlockStack>
                </Box>
              </Grid.Cell>
              <Grid.Cell columnSpan={{ xs: 6, sm: 2, md: 2, lg: 4, xl: 4 }}>
                <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                  <BlockStack gap="100">
                    <Text variant="bodyMd" fontWeight="semibold" as="span">💰 {bp.buyXGetYPercent}</Text>
                    <Text variant="bodySm" tone="subdued" as="span">{bp.buyXGetYPercentDesc}</Text>
                  </BlockStack>
                </Box>
              </Grid.Cell>
              <Grid.Cell columnSpan={{ xs: 6, sm: 2, md: 2, lg: 4, xl: 4 }}>
                <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                  <BlockStack gap="100">
                    <Text variant="bodyMd" fontWeight="semibold" as="span">🛒 {bp.spendXGetY}</Text>
                    <Text variant="bodySm" tone="subdued" as="span">{bp.spendXGetYDesc}</Text>
                  </BlockStack>
                </Box>
              </Grid.Cell>
            </Grid>
          </BlockStack>
        </Card>

        {/* Offers Table */}
        <Card padding="0">
          {offers.length === 0 ? (
            emptyState
          ) : (
            <IndexTable
              resourceName={{ singular: "BOGO offer", plural: "BOGO offers" }}
              itemCount={offers.length}
              headings={[
                { title: bp.offer },
                { title: bp.status },
                { title: bp.redemptions },
                { title: bp.revenueLift },
                { title: "Stacking" },
                { title: bp.actions },
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
          setOfferToDelete(null);
        }}
        onConfirm={handleDelete}
        itemName={offerToDelete?.name}
        itemType="BOGO offer"
      />
    </Page>
  );
}
