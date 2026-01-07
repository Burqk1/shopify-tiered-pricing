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
import { getShopByDomain } from "~/models/shop.server";
import { getUpsellOffers, getUpsellStats, createUpsellOffer, updateUpsellOffer, updateUpsellStatus, deleteUpsellOffer } from "~/models/upsell.server";
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

  return json({
    offers: enrichedOffers,
    products: productsData.data?.products?.edges?.map((e: GraphQLEdge<ShopifyProduct>) => ({
      id: e.node.id,
      title: e.node.title,
      image: e.node.featuredImage?.url,
      price: e.node.priceRangeV2?.minVariantPrice?.amount,
    })) || [],
    stats,
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
  const { offers, products, stats } = useLoaderData<typeof loader>();
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
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    return status === "ACTIVE" ?
      <Badge tone="success">Active</Badge> :
      <Badge>Draft</Badge>;
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
      title="Post-Purchase Upsells"
      subtitle="One-click offers shown after checkout to increase order value"
      primaryAction={{
        content: "Create Upsell",
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
                <Text variant="bodySm" as="span" tone="subdued">Total Impressions</Text>
                <Text variant="headingLg" as="h3">{stats.totalImpressions.toLocaleString()}</Text>
                <Text variant="bodySm" as="span" tone="subdued">Offers shown</Text>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text variant="bodySm" as="span" tone="subdued">Conversions</Text>
                <Text variant="headingLg" as="h3">{stats.totalConversions}</Text>
                <Text variant="bodySm" as="span" tone="success">{stats.avgConversionRate}% rate</Text>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text variant="bodySm" as="span" tone="subdued">Upsell Revenue</Text>
                <Text variant="headingLg" as="h3" tone="success">
                  {formatCurrency(stats.totalRevenue)}
                </Text>
                <Text variant="bodySm" as="span" tone="subdued">Additional revenue</Text>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text variant="bodySm" as="span" tone="subdued">Active Offers</Text>
                <Text variant="headingLg" as="h3">{stats.totalOffers}</Text>
                <Text variant="bodySm" as="span" tone="subdued">Running now</Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Banner */}
        <Banner
          title="Boost your revenue with post-purchase upsells"
          tone="info"
        >
          <p>
            Post-purchase upsells have a 10-15% conversion rate on average because
            customers have already committed to buying. No extra payment entry needed!
          </p>
        </Banner>

        {/* Offers List */}
        {offers.length === 0 ? (
          <Card>
            <EmptyState
              heading="Create your first post-purchase upsell"
              action={{
                content: "Create Upsell Offer",
                onAction: handleCreateOffer,
              }}
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>
                Show special offers to customers right after they complete checkout.
                One-click add to order means no friction and higher conversions.
              </p>
            </EmptyState>
          </Card>
        ) : (
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Your Upsell Offers</Text>

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
                            {offer.triggerType === "ALL_ORDERS" ? "All orders" : "Specific products"}
                          </Text>
                        </InlineStack>
                      </BlockStack>
                    </InlineStack>

                    {/* Stats */}
                    <InlineStack gap="600">
                      <BlockStack gap="100">
                        <Text variant="bodySm" as="span" tone="subdued">Impressions</Text>
                        <Text variant="headingSm" as="p">{offer.impressions.toLocaleString()}</Text>
                      </BlockStack>

                      <BlockStack gap="100">
                        <Text variant="bodySm" as="span" tone="subdued">Conversions</Text>
                        <Text variant="headingSm" as="p">{offer.conversions}</Text>
                      </BlockStack>

                      <BlockStack gap="100">
                        <Text variant="bodySm" as="span" tone="subdued">Rate</Text>
                        <Text variant="headingSm" as="p" tone="success">{offer.conversionRate}%</Text>
                      </BlockStack>

                      <BlockStack gap="100">
                        <Text variant="bodySm" as="span" tone="subdued">Revenue</Text>
                        <Text variant="headingSm" as="p" tone="success">
                          {formatCurrency(offer.revenue)}
                        </Text>
                      </BlockStack>

                      <InlineStack gap="200">
                        <Button icon={EditIcon} size="slim" onClick={() => {}}>Edit</Button>
                        <Button icon={DeleteIcon} size="slim" tone="critical" onClick={() => {}}>Delete</Button>
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
          title={selectedOffer ? "Edit Upsell Offer" : "Create Upsell Offer"}
          primaryAction={{
            content: selectedOffer ? "Save Changes" : "Create Offer",
            onAction: () => {
              setShowCreateModal(false);
            },
          }}
          secondaryActions={[
            {
              content: "Cancel",
              onAction: () => setShowCreateModal(false),
            },
          ]}
          size="large"
        >
          <Modal.Section>
            <BlockStack gap="500">
              {/* Basic Info */}
              <Text variant="headingSm" as="h3">Basic Information</Text>

              <TextField
                label="Offer Name"
                value={formState.name}
                onChange={(value) => setFormState({ ...formState, name: value })}
                placeholder="e.g., Premium Belt Upsell"
                autoComplete="off"
                helpText="Internal name to identify this offer"
              />

              <Divider />

              {/* Trigger */}
              <Text variant="headingSm" as="h3">When to Show</Text>

              <Select
                label="Trigger Type"
                options={[
                  { label: "All Orders", value: "ALL_ORDERS" },
                  { label: "Orders Above Minimum Value", value: "MIN_ORDER_VALUE" },
                  { label: "Orders with Specific Products", value: "SPECIFIC_PRODUCTS" },
                  { label: "First-Time Buyers Only", value: "FIRST_TIME_BUYERS" },
                  { label: "Returning Customers Only", value: "RETURNING_CUSTOMERS" },
                ]}
                value={formState.triggerType}
                onChange={(value) => setFormState({ ...formState, triggerType: value })}
              />

              {formState.triggerType === "MIN_ORDER_VALUE" && (
                <TextField
                  label="Minimum Order Value"
                  type="number"
                  value={formState.triggerMinValue}
                  onChange={(value) => setFormState({ ...formState, triggerMinValue: value })}
                  prefix="$"
                  autoComplete="off"
                />
              )}

              <Divider />

              {/* Offer Product */}
              <Text variant="headingSm" as="h3">What to Offer</Text>

              <Select
                label="Product to Offer"
                options={[
                  { label: "Select a product...", value: "" },
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
                    label="Discount Type"
                    options={[
                      { label: "Percentage Off", value: "PERCENTAGE" },
                      { label: "Fixed Amount Off", value: "FIXED_AMOUNT" },
                    ]}
                    value={formState.discountType}
                    onChange={(value) => setFormState({ ...formState, discountType: value })}
                  />
                  <TextField
                    label="Discount Value"
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
              <Text variant="headingSm" as="h3">Display Text</Text>

              <TextField
                label="Headline"
                value={formState.headline}
                onChange={(value) => setFormState({ ...formState, headline: value })}
                autoComplete="off"
              />

              <TextField
                label="Subheadline"
                value={formState.subheadline}
                onChange={(value) => setFormState({ ...formState, subheadline: value })}
                autoComplete="off"
              />

              <FormLayout>
                <FormLayout.Group>
                  <TextField
                    label="CTA Button Text"
                    value={formState.ctaText}
                    onChange={(value) => setFormState({ ...formState, ctaText: value })}
                    autoComplete="off"
                  />
                  <TextField
                    label="Decline Text"
                    value={formState.declineText}
                    onChange={(value) => setFormState({ ...formState, declineText: value })}
                    autoComplete="off"
                  />
                </FormLayout.Group>
              </FormLayout>

              <Divider />

              {/* Timer */}
              <Text variant="headingSm" as="h3">Urgency Timer</Text>

              <Checkbox
                label="Show countdown timer"
                checked={formState.showTimer}
                onChange={(value) => setFormState({ ...formState, showTimer: value })}
                helpText="Creates urgency and increases conversions"
              />

              {formState.showTimer && (
                <TextField
                  label="Timer Duration (seconds)"
                  type="number"
                  value={formState.timerDuration}
                  onChange={(value) => setFormState({ ...formState, timerDuration: value })}
                  helpText="5 minutes (300 seconds) is recommended"
                  autoComplete="off"
                />
              )}

              <Banner tone="info">
                <p>
                  <strong>Tip:</strong> Keep your offer simple and valuable. A 20-30% discount
                  on a complementary product works best. Customers appreciate offers that
                  genuinely add value to their purchase.
                </p>
              </Banner>
            </BlockStack>
          </Modal.Section>
        </Modal>
      </BlockStack>
    </Page>
  );
}
