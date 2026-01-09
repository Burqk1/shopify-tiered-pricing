/**
 * Setup Wizard Route
 *
 * Enhanced step-by-step onboarding for new users.
 * Guides through: Create Rule → Add to Theme → Activate Discount
 * Includes: Feature highlights, quick tips, video tutorials
 */

import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Page,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Icon,
  Box,
  Banner,
  ProgressBar,
  Badge,
  Grid,
  Tooltip,
  Collapsible,
  Link,
  MediaCard,
  VideoThumbnail,
} from "@shopify/polaris";
import {
  CheckCircleIcon,
  ListBulletedIcon,
  ThemeIcon,
  DiscountIcon,
  ChartVerticalFilledIcon,
  AutomationIcon,
  GlobeIcon,
  PersonIcon,
  PlayIcon,
  StarFilledIcon,
  LightbulbIcon,
  QuestionCircleIcon,
} from "@shopify/polaris-icons";
import { useState } from "react";

import { authenticate } from "~/shopify.server";
import { getShopWithRules, getLocaleSettings, getPlanFeatures } from "~/models/shop.server";
import { getTranslations } from "~/i18n";

interface SetupStep {
  id: string;
  title: string;
  description: string;
  actionLabel: string;
  actionUrl: string;
  completed: boolean;
  icon: typeof ListBulletedIcon;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const shopData = await getShopWithRules(session.shop);

  // Calculate setup progress
  const hasRules = shopData && shopData.rules.length > 0;
  const hasActiveRules = shopData?.rules.some((r) => r.status === "ACTIVE") || false;
  const hasSyncedRules = shopData?.rules.some((r) => r.syncedAt !== null) || false;

  // Get plan info for feature highlights
  const planFeatures = shopData ? getPlanFeatures(shopData.plan) : getPlanFeatures("FREE");

  const localeSettings = await getLocaleSettings(session.shop);
  const locale = localeSettings?.locale || "en";
  const t = getTranslations(locale);

  return json({
    shopDomain: session.shop,
    shopPlan: shopData?.plan || "FREE",
    hasRules: hasRules ?? false,
    hasActiveRules: hasActiveRules ?? false,
    hasSyncedRules: hasSyncedRules ?? false,
    ruleCount: shopData?.rules.length || 0,
    planFeatures,
    t,
  });
};

