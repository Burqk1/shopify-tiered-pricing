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
  Box,
  List,
  Checkbox,
  Modal,
  Select,
} from "@shopify/polaris";

import { authenticate } from "~/shopify.server";
import {
  getShopByDomain,
  getPlanFeatures,
  getPOSSettings,
  updatePOSSettings,
  getLocaleSettings,
  updateLocaleSettings,
  SUPPORTED_LOCALES,
} from "~/models/shop.server";
import {
  PLANS,
  createSubscription,
  getSubscriptionStatus,
  cancelSubscription,
  hasFeatureAccess,
} from "~/services/billing.server";
import { getSyncStats } from "~/models/sync-log.server";
import { getTranslations } from "~/i18n";
import type { Plan } from "@prisma/client";
import { useState, useCallback } from "react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

  const shop = await getShopByDomain(session.shop);
  if (!shop) {
    throw new Response("Shop not found", { status: 404 });
  }

  const [subscriptionStatus, syncStats, posSettings, localeSettings] = await Promise.all([
    getSubscriptionStatus(admin, session.shop),
    getSyncStats(shop.id),
    getPOSSettings(session.shop),
    getLocaleSettings(session.shop),
  ]);

  const planFeatures = getPlanFeatures(shop.plan);
  const locale = localeSettings?.locale || "en";
  const t = getTranslations(locale);

  // Check feature access based on plan
  const featureAccess = {
    posIntegration: hasFeatureAccess(shop.plan, "posIntegration"),
    cssEditor: hasFeatureAccess(shop.plan, "cssEditor"),
    customerTags: hasFeatureAccess(shop.plan, "customerTags"),
    multiLanguage: hasFeatureAccess(shop.plan, "multiLanguage"),
    aiPricing: hasFeatureAccess(shop.plan, "aiPricing"),
    multiCurrency: hasFeatureAccess(shop.plan, "multiCurrency"),
    apiAccess: hasFeatureAccess(shop.plan, "apiAccess"),
  };

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
    localeSettings: localeSettings || { locale: "en" },
    supportedLocales: SUPPORTED_LOCALES,
    featureAccess,
    t,
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

    case "updateLocale": {
      const locale = formData.get("locale") as string;

      if (!locale) {
        return json({ error: "Locale is required" }, { status: 400 });
      }

      await updateLocaleSettings(session.shop, locale);

      return json({ success: true, message: "Language updated successfully", reload: true });
    }

    default:
      return json({ error: "Unknown action" }, { status: 400 });
  }
};

