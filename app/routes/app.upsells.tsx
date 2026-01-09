/**
 * Post-Purchase Upsell Management
 *
 * Create and manage one-click upsell offers that appear after checkout
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Badge,
  Icon,
  EmptyState,
  ResourceList,
  ResourceItem,
  Thumbnail,
  Modal,
  TextField,
  Select,
  FormLayout,
  RangeSlider,
  Divider,
  Box,
  Banner,
  Checkbox,
  ChoiceList,
  ColorPicker,
  Popover,
  hsbToHex,
  hexToRgb,
} from "@shopify/polaris";
import {
  PlusIcon,
  EditIcon,
  DeleteIcon,
  ViewIcon,
  CartIcon,
  CashDollarIcon,
  ClockIcon,
  TargetIcon,
} from "@shopify/polaris-icons";
import { useState, useCallback } from "react";
import type { GraphQLEdge, ShopifyProduct } from "~/types/shopify";

import { authenticate } from "~/shopify.server";
import { getShopByDomain, getLocaleSettings } from "~/models/shop.server";
import { getUpsellOffers, getUpsellStats, createUpsellOffer, updateUpsellOffer, updateUpsellStatus, deleteUpsellOffer } from "~/models/upsell.server";
import { getTranslations } from "~/i18n";
import type { DiscountType, PPTriggerType } from "@prisma/client";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

  // Fetch products for selector
  const productsQuery = await admin.graphql(`
    query GetProducts {
      products(first: 20) {
        edges {
          node {
            id
            title
            featuredImage {
              url
            }
            priceRangeV2 {
              minVariantPrice {
                amount
                currencyCode
              }
            }
          }
        }
      }
    }
  `);

  const productsData = await productsQuery.json();

  const shop = await getShopByDomain(session.shop);
  if (!shop) {
    throw new Response("Shop not found", { status: 404 });
  }

  const [offers, stats] = await Promise.all([
    getUpsellOffers(shop.id),
    getUpsellStats(shop.id),
  ]);

  // Enrich offers with product data from Shopify
  const productIds = offers.map((o) => o.offerProductId).filter(Boolean);
  let productData: Record<string, { title: string; image: string; price: string }> = {};

  if (productIds.length > 0) {
    try {
      const response = await admin.graphql(`
        query getProducts($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on Product {
              id
              title
              featuredImage {
                url
              }
              priceRangeV2 {
                minVariantPrice {
                  amount
                }
              }
            }
          }
        }
      `, {
        variables: { ids: productIds },
      });

      const data = await response.json();
      if (data.data?.nodes) {
        productData = data.data.nodes.reduce((acc: Record<string, { title: string; image: string; price: string }>, node: { id: string; title: string; featuredImage?: { url: string }; priceRangeV2?: { minVariantPrice?: { amount: string } } } | null) => {
          if (node && node.id) {
            acc[node.id] = {
              title: node.title,
              image: node.featuredImage?.url || "",
              price: node.priceRangeV2?.minVariantPrice?.amount || "0",
            };
          }
          return acc;
        }, {});
      }
    } catch (error) {
      console.error("Error fetching product data:", error);
    }
  }

  // Enrich offers with product info
  const enrichedOffers = offers.map((offer) => {
    const product = productData[offer.offerProductId];
    const originalPrice = product ? parseFloat(product.price) : 0;
    let discountedPrice = originalPrice;

    if (offer.discountType === "PERCENTAGE") {
      discountedPrice = originalPrice * (1 - offer.discountValue / 100);
    } else {
      discountedPrice = originalPrice - offer.discountValue;
    }

    return {
      ...offer,
      offerProductTitle: offer.offerTitle || product?.title || "Unknown Product",
      offerProductImage: product?.image || "",
      originalPrice,
      discountedPrice: Math.max(0, discountedPrice),
    };
  });

  const localeSettings = await getLocaleSettings(session.shop);
  const locale = localeSettings?.locale || "en";
  const t = getTranslations(locale);

  return json({
    offers: enrichedOffers,
    products: productsData.data?.products?.edges?.map((e: GraphQLEdge<ShopifyProduct>) => ({
      id: e.node.id,
      title: e.node.title,
      image: e.node.featuredImage?.url,
      price: e.node.priceRangeV2?.minVariantPrice?.amount,
    })) || [],
    stats,
    t,
    locale,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("_action") as string;

  const shop = await getShopByDomain(session.shop);
  if (!shop) {
    return json({ error: "Shop not found" }, { status: 404 });
  }

  try {
    switch (actionType) {
      case "create": {
        const name = formData.get("name") as string;
        const triggerType = formData.get("triggerType") as PPTriggerType;
        const offerProductId = formData.get("offerProductId") as string;
        const discountType = formData.get("discountType") as DiscountType;
        const discountValue = parseFloat(formData.get("discountValue") as string) || 0;
        const minOrderValue = formData.get("minOrderValue") ? parseFloat(formData.get("minOrderValue") as string) : undefined;
        const headline = formData.get("headline") as string;
        const ctaText = formData.get("ctaText") as string;
        const showTimer = formData.get("showTimer") === "true";
        const timerDuration = parseInt(formData.get("timerDuration") as string) || 300;

        await createUpsellOffer({
          shopId: shop.id,
          name,
          triggerType,
          offerProductId,
          discountType,
          discountValue,
          minOrderValue,
          headline,
          ctaText,
          showTimer,
          timerDuration,
        });
        return json({ success: true, message: "Offer created successfully" });
      }

      case "activate": {
        const offerId = formData.get("offerId") as string;
        await updateUpsellStatus(offerId, "ACTIVE");
        return json({ success: true, message: "Offer activated" });
      }

      case "pause": {
        const offerId = formData.get("offerId") as string;
        await updateUpsellStatus(offerId, "PAUSED");
        return json({ success: true, message: "Offer paused" });
      }

      case "delete": {
        const offerId = formData.get("offerId") as string;
        await deleteUpsellOffer(offerId);
        return json({ success: true, message: "Offer deleted" });
      }

      default:
        return json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Upsell action error:", error);
    return json({ error: "Action failed" }, { status: 500 });
  }
};

export default function PostPurchaseUpsells() {
  const { offers, products, stats, t, locale } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<any>(null);

  // Form state
  const [formState, setFormState] = useState({
    name: "",
    triggerType: "ALL_ORDERS",
    triggerMinValue: "",
    offerProductId: "",
    discountType: "PERCENTAGE",
    discountValue: "20",
    headline: "Wait! Special Offer Just For You",
    subheadline: "Add this to your order now and save!",
    ctaText: "Add to Order - One Click",
    declineText: "No thanks",
    showTimer: true,
    timerDuration: "300",
    bgColor: "#ffffff",
    accentColor: "#000000",
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(locale === "en" ? "en-US" : locale, {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    return status === "ACTIVE" ?
      <Badge tone="success">{t.upsellsPage.active}</Badge> :
      <Badge>{t.upsellsPage.draft}</Badge>;
  };

  const handleCreateOffer = () => {
    setSelectedOffer(null);
    setFormState({
      name: "",
      triggerType: "ALL_ORDERS",
      triggerMinValue: "",
      offerProductId: "",
      discountType: "PERCENTAGE",
      discountValue: "20",
      headline: "Wait! Special Offer Just For You",
      subheadline: "Add this to your order now and save!",
      ctaText: "Add to Order - One Click",
      declineText: "No thanks",
      showTimer: true,
      timerDuration: "300",
      bgColor: "#ffffff",
      accentColor: "#000000",
    });
    setShowCreateModal(true);
  };

  return (
    <Page
      title={t.upsellsPage.title}
      subtitle={t.upsellsPage.subtitle}
      primaryAction={{
        content: t.upsellsPage.createUpsell,
        icon: PlusIcon,
        onAction: handleCreateOffer,
      }}
    >
      <BlockStack gap="600">
        {/* Stats Overview */}
        <Layout>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text variant="bodySm" as="span" tone="subdued">{t.upsellsPage.totalImpressions}</Text>
                <Text variant="headingLg" as="h3">{stats.totalImpressions.toLocaleString()}</Text>
                <Text variant="bodySm" as="span" tone="subdued">{t.upsellsPage.offersShown}</Text>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text variant="bodySm" as="span" tone="subdued">{t.upsellsPage.conversions}</Text>
                <Text variant="headingLg" as="h3">{stats.totalConversions}</Text>
                <Text variant="bodySm" as="span" tone="success">{stats.avgConversionRate}% {t.upsellsPage.rate}</Text>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text variant="bodySm" as="span" tone="subdued">{t.upsellsPage.upsellRevenue}</Text>
                <Text variant="headingLg" as="h3" tone="success">
                  {formatCurrency(stats.totalRevenue)}
                </Text>
                <Text variant="bodySm" as="span" tone="subdued">{t.upsellsPage.additionalRevenue}</Text>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text variant="bodySm" as="span" tone="subdued">{t.upsellsPage.activeOffers}</Text>
                <Text variant="headingLg" as="h3">{stats.totalOffers}</Text>
                <Text variant="bodySm" as="span" tone="subdued">{t.upsellsPage.runningNow}</Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Banner */}
        <Banner
          title={t.upsellsPage.bannerTitle}
          tone="info"
        >
          <p>
            {t.upsellsPage.bannerDesc}
          </p>
        </Banner>

        {/* Offers List */}
        {offers.length === 0 ? (
          <Card>
            <EmptyState
              heading={t.upsellsPage.createFirstUpsell}
              action={{
                content: t.upsellsPage.createUpsellOffer,
                onAction: handleCreateOffer,
              }}
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>
                {t.upsellsPage.emptyStateDesc}
              </p>
            </EmptyState>
          </Card>
        ) : (
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">{t.upsellsPage.yourUpsellOffers}</Text>

              {offers.map((offer) => (
                <Box
                  key={offer.id}
                  padding="400"
                  background="bg-surface-secondary"
                  borderRadius="200"
                >
                  <InlineStack align="space-between" blockAlign="start">
                    <InlineStack gap="400" blockAlign="start">
                      <Thumbnail
                        source={offer.offerProductImage}
                        alt={offer.offerProductTitle}
                        size="medium"
                      />

                      <BlockStack gap="200">
                        <InlineStack gap="200" blockAlign="center">
                          <Text variant="headingSm" as="h3">{offer.name}</Text>
                          {getStatusBadge(offer.status)}
                        </InlineStack>

                        <Text variant="bodyMd" as="span">{offer.offerProductTitle}</Text>

                        <InlineStack gap="200">
                          <Badge>{`${offer.discountValue}% off`}</Badge>
                          <Text variant="bodySm" as="span" tone="subdued">
                            {formatCurrency(offer.originalPrice)} → {formatCurrency(offer.discountedPrice)}
                          </Text>
                        </InlineStack>

                        <InlineStack gap="100" blockAlign="center">
                          <Icon source={TargetIcon} tone="subdued" />
                          <Text variant="bodySm" as="span" tone="subdued">
                            {offer.triggerType === "ALL_ORDERS" ? t.upsellsPage.allOrders : t.upsellsPage.specificProducts}
                          </Text>
                        </InlineStack>
                      </BlockStack>
                    </InlineStack>

                    {/* Stats */}
                    <InlineStack gap="600">
                      <BlockStack gap="100">
                        <Text variant="bodySm" as="span" tone="subdued">{t.upsellsPage.impressions}</Text>
                        <Text variant="headingSm" as="p">{offer.impressions.toLocaleString()}</Text>
                      </BlockStack>

                      <BlockStack gap="100">
                        <Text variant="bodySm" as="span" tone="subdued">{t.upsellsPage.conversions}</Text>
                        <Text variant="headingSm" as="p">{offer.conversions}</Text>
                      </BlockStack>

                      <BlockStack gap="100">
                        <Text variant="bodySm" as="span" tone="subdued">{t.upsellsPage.conversionRate}</Text>
                        <Text variant="headingSm" as="p" tone="success">{offer.conversionRate}%</Text>
                      </BlockStack>

                      <BlockStack gap="100">
                        <Text variant="bodySm" as="span" tone="subdued">{t.upsellsPage.revenue}</Text>
                        <Text variant="headingSm" as="p" tone="success">
                          {formatCurrency(offer.revenue)}
                        </Text>
                      </BlockStack>

                      <InlineStack gap="200">
                        <Button icon={EditIcon} size="slim" onClick={() => {}}>{t.upsellsPage.edit}</Button>
                        <Button icon={DeleteIcon} size="slim" tone="critical" onClick={() => {}}>{t.upsellsPage.delete}</Button>
                      </InlineStack>
                    </InlineStack>
                  </InlineStack>
                </Box>
              ))}
            </BlockStack>
          </Card>
        )}

        {/* Create/Edit Modal */}
        <Modal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title={selectedOffer ? t.upsellsPage.editUpsellOffer : t.upsellsPage.createUpsellOffer}
          primaryAction={{
            content: selectedOffer ? t.upsellsPage.saveChanges : t.upsellsPage.createOffer,
            onAction: () => {
              setShowCreateModal(false);
            },
          }}
          secondaryActions={[
            {
              content: t.upsellsPage.cancel,
              onAction: () => setShowCreateModal(false),
            },
          ]}
          size="large"
        >
          <Modal.Section>
            <BlockStack gap="500">
              {/* Basic Info */}
              <Text variant="headingSm" as="h3">{t.upsellsPage.basicInformation}</Text>

              <TextField
                label={t.upsellsPage.offerName}
                value={formState.name}
                onChange={(value) => setFormState({ ...formState, name: value })}
                placeholder={t.upsellsPage.offerNamePlaceholder}
                autoComplete="off"
                helpText={t.upsellsPage.offerNameHelp}
              />

              <Divider />

              {/* Trigger */}
              <Text variant="headingSm" as="h3">{t.upsellsPage.whenToShow}</Text>

              <Select
                label={t.upsellsPage.triggerType}
                options={[
                  { label: t.upsellsPage.allOrdersTrigger, value: "ALL_ORDERS" },
                  { label: t.upsellsPage.minOrderValueTrigger, value: "MIN_ORDER_VALUE" },
                  { label: t.upsellsPage.specificProductsTrigger, value: "SPECIFIC_PRODUCTS" },
                  { label: t.upsellsPage.firstTimeBuyers, value: "FIRST_TIME_BUYERS" },
                  { label: t.upsellsPage.returningCustomers, value: "RETURNING_CUSTOMERS" },
                ]}
                value={formState.triggerType}
                onChange={(value) => setFormState({ ...formState, triggerType: value })}
              />

              {formState.triggerType === "MIN_ORDER_VALUE" && (
                <TextField
                  label={t.upsellsPage.minimumOrderValue}
                  type="number"
                  value={formState.triggerMinValue}
                  onChange={(value) => setFormState({ ...formState, triggerMinValue: value })}
                  prefix="$"
                  autoComplete="off"
                />
              )}

              <Divider />

              {/* Offer Product */}
              <Text variant="headingSm" as="h3">{t.upsellsPage.whatToOffer}</Text>

              <Select
                label={t.upsellsPage.productToOffer}
                options={[
                  { label: t.upsellsPage.selectProduct, value: "" },
                  ...products.map((p: { id: string; title: string; price: string }) => ({
                    label: `${p.title} - $${parseFloat(p.price).toFixed(2)}`,
                    value: p.id,
                  })),
                ]}
                value={formState.offerProductId}
                onChange={(value) => setFormState({ ...formState, offerProductId: value })}
              />

              <FormLayout>
                <FormLayout.Group>
                  <Select
                    label={t.upsellsPage.discountType}
                    options={[
                      { label: t.upsellsPage.percentageOff, value: "PERCENTAGE" },
                      { label: t.upsellsPage.fixedAmountOff, value: "FIXED_AMOUNT" },
                    ]}
                    value={formState.discountType}
                    onChange={(value) => setFormState({ ...formState, discountType: value })}
                  />
                  <TextField
                    label={t.upsellsPage.discountValue}
                    type="number"
                    value={formState.discountValue}
                    onChange={(value) => setFormState({ ...formState, discountValue: value })}
                    suffix={formState.discountType === "PERCENTAGE" ? "%" : "$"}
                    autoComplete="off"
                  />
                </FormLayout.Group>
              </FormLayout>

              <Divider />

              {/* Copy */}
              <Text variant="headingSm" as="h3">{t.upsellsPage.displayText}</Text>

              <TextField
                label={t.upsellsPage.headline}
                value={formState.headline}
                onChange={(value) => setFormState({ ...formState, headline: value })}
                autoComplete="off"
              />

              <TextField
                label={t.upsellsPage.subheadline}
                value={formState.subheadline}
                onChange={(value) => setFormState({ ...formState, subheadline: value })}
                autoComplete="off"
              />

              <FormLayout>
                <FormLayout.Group>
                  <TextField
                    label={t.upsellsPage.ctaButtonText}
                    value={formState.ctaText}
                    onChange={(value) => setFormState({ ...formState, ctaText: value })}
                    autoComplete="off"
                  />
                  <TextField
                    label={t.upsellsPage.declineText}
                    value={formState.declineText}
                    onChange={(value) => setFormState({ ...formState, declineText: value })}
                    autoComplete="off"
                  />
                </FormLayout.Group>
              </FormLayout>

              <Divider />

              {/* Timer */}
              <Text variant="headingSm" as="h3">{t.upsellsPage.urgencyTimer}</Text>

              <Checkbox
                label={t.upsellsPage.showCountdownTimer}
                checked={formState.showTimer}
                onChange={(value) => setFormState({ ...formState, showTimer: value })}
                helpText={t.upsellsPage.timerHelp}
              />

              {formState.showTimer && (
                <TextField
                  label={t.upsellsPage.timerDuration}
                  type="number"
                  value={formState.timerDuration}
                  onChange={(value) => setFormState({ ...formState, timerDuration: value })}
                  helpText={t.upsellsPage.timerDurationHelp}
                  autoComplete="off"
                />
              )}

              <Banner tone="info">
                <p>
                  <strong>{t.upsellsPage.tipTitle}:</strong> {t.upsellsPage.tipDesc}
                </p>
              </Banner>
            </BlockStack>
          </Modal.Section>
        </Modal>
      </BlockStack>
    </Page>
  );
}
