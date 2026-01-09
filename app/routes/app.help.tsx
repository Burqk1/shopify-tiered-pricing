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
import { getLocaleSettings } from "~/models/shop.server";
import { getTranslations } from "~/i18n";

interface FAQ {
  question: string;
  answer: string;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const localeSettings = await getLocaleSettings(session.shop);
  const locale = localeSettings?.locale || "en";
  const t = getTranslations(locale);

  return json({
    shopDomain: session.shop,
    t,
  });
};

export default function Help() {
  const { shopDomain, t } = useLoaderData<typeof loader>();
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);

  const toggleFAQ = useCallback((index: number) => {
    setOpenFAQ((prev) => (prev === index ? null : index));
  }, []);

  const faqs: FAQ[] = [
    { question: t.helpPage.faq1Q, answer: t.helpPage.faq1A },
    { question: t.helpPage.faq2Q, answer: t.helpPage.faq2A },
    { question: t.helpPage.faq3Q, answer: t.helpPage.faq3A },
    { question: t.helpPage.faq4Q, answer: t.helpPage.faq4A },
    { question: t.helpPage.faq5Q, answer: t.helpPage.faq5A },
    { question: t.helpPage.faq6Q, answer: t.helpPage.faq6A },
    { question: t.helpPage.faq7Q, answer: t.helpPage.faq7A },
    { question: t.helpPage.faq8Q, answer: t.helpPage.faq8A },
  ];

  return (
    <Page
      title={t.helpPage.title}
      subtitle={t.helpPage.subtitle}
      backAction={{ content: t.helpPage.backToDashboard, url: "/app" }}
    >
      <BlockStack gap="500">
        {/* Quick Links */}
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">
              {t.helpPage.quickLinks}
            </Text>
            <InlineStack gap="300" wrap>
              <Button variant="secondary" url="/app/setup">
                {t.helpPage.setupGuide}
              </Button>
              <Button variant="secondary" url="/app/rules/new">
                {t.helpPage.createFirstRule}
              </Button>
              <Button
                variant="secondary"
                url={`https://${shopDomain}/admin/themes/current/editor`}
                external
              >
                {t.helpPage.themeEditor}
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
                {t.helpPage.videoTutorial}
              </Text>
            </InlineStack>
            <Box
              padding="800"
              background="bg-surface-secondary"
              borderRadius="200"
            >
              <BlockStack gap="200" inlineAlign="center">
                <Text variant="headingLg" as="p" alignment="center">
                  {t.helpPage.comingSoon}
                </Text>
                <Text variant="bodySm" tone="subdued" as="p" alignment="center">
                  {t.helpPage.videoComingSoonDesc}
                </Text>
              </BlockStack>
            </Box>
          </BlockStack>
        </Card>

        {/* Step by Step Guide */}
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">
              {t.helpPage.gettingStartedGuide}
            </Text>

            <BlockStack gap="300">
              <Text variant="headingSm" as="h3">
                {t.helpPage.step1Title}
              </Text>
              <List type="number">
                <List.Item>{t.helpPage.step1_1}</List.Item>
                <List.Item>{t.helpPage.step1_2}</List.Item>
                <List.Item>{t.helpPage.step1_3}</List.Item>
                <List.Item>{t.helpPage.step1_4}</List.Item>
                <List.Item>{t.helpPage.step1_5}</List.Item>
                <List.Item>{t.helpPage.step1_6}</List.Item>
              </List>
            </BlockStack>

            <Divider />

            <BlockStack gap="300">
              <Text variant="headingSm" as="h3">
                {t.helpPage.step2Title}
              </Text>
              <List type="number">
                <List.Item>{t.helpPage.step2_1}</List.Item>
                <List.Item>{t.helpPage.step2_2}</List.Item>
                <List.Item>{t.helpPage.step2_3}</List.Item>
                <List.Item>{t.helpPage.step2_4}</List.Item>
                <List.Item>{t.helpPage.step2_5}</List.Item>
                <List.Item>{t.helpPage.step2_6}</List.Item>
                <List.Item>{t.helpPage.step2_7}</List.Item>
              </List>
            </BlockStack>

            <Divider />

            <BlockStack gap="300">
              <Text variant="headingSm" as="h3">
                {t.helpPage.step3Title}
              </Text>
              <List type="number">
                <List.Item>{t.helpPage.step3_1}</List.Item>
                <List.Item>{t.helpPage.step3_2}</List.Item>
                <List.Item>{t.helpPage.step3_3}</List.Item>
                <List.Item>{t.helpPage.step3_4}</List.Item>
                <List.Item>{t.helpPage.step3_5}</List.Item>
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
                {t.helpPage.faq}
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
              {t.helpPage.needMoreHelp}
            </Text>
            <InlineStack gap="300" wrap>
              <Button
                variant="secondary"
                icon={EmailIcon}
                url="mailto:support@tieredpricing.app"
                external
              >
                {t.helpPage.emailSupport}
              </Button>
              <Button
                variant="secondary"
                icon={ChatIcon}
                url="https://tieredpricing.app/chat"
                external
              >
                {t.helpPage.liveChat}
              </Button>
            </InlineStack>
            <Text variant="bodySm" tone="subdued" as="p">
              {t.helpPage.supportResponseTime}
            </Text>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
