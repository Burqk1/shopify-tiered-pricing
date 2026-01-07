/**
 * Help & Documentation Route
 *
 * Provides user guides, FAQs, and support resources.
 */

import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Collapsible,
  Link,
  Icon,
  Box,
  Divider,
  Banner,
  List,
} from "@shopify/polaris";
import {
  QuestionCircleIcon,
  PlayIcon,
  ChatIcon,
  EmailIcon,
  ExternalIcon,
} from "@shopify/polaris-icons";
import { useState, useCallback } from "react";

import { authenticate } from "~/shopify.server";

interface FAQ {
  question: string;
  answer: string;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  return json({
    shopDomain: session.shop,
  });
};

export default function Help() {
  const { shopDomain } = useLoaderData<typeof loader>();
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);

  const toggleFAQ = useCallback((index: number) => {
    setOpenFAQ((prev) => (prev === index ? null : index));
  }, []);

  const faqs: FAQ[] = [
    {
      question: "How do I create a volume discount?",
      answer: `Go to "Pricing Rules" in the sidebar and click "Create Rule".
      1. Give your rule a name (e.g., "T-Shirt Bulk Discount")
      2. Select which products this applies to (all products, specific collection, or individual products)
      3. Add discount tiers (e.g., 5+ items = 10% off, 10+ items = 20% off)
      4. Save and activate the rule
      5. Go to "Discounts" to create an automatic discount that uses this rule`,
    },
    {
      question: "Why isn't the discount showing on my product pages?",
      answer: `Make sure you've added the "Volume Discount Table" block to your theme:
      1. Go to Online Store → Themes → Customize
      2. Navigate to a product page
      3. Click "Add block" or "Add section"
      4. Find "Apps" → "Volume Discount Table"
      5. Position it where you want and save

      Also ensure your pricing rule is set to "Active" status.`,
    },
    {
      question: "Why isn't the discount applying at checkout?",
      answer: `The discount only applies automatically if you've created a Shopify Discount:
      1. Go to "Discounts" in the app sidebar
      2. Select your pricing rule
      3. Click "Create Discount"

      This creates an automatic discount in Shopify that applies the volume pricing at checkout.`,
    },
    {
      question: "Can I offer different discounts to wholesale customers?",
      answer: `Yes! When creating a pricing rule, you can set a customer condition:
      1. Add a condition with type "Customer Tag"
      2. Enter the tag (e.g., "wholesale" or "vip")
      3. Only customers with that tag will see and receive the discount

      You can tag customers in Shopify Admin → Customers.`,
    },
    {
      question: "What's the difference between FREE, GROWTH, and PROFESSIONAL plans?",
      answer: `• FREE: 1 pricing rule, basic features, "Powered by" branding
      • GROWTH ($9.99/mo): Unlimited rules, remove branding, priority support
      • PROFESSIONAL ($24.99/mo): Everything in Growth + customer tag targeting, API access, scheduled rules`,
    },
    {
      question: "How do I remove the 'Powered by Tiered Pricing' text?",
      answer: `Upgrade to the GROWTH or PROFESSIONAL plan to remove branding. Go to Settings → Manage Plan to upgrade.`,
    },
    {
      question: "Can I schedule discounts to start/end at specific dates?",
      answer: `Yes, on the PROFESSIONAL plan. When creating a rule, you can set:
      • Start Date: When the discount becomes active
      • End Date: When the discount automatically expires

      Perfect for seasonal sales or limited-time promotions.`,
    },
    {
      question: "What happens if a customer qualifies for multiple discounts?",
      answer: `The rule with the highest "Priority" number wins. When creating rules, set higher priority numbers for rules you want to take precedence.

      For example:
      • "VIP 30% off" with priority 10
      • "General 10% off" with priority 1

      A VIP customer will get 30% off, not 10%.`,
    },
  ];

  return (
    <Page
      title="Help & Documentation"
      subtitle="Learn how to use Tiered Pricing"
      backAction={{ content: "Dashboard", url: "/app" }}
    >
      <BlockStack gap="500">
        {/* Quick Links */}
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">
              Quick Links
            </Text>
            <InlineStack gap="300" wrap>
              <Button variant="secondary" url="/app/setup">
                Setup Guide
              </Button>
              <Button variant="secondary" url="/app/rules/new">
                Create First Rule
              </Button>
              <Button
                variant="secondary"
                url={`https://${shopDomain}/admin/themes/current/editor`}
                external
              >
                Theme Editor
              </Button>
            </InlineStack>
          </BlockStack>
        </Card>

        {/* Video Tutorial Placeholder */}
        <Card>
          <BlockStack gap="400">
            <InlineStack gap="200" align="start">
              <Icon source={PlayIcon} tone="base" />
              <Text variant="headingMd" as="h2">
                Video Tutorial
              </Text>
            </InlineStack>
            <Box
              padding="800"
              background="bg-surface-secondary"
              borderRadius="200"
            >
              <BlockStack gap="200" inlineAlign="center">
                <Text variant="headingLg" as="p" alignment="center">
                  Coming Soon
                </Text>
                <Text variant="bodySm" tone="subdued" as="p" alignment="center">
                  Video tutorials will be available soon. Follow the written
                  guide below for now.
                </Text>
              </BlockStack>
            </Box>
          </BlockStack>
        </Card>

        {/* Step by Step Guide */}
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">
              Getting Started Guide
            </Text>

            <BlockStack gap="300">
              <Text variant="headingSm" as="h3">
                Step 1: Create a Pricing Rule
              </Text>
              <List type="number">
                <List.Item>
                  Click "Pricing Rules" in the sidebar
                </List.Item>
                <List.Item>
                  Click "Create Rule" button
                </List.Item>
                <List.Item>
                  Enter a name (e.g., "Summer Sale Volume Discount")
                </List.Item>
                <List.Item>
                  Choose which products this applies to
                </List.Item>
                <List.Item>
                  Add discount tiers (quantity thresholds and discount amounts)
                </List.Item>
                <List.Item>
                  Save and set status to "Active"
                </List.Item>
              </List>
            </BlockStack>

            <Divider />

            <BlockStack gap="300">
              <Text variant="headingSm" as="h3">
                Step 2: Add the Pricing Table to Your Theme
              </Text>
              <List type="number">
                <List.Item>
                  Go to Shopify Admin → Online Store → Themes
                </List.Item>
                <List.Item>
                  Click "Customize" on your active theme
                </List.Item>
                <List.Item>
                  Use the page dropdown to select "Products" → "Default product"
                </List.Item>
                <List.Item>
                  Click "Add block" in the product information section
                </List.Item>
                <List.Item>
                  Select "Apps" → "Volume Discount Table"
                </List.Item>
                <List.Item>
                  Customize the table appearance (colors, columns)
                </List.Item>
                <List.Item>
                  Click "Save"
                </List.Item>
              </List>
            </BlockStack>

            <Divider />

            <BlockStack gap="300">
              <Text variant="headingSm" as="h3">
                Step 3: Create an Automatic Discount
              </Text>
              <List type="number">
                <List.Item>
                  Click "Discounts" in the app sidebar
                </List.Item>
                <List.Item>
                  Enter a discount title (customers will see this at checkout)
                </List.Item>
                <List.Item>
                  Select the pricing rule you created
                </List.Item>
                <List.Item>
                  Click "Create Discount"
                </List.Item>
                <List.Item>
                  The discount is now active and will apply automatically!
                </List.Item>
              </List>
            </BlockStack>
          </BlockStack>
        </Card>

        {/* FAQs */}
        <Card>
          <BlockStack gap="400">
            <InlineStack gap="200" align="start">
              <Icon source={QuestionCircleIcon} tone="base" />
              <Text variant="headingMd" as="h2">
                Frequently Asked Questions
              </Text>
            </InlineStack>

            <BlockStack gap="200">
              {faqs.map((faq, index) => (
                <div key={index}>
                  <div
                    onClick={() => toggleFAQ(index)}
                    style={{
                      cursor: "pointer",
                      padding: "12px 0",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Text variant="bodyMd" fontWeight="semibold" as="span">
                      {faq.question}
                    </Text>
                    <Text variant="bodySm" as="span">
                      {openFAQ === index ? "−" : "+"}
                    </Text>
                  </div>
                  <Collapsible
                    open={openFAQ === index}
                    id={`faq-${index}`}
                    transition={{ duration: "200ms", timingFunction: "ease-in-out" }}
                  >
                    <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                      <Text variant="bodyMd" as="p" tone="subdued">
                        {faq.answer.split("\n").map((line, i) => (
                          <span key={i}>
                            {line}
                            <br />
                          </span>
                        ))}
                      </Text>
                    </Box>
                  </Collapsible>
                  {index < faqs.length - 1 && <Divider />}
                </div>
              ))}
            </BlockStack>
          </BlockStack>
        </Card>

        {/* Support */}
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">
              Need More Help?
            </Text>
            <InlineStack gap="300" wrap>
              <Button
                variant="secondary"
                icon={EmailIcon}
                url="mailto:support@tieredpricing.app"
                external
              >
                Email Support
              </Button>
              <Button
                variant="secondary"
                icon={ChatIcon}
                url="https://tieredpricing.app/chat"
                external
              >
                Live Chat
              </Button>
            </InlineStack>
            <Text variant="bodySm" tone="subdued" as="p">
              Our support team typically responds within 24 hours. GROWTH and
              PROFESSIONAL plan users get priority support.
            </Text>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
