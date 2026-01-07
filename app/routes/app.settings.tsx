/**
 * Settings Route (app.settings.tsx)
 *
 * Plan management, billing, and app settings.
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useActionData, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Badge,
  Banner,
  Divider,
  Box,
  List,
  Checkbox,
  Modal,
} from "@shopify/polaris";
import { CheckIcon } from "@shopify/polaris-icons";

import { authenticate } from "~/shopify.server";
import { getShopByDomain, getPlanFeatures, getPOSSettings, updatePOSSettings } from "~/models/shop.server";
import {
  PLANS,
  createSubscription,
  getSubscriptionStatus,
  cancelSubscription,
} from "~/services/billing.server";
import { getSyncStats } from "~/models/sync-log.server";
import type { Plan } from "@prisma/client";
import { useState, useCallback } from "react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

  const shop = await getShopByDomain(session.shop);
  if (!shop) {
    throw new Response("Shop not found", { status: 404 });
  }

  const [subscriptionStatus, syncStats, posSettings] = await Promise.all([
    getSubscriptionStatus(admin, session.shop),
    getSyncStats(shop.id),
    getPOSSettings(session.shop),
  ]);

  const planFeatures = getPlanFeatures(shop.plan);

  return json({
    shop: {
      domain: session.shop,
      name: shop.shopName,
      email: shop.email,
      plan: shop.plan,
    },
    subscription: subscriptionStatus,
    planFeatures,
    syncStats,
    plans: PLANS,
    posSettings: posSettings || {
      posEnabled: true,
      posShowTierInfo: true,
      posStaffOverride: false,
    },
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("action");

  switch (action) {
    case "upgrade": {
      const plan = formData.get("plan") as "GROWTH" | "PROFESSIONAL";
      const returnUrl = `${process.env.SHOPIFY_APP_URL}/app/settings?upgraded=true`;

      const result = await createSubscription(admin, session.shop, plan, returnUrl);

      if ("error" in result) {
        return json({ error: result.error }, { status: 400 });
      }

      return json({ confirmationUrl: result.confirmationUrl });
    }

    case "cancel": {
      const result = await cancelSubscription(admin, session.shop);

      if (!result.success) {
        return json({ error: result.error }, { status: 400 });
      }

      return json({ success: true, message: "Subscription cancelled" });
    }

    case "updatePOS": {
      const posEnabled = formData.get("posEnabled") === "true";
      const posShowTierInfo = formData.get("posShowTierInfo") === "true";
      const posStaffOverride = formData.get("posStaffOverride") === "true";

      await updatePOSSettings(session.shop, {
        posEnabled,
        posShowTierInfo,
        posStaffOverride,
      });

      return json({ success: true, message: "POS settings updated" });
    }

    default:
      return json({ error: "Unknown action" }, { status: 400 });
  }
};

export default function Settings() {
  const { shop, subscription, planFeatures, syncStats, plans, posSettings } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const navigate = useNavigate();

  // Cancel subscription modal state
  const [cancelModalOpen, setCancelModalOpen] = useState(false);

  const handleUpgrade = (plan: "GROWTH" | "PROFESSIONAL") => {
    submit({ action: "upgrade", plan }, { method: "POST" });
  };

  const handleCancel = () => {
    setCancelModalOpen(false);
    submit({ action: "cancel" }, { method: "POST" });
  };

  // POS Settings state
  const [posEnabled, setPosEnabled] = useState(posSettings.posEnabled);
  const [posShowTierInfo, setPosShowTierInfo] = useState(posSettings.posShowTierInfo);
  const [posStaffOverride, setPosStaffOverride] = useState(posSettings.posStaffOverride);

  const handlePOSSave = useCallback(() => {
    submit(
      {
        action: "updatePOS",
        posEnabled: String(posEnabled),
        posShowTierInfo: String(posShowTierInfo),
        posStaffOverride: String(posStaffOverride),
      },
      { method: "POST" }
    );
  }, [submit, posEnabled, posShowTierInfo, posStaffOverride]);

  // Redirect to Shopify billing page if we got a confirmation URL
  if (actionData && "confirmationUrl" in actionData) {
    window.top!.location.href = actionData.confirmationUrl;
    return null;
  }

  const getPlanBadge = (planName: Plan) => {
    if (planName === shop.plan) {
      return <Badge tone="success">Current Plan</Badge>;
    }
    if (planName === "FREE") {
      return <Badge>Free</Badge>;
    }
    return null;
  };

  return (
    <Page title="Settings" backAction={{ content: "Dashboard", url: "/app" }}>
      <BlockStack gap="500">
        {actionData && "error" in actionData && actionData.error && (
          <Banner tone="critical" title="Error">
            <p>{actionData.error}</p>
          </Banner>
        )}

        {actionData && "success" in actionData && actionData.success && "message" in actionData && (
          <Banner tone="success">
            <p>{actionData.message}</p>
          </Banner>
        )}

        {/* Current Plan */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text variant="headingMd" as="h2">
                    Current Plan
                  </Text>
                  <Badge tone="info">{shop.plan}</Badge>
                </InlineStack>

                <BlockStack gap="200">
                  <Text variant="bodyMd" as="p">
                    <strong>Rule Limit:</strong>{" "}
                    {planFeatures.ruleLimit === "unlimited"
                      ? "Unlimited"
                      : planFeatures.ruleLimit}
                  </Text>
                  <Text variant="bodyMd" as="p">
                    <strong>Customer Tags:</strong>{" "}
                    {planFeatures.customerTags ? "Enabled" : "Disabled"}
                  </Text>
                  <Text variant="bodyMd" as="p">
                    <strong>CSS Editor:</strong>{" "}
                    {planFeatures.cssEditor ? "Enabled" : "Disabled"}
                  </Text>
                </BlockStack>

                {shop.plan !== "FREE" && (
                  <Button tone="critical" onClick={() => setCancelModalOpen(true)}>
                    Cancel Subscription
                  </Button>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Plan Comparison */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  Available Plans
                </Text>

                <Layout>
                  {/* Free Plan */}
                  <Layout.Section variant="oneThird">
                    <Box
                      padding="400"
                      background="bg-surface-secondary"
                      borderRadius="200"
                    >
                      <BlockStack gap="300">
                        <InlineStack align="space-between">
                          <Text variant="headingSm" as="h3">
                            Free
                          </Text>
                          {getPlanBadge("FREE")}
                        </InlineStack>
                        <Text variant="headingLg" as="p">
                          $0<Text variant="bodySm" as="span">/month</Text>
                        </Text>
                        <List>
                          {plans.FREE.features.map((feature, i) => (
                            <List.Item key={i}>{feature}</List.Item>
                          ))}
                        </List>
                        {shop.plan !== "FREE" && (
                          <Button disabled>Current Plan</Button>
                        )}
                      </BlockStack>
                    </Box>
                  </Layout.Section>

                  {/* Growth Plan */}
                  <Layout.Section variant="oneThird">
                    <Box
                      padding="400"
                      background="bg-surface-secondary"
                      borderRadius="200"
                      borderColor="border-info"
                      borderWidth="025"
                    >
                      <BlockStack gap="300">
                        <InlineStack align="space-between">
                          <Text variant="headingSm" as="h3">
                            Growth
                          </Text>
                          {getPlanBadge("GROWTH")}
                        </InlineStack>
                        <Text variant="headingLg" as="p">
                          ${plans.GROWTH.price}
                          <Text variant="bodySm" as="span">/month</Text>
                        </Text>
                        <List>
                          {plans.GROWTH.features.map((feature, i) => (
                            <List.Item key={i}>{feature}</List.Item>
                          ))}
                        </List>
                        {shop.plan === "GROWTH" ? (
                          <Button disabled>Current Plan</Button>
                        ) : shop.plan === "PROFESSIONAL" ? (
                          <Button disabled>Downgrade</Button>
                        ) : (
                          <Button
                            variant="primary"
                            onClick={() => handleUpgrade("GROWTH")}
                          >
                            Upgrade to Growth
                          </Button>
                        )}
                      </BlockStack>
                    </Box>
                  </Layout.Section>

                  {/* Professional Plan */}
                  <Layout.Section variant="oneThird">
                    <Box
                      padding="400"
                      background="bg-surface-secondary"
                      borderRadius="200"
                      borderColor="border-success"
                      borderWidth="025"
                    >
                      <BlockStack gap="300">
                        <InlineStack align="space-between" wrap>
                          <Text variant="headingSm" as="h3">
                            Professional
                          </Text>
                          {getPlanBadge("PROFESSIONAL")}
                          <Badge tone="attention">Best Value</Badge>
                        </InlineStack>
                        <Text variant="headingLg" as="p">
                          ${plans.PROFESSIONAL.price}
                          <Text variant="bodySm" as="span">/month</Text>
                        </Text>
                        <List>
                          {plans.PROFESSIONAL.features.map((feature, i) => (
                            <List.Item key={i}>{feature}</List.Item>
                          ))}
                        </List>
                        {shop.plan === "PROFESSIONAL" ? (
                          <Button disabled>Current Plan</Button>
                        ) : (
                          <Button
                            variant="primary"
                            tone="success"
                            onClick={() => handleUpgrade("PROFESSIONAL")}
                          >
                            Upgrade to Pro
                          </Button>
                        )}
                      </BlockStack>
                    </Box>
                  </Layout.Section>
                </Layout>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Sync Statistics */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd" as="h2">
                  Sync Statistics
                </Text>
                <InlineStack gap="400">
                  <BlockStack gap="100">
                    <Text variant="bodySm" tone="subdued" as="p">
                      Total Syncs
                    </Text>
                    <Text variant="headingLg" as="p">
                      {syncStats.totalSyncs}
                    </Text>
                  </BlockStack>
                  <BlockStack gap="100">
                    <Text variant="bodySm" tone="subdued" as="p">
                      Success Rate
                    </Text>
                    <Text variant="headingLg" as="p">
                      {syncStats.totalSyncs > 0
                        ? `${Math.round(
                            (syncStats.successCount / syncStats.totalSyncs) * 100
                          )}%`
                        : "N/A"}
                    </Text>
                  </BlockStack>
                  <BlockStack gap="100">
                    <Text variant="bodySm" tone="subdued" as="p">
                      Last Sync
                    </Text>
                    <Text variant="headingLg" as="p">
                      {syncStats.lastSync
                        ? new Date(syncStats.lastSync).toLocaleDateString()
                        : "Never"}
                    </Text>
                  </BlockStack>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* POS Settings */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text variant="headingMd" as="h2">
                    POS Integration
                  </Text>
                  <Badge tone="success">Available</Badge>
                </InlineStack>

                <Text variant="bodyMd" tone="subdued" as="p">
                  Configure how tiered pricing works with Shopify POS for in-store sales.
                </Text>

                <BlockStack gap="300">
                  <Checkbox
                    label="Enable POS Integration"
                    helpText="Apply volume discounts when selling through Shopify POS"
                    checked={posEnabled}
                    onChange={setPosEnabled}
                  />

                  <Checkbox
                    label="Show Tier Information"
                    helpText="Display pricing tiers to staff on POS device"
                    checked={posShowTierInfo}
                    onChange={setPosShowTierInfo}
                    disabled={!posEnabled}
                  />

                  <Checkbox
                    label="Allow Staff Override"
                    helpText="Let staff manually adjust discounts at checkout"
                    checked={posStaffOverride}
                    onChange={setPosStaffOverride}
                    disabled={!posEnabled}
                  />
                </BlockStack>

                <Button onClick={handlePOSSave}>
                  Save POS Settings
                </Button>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Shop Info */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd" as="h2">
                  Shop Information
                </Text>
                <BlockStack gap="100">
                  <Text variant="bodyMd" as="p">
                    <strong>Domain:</strong> {shop.domain}
                  </Text>
                  {shop.name && (
                    <Text variant="bodyMd" as="p">
                      <strong>Name:</strong> {shop.name}
                    </Text>
                  )}
                  {shop.email && (
                    <Text variant="bodyMd" as="p">
                      <strong>Email:</strong> {shop.email}
                    </Text>
                  )}
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>

      {/* Cancel Subscription Modal */}
      <Modal
        open={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        title="Cancel Subscription?"
        primaryAction={{
          content: "Cancel Subscription",
          onAction: handleCancel,
          destructive: true,
        }}
        secondaryActions={[
          {
            content: "Keep Subscription",
            onAction: () => setCancelModalOpen(false),
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="200">
            <Text as="p" variant="bodyMd">
              Are you sure you want to cancel your subscription? You will be downgraded to the Free plan.
            </Text>
            <Text as="p" variant="bodyMd" tone="subdued">
              Your current features will remain active until the end of your billing period.
            </Text>
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
