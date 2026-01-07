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
import { getShopWithRules } from "~/models/shop.server";

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

  return json({
    shopDomain: session.shop,
    hasRules: hasRules ?? false,
    hasActiveRules: hasActiveRules ?? false,
    ruleCount: shopData?.rules.length || 0,
  });
};

export default function SetupWizard() {
  const { shopDomain, hasRules, hasActiveRules, ruleCount } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const steps: SetupStep[] = [
    {
      id: "create-rule",
      title: "Create Your First Pricing Rule",
      description: "Set up volume discounts like 'Buy 5+, get 10% off'. Define which products and what discount tiers to offer.",
      actionLabel: hasRules ? "Create Another Rule" : "Create Rule",
      actionUrl: "/app/rules/new",
      completed: hasRules,
      icon: ListBulletedIcon,
    },
    {
      id: "add-to-theme",
      title: "Add Discount Table to Your Theme",
      description: "Display the pricing table on product pages so customers can see available discounts before adding to cart.",
      actionLabel: "Open Theme Editor",
      actionUrl: `https://${shopDomain}/admin/themes/current/editor`,
      completed: hasActiveRules, // Assuming if they have active rules, they've set up theme
      icon: ThemeIcon,
    },
    {
      id: "activate-discount",
      title: "Activate Automatic Discount",
      description: "Connect your pricing rule to Shopify's checkout so discounts apply automatically when customers buy in quantity.",
      actionLabel: "Create Discount",
      actionUrl: "/app/discount/new",
      completed: false, // Would need to check Shopify discounts
      icon: DiscountIcon,
    },
  ];

  const completedCount = steps.filter((s) => s.completed).length;
  const progress = (completedCount / steps.length) * 100;

  return (
    <Page
      title="Setup Guide"
      subtitle="Get started with Tiered Pricing in 3 easy steps"
      backAction={{ content: "Dashboard", url: "/app" }}
    >
      <BlockStack gap="500">
        {/* Progress */}
        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between">
              <Text variant="headingSm" as="h3">
                Setup Progress
              </Text>
              <Text variant="bodySm" tone="subdued" as="span">
                {completedCount} of {steps.length} completed
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
                      <Badge tone="success">Completed</Badge>
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
              How to Add the Discount Table to Your Theme
            </Text>
            <BlockStack gap="200">
              <Text as="p">
                <strong>Step 1:</strong> Go to your Shopify Admin → Online Store → Themes
              </Text>
              <Text as="p">
                <strong>Step 2:</strong> Click "Customize" on your active theme
              </Text>
              <Text as="p">
                <strong>Step 3:</strong> Navigate to a Product page template
              </Text>
              <Text as="p">
                <strong>Step 4:</strong> Click "Add block" or "Add section"
              </Text>
              <Text as="p">
                <strong>Step 5:</strong> Look for "Apps" → "Volume Discount Table"
              </Text>
              <Text as="p">
                <strong>Step 6:</strong> Drag it to your desired position and customize colors
              </Text>
              <Text as="p">
                <strong>Step 7:</strong> Save your changes
              </Text>
            </BlockStack>
            <Button
              variant="secondary"
              url={`https://${shopDomain}/admin/themes/current/editor`}
              external
            >
              Open Theme Editor
            </Button>
          </BlockStack>
        </Card>

        {/* Help Banner */}
        <Banner
          title="Need help?"
          action={{ content: "View Documentation", url: "/app/help" }}
          tone="info"
        >
          <p>
            Check our documentation for detailed guides, video tutorials, and
            troubleshooting tips.
          </p>
        </Banner>
      </BlockStack>
    </Page>
  );
}