export default function SetupWizard() {
  const { shopDomain, shopPlan, hasRules, hasActiveRules, hasSyncedRules, ruleCount, planFeatures, t } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [showThemeInstructions, setShowThemeInstructions] = useState(false);
  const [showQuickTips, setShowQuickTips] = useState(true);

  const steps: SetupStep[] = [
    {
      id: "create-rule",
      title: t.setupPage.step1Title,
      description: t.setupPage.step1Desc,
      actionLabel: hasRules ? t.setupPage.step1ActionExisting : t.setupPage.step1ActionNew,
      actionUrl: "/app/rules/new",
      completed: hasRules,
      icon: ListBulletedIcon,
    },
    {
      id: "add-to-theme",
      title: t.setupPage.step2Title,
      description: t.setupPage.step2Desc,
      actionLabel: t.setupPage.step2Action,
      actionUrl: `https://${shopDomain}/admin/themes/current/editor`,
      completed: hasSyncedRules,
      icon: ThemeIcon,
    },
    {
      id: "activate-discount",
      title: t.setupPage.step3Title,
      description: t.setupPage.step3Desc,
      actionLabel: t.setupPage.step3Action,
      actionUrl: "/app/discount/new",
      completed: hasActiveRules,
      icon: DiscountIcon,
    },
  ];

  const completedCount = steps.filter((s) => s.completed).length;
  const progress = (completedCount / steps.length) * 100;
  const isSetupComplete = completedCount === steps.length;

  // Feature highlights based on plan
  const features = [
    {
      icon: ListBulletedIcon,
      title: "Volume Discounts",
      description: "Buy more, save more pricing",
      available: true,
    },
    {
      icon: AutomationIcon,
      title: "BOGO Offers",
      description: "Buy X Get Y deals",
      available: true,
    },
    {
      icon: GlobeIcon,
      title: "Geo Targeting",
      description: "Location-based pricing",
      available: true,
    },
    {
      icon: ChartVerticalFilledIcon,
      title: "AI Pricing",
      description: "Smart recommendations",
      available: planFeatures.aiPricing,
    },
    {
      icon: PersonIcon,
      title: "A/B Testing",
      description: "Test price strategies",
      available: planFeatures.abTesting,
    },
    {
      icon: StarFilledIcon,
      title: "Competitor Tracking",
      description: "Monitor rival prices",
      available: planFeatures.competitorTracking,
    },
  ];

  // Quick tips
  const quickTips = [
    "Start with a 10-15% discount for quantities of 5+ to test customer response",
    "Use countdown timers to create urgency during sales",
    "Bundle complementary products for higher average order value",
    "Set up free shipping thresholds to increase cart size",
  ];

  return (
    <Page
      title={t.setupPage.title}
      subtitle={t.setupPage.subtitle}
      backAction={{ content: t.setupPage.dashboard, url: "/app" }}
    >
      <BlockStack gap="500">
        {/* Congratulations Banner when setup complete */}
        {isSetupComplete && (
          <Banner
            title="Setup Complete!"
            tone="success"
            onDismiss={() => {}}
          >
            <p>
              You&apos;re all set! Your tiered pricing is now live. Check your analytics to track performance.
            </p>
          </Banner>
        )}

        {/* Progress Card - Enhanced */}
        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center">
              <BlockStack gap="100">
                <Text variant="headingMd" as="h2">
                  {t.setupPage.setupProgress}
                </Text>
                <Text variant="bodySm" tone="subdued" as="span">
                  {completedCount} {t.setupPage.of} {steps.length} {t.setupPage.completed}
                </Text>
              </BlockStack>
              <Box>
                <Badge tone={isSetupComplete ? "success" : "attention"}>
                  {isSetupComplete ? "Ready to go!" : "In Progress"}
                </Badge>
              </Box>
            </InlineStack>
            <ProgressBar
              progress={progress}
              tone={isSetupComplete ? "success" : "primary"}
              size="medium"
            />
            {ruleCount > 0 && (
              <InlineStack gap="300">
                <Badge>{`${ruleCount} rule${ruleCount > 1 ? "s" : ""} created`}</Badge>
                {hasActiveRules && <Badge tone="success">Active</Badge>}
              </InlineStack>
            )}
          </BlockStack>
        </Card>

        {/* Steps - Enhanced with better visual hierarchy */}
        <Grid>
          {steps.map((step, index) => (
            <Grid.Cell key={step.id} columnSpan={{ xs: 6, sm: 6, md: 2, lg: 4, xl: 4 }}>
              <Card>
                <BlockStack gap="400">
                  {/* Step Header */}
                  <InlineStack gap="300" align="start" blockAlign="center">
                    <Box
                      background={step.completed ? "bg-fill-success" : "bg-surface-secondary"}
                      borderRadius="full"
                      padding="300"
                    >
                      {step.completed ? (
                        <Icon source={CheckCircleIcon} tone="success" />
                      ) : (
                        <Text variant="headingMd" as="span" fontWeight="bold">
                          {index + 1}
                        </Text>
                      )}
                    </Box>
                    <BlockStack gap="050">
                      <InlineStack gap="200" align="start" blockAlign="center">
                        <Icon source={step.icon} tone={step.completed ? "success" : "base"} />
                        <Text variant="headingSm" as="h3">
                          {step.title}
                        </Text>
                      </InlineStack>
                      {step.completed && (
                        <Badge tone="success" size="small">{t.setupPage.completedBadge}</Badge>
                      )}
                    </BlockStack>
                  </InlineStack>

                  {/* Step Description */}
                  <Text variant="bodyMd" tone="subdued" as="p">
                    {step.description}
                  </Text>

                  {/* Action Button */}
                  <Button
                    variant={step.completed ? "secondary" : "primary"}
                    fullWidth
                    onClick={() => {
                      if (step.actionUrl.startsWith("http")) {
                        window.open(step.actionUrl, "_blank");
                      } else {
                        navigate(step.actionUrl);
                      }
                    }}
                  >
                    {step.actionLabel}
                  </Button>
                </BlockStack>
              </Card>
            </Grid.Cell>
          ))}
        </Grid>

        {/* Quick Tips - Collapsible */}
        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center">
              <InlineStack gap="200" align="start" blockAlign="center">
                <Icon source={LightbulbIcon} tone="warning" />
                <Text variant="headingMd" as="h3">
                  Quick Tips for Success
                </Text>
              </InlineStack>
              <Button
                variant="plain"
                onClick={() => setShowQuickTips(!showQuickTips)}
              >
                {showQuickTips ? "Hide" : "Show"}
              </Button>
            </InlineStack>
            <Collapsible open={showQuickTips} id="quick-tips">
              <BlockStack gap="200">
                {quickTips.map((tip, i) => (
                  <InlineStack key={i} gap="200" align="start" blockAlign="start">
                    <Box paddingBlockStart="050">
                      <Badge tone="info">{String(i + 1)}</Badge>
                    </Box>
                    <Text as="p" variant="bodyMd">{tip}</Text>
                  </InlineStack>
                ))}
              </BlockStack>
            </Collapsible>
          </BlockStack>
        </Card>

        {/* Feature Highlights */}
        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center">
              <Text variant="headingMd" as="h3">
                Available Features
              </Text>
              <Badge tone="info">{`${shopPlan} Plan`}</Badge>
            </InlineStack>
            <Grid>
              {features.map((feature, i) => (
                <Grid.Cell key={i} columnSpan={{ xs: 3, sm: 3, md: 2, lg: 2, xl: 2 }}>
                  <Box
                    padding="300"
                    background={feature.available ? "bg-surface" : "bg-surface-secondary"}
                    borderRadius="200"
                    borderWidth="025"
                    borderColor="border"
                  >
                    <BlockStack gap="200" inlineAlign="center">
                      <Icon
                        source={feature.icon}
                        tone={feature.available ? "success" : "subdued"}
                      />
                      <Text
                        variant="bodySm"
                        as="p"
                        fontWeight="semibold"
                        tone={feature.available ? "success" : "subdued"}
                        alignment="center"
                      >
                        {feature.title}
                      </Text>
                      <Text
                        variant="bodySm"
                        as="p"
                        tone="subdued"
                        alignment="center"
                      >
                        {feature.description}
                      </Text>
                      {!feature.available && (
                        <Badge tone="attention" size="small">Pro</Badge>
                      )}
                    </BlockStack>
                  </Box>
                </Grid.Cell>
              ))}
            </Grid>
            {shopPlan === "FREE" && (
              <Banner
                tone="info"
                action={{ content: "Upgrade Now", url: "/app/settings" }}
              >
                <p>Unlock AI Pricing, A/B Testing, and more with Growth or Professional plans.</p>
              </Banner>
            )}
          </BlockStack>
        </Card>

        {/* Theme Extension Instructions - Collapsible */}
        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center">
              <InlineStack gap="200" align="start" blockAlign="center">
                <Icon source={ThemeIcon} />
                <Text variant="headingMd" as="h3">
                  {t.setupPage.themeInstructions}
                </Text>
              </InlineStack>
              <Button
                variant="plain"
                onClick={() => setShowThemeInstructions(!showThemeInstructions)}
                icon={showThemeInstructions ? undefined : QuestionCircleIcon}
              >
                {showThemeInstructions ? "Hide Steps" : "Show Steps"}
              </Button>
            </InlineStack>
            <Collapsible open={showThemeInstructions} id="theme-instructions">
              <BlockStack gap="300">
                <Box
                  padding="400"
                  background="bg-surface-secondary"
                  borderRadius="200"
                >
                  <BlockStack gap="300">
                    {[
                      t.setupPage.themeStep1,
                      t.setupPage.themeStep2,
                      t.setupPage.themeStep3,
                      t.setupPage.themeStep4,
                      t.setupPage.themeStep5,
                      t.setupPage.themeStep6,
                      t.setupPage.themeStep7,
                    ].map((step, i) => (
                      <InlineStack key={i} gap="300" align="start" blockAlign="start">
                        <Box
                          background="bg-fill-info"
                          borderRadius="full"
                          padding="100"
                          minWidth="24px"
                        >
                          <Text variant="bodySm" as="span" fontWeight="bold" alignment="center">
                            {String(i + 1)}
                          </Text>
                        </Box>
                        <Text as="p" variant="bodyMd">{step}</Text>
                      </InlineStack>
                    ))}
                  </BlockStack>
                </Box>
                <Button
                  variant="primary"
                  url={`https://${shopDomain}/admin/themes/current/editor`}
                  external
                  icon={ThemeIcon}
                >
                  {t.setupPage.openThemeEditor}
                </Button>
              </BlockStack>
            </Collapsible>
          </BlockStack>
        </Card>

        {/* Quick Actions */}
        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd" as="h3">
              Quick Actions
            </Text>
            <InlineStack gap="300" wrap>
              <Button onClick={() => navigate("/app/rules/new")} variant="primary">
                Create Pricing Rule
              </Button>
              <Button onClick={() => navigate("/app/bundles/new")}>
                Create Bundle
              </Button>
              <Button onClick={() => navigate("/app/bogo/new")}>
                Create BOGO Offer
              </Button>
              <Button onClick={() => navigate("/app/cart-progress/new")}>
                Add Free Shipping Bar
              </Button>
              <Button onClick={() => navigate("/app/timers/new")}>
                Add Countdown Timer
              </Button>
            </InlineStack>
          </BlockStack>
        </Card>

        {/* Help Banner */}
        <Banner
          title={t.setupPage.needHelp}
          action={{ content: t.setupPage.viewDocumentation, url: "/app/help" }}
          secondaryAction={{ content: "Contact Support", url: "mailto:support@tieredpricing.app" }}
          tone="info"
        >
          <p>
            {t.setupPage.needHelpDesc}
          </p>
        </Banner>
      </BlockStack>
    </Page>
  );
}