export default function Settings() {
  const { shop, planFeatures, syncStats, plans, posSettings, localeSettings, supportedLocales, featureAccess, t } =
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

  // Language Settings state
  const [selectedLocale, setSelectedLocale] = useState(localeSettings.locale);

  const handleLocaleSave = useCallback(() => {
    submit(
      {
        action: "updateLocale",
        locale: selectedLocale,
      },
      { method: "POST" }
    );
  }, [submit, selectedLocale]);

  const localeOptions = supportedLocales.map((locale: { code: string; name: string; flag: string }) => ({
    label: `${locale.flag} ${locale.name}`,
    value: locale.code,
  }));

  // Redirect to Shopify billing page if we got a confirmation URL
  if (actionData && "confirmationUrl" in actionData) {
    window.top!.location.href = actionData.confirmationUrl;
    return null;
  }

  // Reload page when language is updated
  if (actionData && "reload" in actionData && actionData.reload) {
    window.location.reload();
  }

  const getPlanBadge = (planName: Plan) => {
    if (planName === shop.plan) {
      return <Badge tone="success">{t.settings.currentPlanBadge}</Badge>;
    }
    if (planName === "FREE") {
      return <Badge>{t.settings.free}</Badge>;
    }
    return null;
  };

  return (
    <Page title={t.settings.title} backAction={{ content: t.settings.backToDashboard, url: "/app" }}>
      <BlockStack gap="500">
        {actionData && "error" in actionData && actionData.error && (
          <Banner tone="critical" title={t.common.error}>
            <p>{actionData.error}</p>
          </Banner>
        )}

        {actionData && "success" in actionData && actionData.success && "message" in actionData && !("reload" in actionData) && (
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
                    {t.settings.currentPlan}
                  </Text>
                  <Badge tone="info">{shop.plan}</Badge>
                </InlineStack>

                <BlockStack gap="200">
                  <Text variant="bodyMd" as="p">
                    <strong>{t.settings.ruleLimit}:</strong>{" "}
                    {planFeatures.ruleLimit === "unlimited"
                      ? t.dashboard.unlimited
                      : planFeatures.ruleLimit}
                  </Text>
                  <Text variant="bodyMd" as="p">
                    <strong>{t.settings.customerTags}:</strong>{" "}
                    {planFeatures.customerTags ? t.settings.enabled : t.settings.disabled}
                  </Text>
                  <Text variant="bodyMd" as="p">
                    <strong>{t.settings.cssEditor}:</strong>{" "}
                    {planFeatures.cssEditor ? t.settings.enabled : t.settings.disabled}
                  </Text>
                </BlockStack>

                {shop.plan !== "FREE" && (
                  <Button tone="critical" onClick={() => setCancelModalOpen(true)}>
                    {t.settings.cancelSubscription}
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
                  {t.settings.availablePlans}
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
                            {t.settings.free}
                          </Text>
                          {getPlanBadge("FREE")}
                        </InlineStack>
                        <Text variant="headingLg" as="p">
                          $0<Text variant="bodySm" as="span">{t.settings.perMonth}</Text>
                        </Text>
                        <List>
                          {plans.FREE.features.map((feature, i) => (
                            <List.Item key={i}>{feature}</List.Item>
                          ))}
                        </List>
                        {shop.plan !== "FREE" && (
                          <Button disabled>{t.settings.currentPlanBadge}</Button>
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
                            {t.settings.growth}
                          </Text>
                          {getPlanBadge("GROWTH")}
                        </InlineStack>
                        <Text variant="headingLg" as="p">
                          ${plans.GROWTH.price}
                          <Text variant="bodySm" as="span">{t.settings.perMonth}</Text>
                        </Text>
                        <List>
                          {plans.GROWTH.features.map((feature, i) => (
                            <List.Item key={i}>{feature}</List.Item>
                          ))}
                        </List>
                        {shop.plan === "GROWTH" ? (
                          <Button disabled>{t.settings.currentPlanBadge}</Button>
                        ) : shop.plan === "PROFESSIONAL" ? (
                          <Button disabled>{t.settings.downgrade}</Button>
                        ) : (
                          <Button
                            variant="primary"
                            onClick={() => handleUpgrade("GROWTH")}
                          >
                            {t.settings.upgradeToGrowth}
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
                            {t.settings.professional}
                          </Text>
                          {getPlanBadge("PROFESSIONAL")}
                          <Badge tone="attention">{t.settings.bestValue}</Badge>
                        </InlineStack>
                        <Text variant="headingLg" as="p">
                          ${plans.PROFESSIONAL.price}
                          <Text variant="bodySm" as="span">{t.settings.perMonth}</Text>
                        </Text>
                        <List>
                          {plans.PROFESSIONAL.features.map((feature, i) => (
                            <List.Item key={i}>{feature}</List.Item>
                          ))}
                        </List>
                        {shop.plan === "PROFESSIONAL" ? (
                          <Button disabled>{t.settings.currentPlanBadge}</Button>
                        ) : (
                          <Button
                            variant="primary"
                            tone="success"
                            onClick={() => handleUpgrade("PROFESSIONAL")}
                          >
                            {t.settings.upgradeToPro}
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
                  {t.settings.syncStatistics}
                </Text>
                <InlineStack gap="400">
                  <BlockStack gap="100">
                    <Text variant="bodySm" tone="subdued" as="p">
                      {t.settings.totalSyncs}
                    </Text>
                    <Text variant="headingLg" as="p">
                      {syncStats.totalSyncs}
                    </Text>
                  </BlockStack>
                  <BlockStack gap="100">
                    <Text variant="bodySm" tone="subdued" as="p">
                      {t.settings.successRate}
                    </Text>
                    <Text variant="headingLg" as="p">
                      {syncStats.totalSyncs > 0
                        ? `${Math.round(
                            (syncStats.successCount / syncStats.totalSyncs) * 100
                          )}%`
                        : t.settings.na}
                    </Text>
                  </BlockStack>
                  <BlockStack gap="100">
                    <Text variant="bodySm" tone="subdued" as="p">
                      {t.settings.lastSync}
                    </Text>
                    <Text variant="headingLg" as="p">
                      {syncStats.lastSync
                        ? new Date(syncStats.lastSync).toLocaleDateString()
                        : t.settings.never}
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
                    {t.settings.posIntegration}
                  </Text>
                  <Badge tone="success">{t.settings.posAvailable}</Badge>
                </InlineStack>

                <Text variant="bodyMd" tone="subdued" as="p">
                  {t.settings.posDescription}
                </Text>

                <BlockStack gap="300">
                  <Checkbox
                    label={t.settings.posEnable}
                    helpText={t.settings.posEnableHelp}
                    checked={posEnabled}
                    onChange={setPosEnabled}
                  />

                  <Checkbox
                    label={t.settings.posShowTierInfo}
                    helpText={t.settings.posShowTierInfoHelp}
                    checked={posShowTierInfo}
                    onChange={setPosShowTierInfo}
                    disabled={!posEnabled}
                  />

                  <Checkbox
                    label={t.settings.posStaffOverride}
                    helpText={t.settings.posStaffOverrideHelp}
                    checked={posStaffOverride}
                    onChange={setPosStaffOverride}
                    disabled={!posEnabled}
                  />
                </BlockStack>

                <Button onClick={handlePOSSave}>
                  {t.settings.savePosSettings}
                </Button>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Language Settings */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  {t.settings.language}
                </Text>

                <Text variant="bodyMd" tone="subdued" as="p">
                  {t.settings.languageDescription}
                </Text>

                <Select
                  label={t.settings.appLanguage}
                  options={localeOptions}
                  value={selectedLocale}
                  onChange={setSelectedLocale}
                />

                <Button onClick={handleLocaleSave}>
                  {t.settings.saveLanguage}
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
                  {t.settings.shopInformation}
                </Text>
                <BlockStack gap="100">
                  <Text variant="bodyMd" as="p">
                    <strong>{t.settings.domain}:</strong> {shop.domain}
                  </Text>
                  {shop.name && (
                    <Text variant="bodyMd" as="p">
                      <strong>{t.settings.name}:</strong> {shop.name}
                    </Text>
                  )}
                  {shop.email && (
                    <Text variant="bodyMd" as="p">
                      <strong>{t.settings.email}:</strong> {shop.email}
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
        title={t.settings.cancelModalTitle}
        primaryAction={{
          content: t.settings.confirmCancel,
          onAction: handleCancel,
          destructive: true,
        }}
        secondaryActions={[
          {
            content: t.settings.keepSubscription,
            onAction: () => setCancelModalOpen(false),
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="200">
            <Text as="p" variant="bodyMd">
              {t.settings.cancelModalDescription}
            </Text>
            <Text as="p" variant="bodyMd" tone="subdued">
              {t.settings.cancelModalNote}
            </Text>
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
