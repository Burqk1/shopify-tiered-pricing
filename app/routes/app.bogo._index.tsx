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
  Layout,
  Box,
  Tooltip,
  Icon,
} from "@shopify/polaris";
import { useState } from "react";
import { PlusIcon } from "@shopify/polaris-icons";

import { authenticate } from "~/shopify.server";
import { DeleteConfirmModal } from "~/components/DeleteConfirmModal";
import { getShopByDomain, getLocaleSettings } from "~/models/shop.server";
import { getBogoOffers, updateBogoStatus, deleteBogoOffer, type BogoType } from "~/models/bogo.server";
import { getTranslations } from "~/i18n";
import type { RuleStatus } from "@prisma/client";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

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

const BOGO_TYPE_LABELS: Record<BogoType, string> = {
  BUY_X_GET_Y_FREE: "Buy X Get Y Free",
  BUY_X_GET_Y_PERCENT: "Buy X Get Y % Off",
  BUY_X_GET_Y_FIXED: "Buy X Get Y $ Off",
  SPEND_X_GET_Y: "Spend X Get Y",
};

export default function BogoList() {
  const { offers, currency, t } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const submit = useSubmit();

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [offerToDelete, setOfferToDelete] = useState<{ id: string; name: string } | null>(null);

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
        return `Buy ${buyQty} Get ${getQty} FREE`;
      case "BUY_X_GET_Y_PERCENT":
        return `Buy ${buyQty} Get ${getQty} at ${discountValue}% OFF`;
      case "BUY_X_GET_Y_FIXED":
        return `Buy ${buyQty} Get ${getQty} for ${currency}${discountValue}`;
      case "SPEND_X_GET_Y":
        return `Spend ${currency}${buyQty}+ Get Free Item`;
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
              Activate
            </Button>
          )}
          {offer.status === "ACTIVE" && (
            <Button size="slim" onClick={() => handleStatusChange(offer.id, "PAUSED")}>
              Pause
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
      heading="Create your first BOGO offer"
      action={{
        content: "Create BOGO Offer",
        onAction: () => navigate("/app/bogo/new"),
      }}
      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
    >
      <p>
        Boost sales with "Buy One Get One" offers. Create BOGO deals, "Buy 2 Get 1 Free" promotions, and more.
      </p>
    </EmptyState>
  );

  // Stats
  const activeOffers = offers.filter((o) => o.status === "ACTIVE").length;
  const totalOrders = offers.reduce((sum, o) => sum + o.ordersUsed, 0);
  const totalDiscounts = offers.reduce((sum, o) => sum + o.totalDiscountGiven, 0);

  return (
    <Page
      title="BOGO Offers"
      subtitle="Buy One Get One promotions"
      primaryAction={{
        content: "Create BOGO Offer",
        icon: PlusIcon,
        onAction: () => navigate("/app/bogo/new"),
      }}
      backAction={{ content: t.nav.dashboard, url: "/app" }}
    >
      <BlockStack gap="500">
        {/* Stats Cards */}
        <Layout>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">Active Offers</Text>
                <Text variant="headingXl" as="p">{activeOffers}</Text>
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">Orders with BOGO</Text>
                <Text variant="headingXl" as="p">{totalOrders}</Text>
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">Total Discounts Given</Text>
                <Text variant="headingXl" as="p">{currency}{totalDiscounts.toFixed(2)}</Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* BOGO Types Info */}
        <Card>
          <BlockStack gap="300">
            <Text variant="headingSm" as="h3">Available BOGO Types</Text>
            <InlineStack gap="400" wrap>
              <Box padding="200" background="bg-surface-secondary" borderRadius="200">
                <BlockStack gap="100">
                  <Text variant="bodyMd" fontWeight="semibold" as="span">Buy X Get Y Free</Text>
                  <Text variant="bodySm" tone="subdued" as="span">e.g., Buy 2 Get 1 Free</Text>
                </BlockStack>
              </Box>
              <Box padding="200" background="bg-surface-secondary" borderRadius="200">
                <BlockStack gap="100">
                  <Text variant="bodyMd" fontWeight="semibold" as="span">Buy X Get Y % Off</Text>
                  <Text variant="bodySm" tone="subdued" as="span">e.g., Buy 2 Get 1 at 50% Off</Text>
                </BlockStack>
              </Box>
              <Box padding="200" background="bg-surface-secondary" borderRadius="200">
                <BlockStack gap="100">
                  <Text variant="bodyMd" fontWeight="semibold" as="span">Spend X Get Y</Text>
                  <Text variant="bodySm" tone="subdued" as="span">e.g., Spend $100 Get Free Gift</Text>
                </BlockStack>
              </Box>
            </InlineStack>
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
                { title: "Offer" },
                { title: "Status" },
                { title: "Orders" },
                { title: "Discounts Given" },
                { title: "Stacking" },
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
          setOfferToDelete(null);
        }}
        onConfirm={handleDelete}
        itemName={offerToDelete?.name}
        itemType="BOGO offer"
      />
    </Page>
  );
}
