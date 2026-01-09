/**
 * Setup Wizard Route
 *
 * Step-by-step onboarding for new users.
 * Guides through: Create Rule → Add to Theme → Activate Discount
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
  Divider,
  Banner,
  ProgressBar,
  Badge,
} from "@shopify/polaris";
import {
  CheckCircleIcon,
  ListBulletedIcon,
  ThemeIcon,
  DiscountIcon,
} from "@shopify/polaris-icons";

import { authenticate } from "~/shopify.server";
import { getShopWithRules, getLocaleSettings } from "~/models/shop.server";
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

  // We can't easily check if theme extension is added, so we'll assume step 2
  // is completed if they have active rules (they would need the extension for it to work)

  const localeSettings = await getLocaleSettings(session.shop);
  const locale = localeSettings?.locale || "en";
  const t = getTranslations(locale);

  return json({
    shopDomain: session.shop,
    hasRules: hasRules ?? false,
    hasActiveRules: hasActiveRules ?? false,
    ruleCount: shopData?.rules.length || 0,
    t,
  });
};

export default function SetupWizard() {
  const { shopDomain, hasRules, hasActiveRules, ruleCount, t } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

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
      completed: hasActiveRules, // Assuming if they have active rules, they've set up theme
      icon: ThemeIcon,
    },
    {
      id: "activate-discount",
      title: t.setupPage.step3Title,
      description: t.setupPage.step3Desc,
      actionLabel: t.setupPage.step3Action,
      actionUrl: "/app/discount/new",
      completed: false, // Would need to check Shopify discounts
      icon: DiscountIcon,
    },
  ];

  const completedCount = steps.filter((s) => s.completed).length;
  const progress = (completedCount / steps.length) * 100;

  return (
    <Page
      title={t.setupPage.title}
      subtitle={t.setupPage.subtitle}
      backAction={{ content: t.setupPage.dashboard, url: "/app" }}
    >
      <BlockStack gap="500">
        {/* Progress */}
        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between">
              <Text variant="headingSm" as="h3">
                {t.setupPage.setupProgress}
              </Text>
              <Text variant="bodySm" tone="subdued" as="span">
                {completedCount} {t.setupPage.of} {steps.length} {t.setupPage.completed}
              </Text>
            </InlineStack>
            <ProgressBar progress={progress} tone="primary" size="small" />
          </BlockStack>
        </Card>

        {/* Steps */}
        {steps.map((step, index) => (
          <Card key={step.id}>
            <BlockStack gap="400">
              <InlineStack gap="400" align="start" blockAlign="start">
                <Box
                  width="40px"
                  minHeight="40px"
                  background={step.completed ? "bg-fill-success" : "bg-surface-secondary"}
                  borderRadius="full"
                  padding="200"
                >
                  <InlineStack align="center" blockAlign="center">
                    {step.completed ? (
                      <Icon source={CheckCircleIcon} tone="success" />
                    ) : (
                      <Text variant="headingMd" as="span" tone="subdued">
                        {index + 1}
                      </Text>
                    )}
                  </InlineStack>
                </Box>
                <BlockStack gap="200">
                  <InlineStack gap="200" align="start">
                    <Icon source={step.icon} tone="base" />
                    <Text variant="headingMd" as="h3">
                      {step.title}
                    </Text>
                    {step.completed && (
                      <Badge tone="success">{t.setupPage.completedBadge}</Badge>
                    )}
                  </InlineStack>
                  <Text variant="bodyMd" tone="subdued" as="p">
                    {step.description}
                  </Text>
                  <Box paddingBlockStart="200">
                    <Button
                      variant={step.completed ? "secondary" : "primary"}
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
                  </Box>
                </BlockStack>
              </InlineStack>
            </BlockStack>
          </Card>
        ))}

        {/* Theme Extension Instructions */}
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h3">
              {t.setupPage.themeInstructions}
            </Text>
            <BlockStack gap="200">
              <Text as="p">
                <strong>Step 1:</strong> {t.setupPage.themeStep1}
              </Text>
              <Text as="p">
                <strong>Step 2:</strong> {t.setupPage.themeStep2}
              </Text>
              <Text as="p">
                <strong>Step 3:</strong> {t.setupPage.themeStep3}
              </Text>
              <Text as="p">
                <strong>Step 4:</strong> {t.setupPage.themeStep4}
              </Text>
              <Text as="p">
                <strong>Step 5:</strong> {t.setupPage.themeStep5}
              </Text>
              <Text as="p">
                <strong>Step 6:</strong> {t.setupPage.themeStep6}
              </Text>
              <Text as="p">
                <strong>Step 7:</strong> {t.setupPage.themeStep7}
              </Text>
            </BlockStack>
            <Button
              variant="secondary"
              url={`https://${shopDomain}/admin/themes/current/editor`}
              external
            >
              {t.setupPage.openThemeEditor}
            </Button>
          </BlockStack>
        </Card>

        {/* Help Banner */}
        <Banner
          title={t.setupPage.needHelp}
          action={{ content: t.setupPage.viewDocumentation, url: "/app/help" }}
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
