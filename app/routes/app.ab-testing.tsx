/**
 * A/B Testing Dashboard
 *
 * Premium feature for testing different prices, discounts, and offers
 * to find the highest converting strategies.
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
  DataTable,
  ProgressBar,
  Modal,
  TextField,
  Select,
  FormLayout,
  RangeSlider,
  Divider,
  Box,
  Banner,
  Tooltip,
} from "@shopify/polaris";
import {
  TargetIcon,
  ChartVerticalFilledIcon,
  PlayCircleIcon,
  StopCircleIcon,
  CheckIcon,
  PlusIcon,
  ViewIcon,
  CartIcon,
  CashDollarIcon,
} from "@shopify/polaris-icons";
import { useState, useCallback } from "react";

import { authenticate } from "~/shopify.server";
import { getShopByDomain, getLocaleSettings } from "~/models/shop.server";
import { getABTestsByShop, getABTestStats, createABTest, updateABTestStatus, deleteABTest, selectWinner } from "~/models/ab-test.server";
import { getTranslations } from "~/i18n";
import { requireFeatureAccess } from "~/utils/plan-guard.server";
import type { ABTestType, ABTargetType } from "@prisma/client";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  // Check if user has access to A/B Testing feature (GROWTH+ plan required)
  await requireFeatureAccess(session.shop, "abTesting");

  const shop = await getShopByDomain(session.shop);
  if (!shop) {
    throw new Response("Shop not found", { status: 404 });
  }

  const [tests, stats, localeSettings] = await Promise.all([
    getABTestsByShop(shop.id),
    getABTestStats(shop.id),
    getLocaleSettings(session.shop),
  ]);

  const locale = localeSettings?.locale || "en";
  const t = getTranslations(locale);

  return json({
    tests,
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
        const testType = formData.get("testType") as ABTestType;
        const targetType = formData.get("targetType") as ABTargetType;
        const splitPercent = parseInt(formData.get("splitPercent") as string) || 50;
        const controlValue = formData.get("controlValue") as string;
        const variantValue = formData.get("variantValue") as string;

        await createABTest({
          shopId: shop.id,
          name,
          testType,
          targetType,
          splitPercent,
          controlValue,
          variantValue,
        });
        return json({ success: true, message: "Test created successfully" });
      }

      case "start": {
        const testId = formData.get("testId") as string;
        await updateABTestStatus(testId, "RUNNING");
        return json({ success: true, message: "Test started" });
      }

      case "pause": {
        const testId = formData.get("testId") as string;
        await updateABTestStatus(testId, "PAUSED");
        return json({ success: true, message: "Test paused" });
      }

      case "resume": {
        const testId = formData.get("testId") as string;
        await updateABTestStatus(testId, "RUNNING");
        return json({ success: true, message: "Test resumed" });
      }

      case "end": {
        const testId = formData.get("testId") as string;
        const winnerVariantId = formData.get("winnerVariantId") as string;
        if (winnerVariantId) {
          await selectWinner(testId, winnerVariantId);
        } else {
          await updateABTestStatus(testId, "COMPLETED");
        }
        return json({ success: true, message: "Test ended" });
      }

      case "delete": {
        const testId = formData.get("testId") as string;
        await deleteABTest(testId);
        return json({ success: true, message: "Test deleted" });
      }

      default:
        return json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("A/B Test action error:", error);
    return json({ error: "Action failed" }, { status: 500 });
  }
};

export default function ABTestingPage() {
  const { tests, stats, t, locale } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isLoading = navigation.state !== "idle";

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTest, setNewTest] = useState({
    name: "",
    testType: "DISCOUNT",
    targetType: "ALL_VISITORS",
    splitPercent: 50,
    controlValue: "",
    variantValue: "",
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "RUNNING":
        return <Badge tone="success">{t.abTestingPage.running}</Badge>;
      case "PAUSED":
        return <Badge tone="attention">{t.abTestingPage.paused}</Badge>;
      case "COMPLETED":
        return <Badge tone="info">{t.abTestingPage.completed}</Badge>;
      default:
        return <Badge>{t.abTestingPage.draft}</Badge>;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(locale === "en" ? "en-US" : locale, {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const calculateSignificance = (controlRate: number, variantRate: number, sampleSize: number) => {
    // Simplified statistical significance calculation
    const lift = ((variantRate - controlRate) / controlRate) * 100;
    const confidence = Math.min(95, Math.floor(sampleSize / 50) + lift);
    return { lift, confidence };
  };

  return (
    <Page
      title={t.abTestingPage.title}
      subtitle={t.abTestingPage.subtitle}
      primaryAction={{
        content: t.abTestingPage.createTest,
        icon: PlusIcon,
        onAction: () => setShowCreateModal(true),
      }}
    >
      <BlockStack gap="600">
        {/* Stats Overview */}
        <Layout>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text variant="bodyMd" as="span" tone="subdued">{t.abTestingPage.activeTests}</Text>
                  <Icon source={TargetIcon} tone="base" />
                </InlineStack>
                <Text variant="headingXl" as="h3">{stats.activeTests}</Text>
                <Text variant="bodySm" as="p" tone="subdued">{t.abTestingPage.runningExperiments}</Text>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text variant="bodyMd" as="span" tone="subdued">{t.abTestingPage.revenueLift}</Text>
                  <Icon source={CashDollarIcon} tone="success" />
                </InlineStack>
                <Text variant="headingXl" as="h3" tone="success">
                  +{formatCurrency(stats.totalRevenueLift)}
                </Text>
                <Text variant="bodySm" as="p" tone="subdued">{t.abTestingPage.fromWinningVariants}</Text>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text variant="bodyMd" as="span" tone="subdued">{t.abTestingPage.avgConversionLift}</Text>
                  <Icon source={ChartVerticalFilledIcon} tone="success" />
                </InlineStack>
                <Text variant="headingXl" as="h3" tone="success">
                  +{stats.avgConversionLift}%
                </Text>
                <Text variant="bodySm" as="p" tone="subdued">{t.abTestingPage.vsControlGroups}</Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Tests List */}
        {tests.length === 0 ? (
          <Card>
            <EmptyState
              heading={t.abTestingPage.startOptimizing}
              action={{
                content: t.abTestingPage.createFirstTest,
                onAction: () => setShowCreateModal(true),
              }}
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>
                {t.abTestingPage.emptyStateDesc}
              </p>
            </EmptyState>
          </Card>
        ) : (
          tests.map((test) => (
            <Card key={test.id}>
              <BlockStack gap="500">
                {/* Test Header */}
                <InlineStack align="space-between" blockAlign="center">
                  <InlineStack gap="300" blockAlign="center">
                    <Icon source={TargetIcon} />
                    <BlockStack gap="100">
                      <InlineStack gap="200" blockAlign="center">
                        <Text variant="headingMd" as="h3">{test.name}</Text>
                        {getStatusBadge(test.status)}
                        {("winnerVariantId" in test && test.winnerVariantId) && (
                          <Badge tone="success" icon={CheckIcon}>{t.abTestingPage.winnerSelected}</Badge>
                        )}
                      </InlineStack>
                      <Text variant="bodySm" as="p" tone="subdued">
                        {test.testType} {t.abTestingPage.test} • {test.splitPercent}% {t.abTestingPage.trafficSplit} • {t.abTestingPage.started} {test.startDate}
                      </Text>
                    </BlockStack>
                  </InlineStack>
                  <InlineStack gap="200">
                    {test.status === "RUNNING" && (
                      <Button icon={StopCircleIcon} onClick={() => {}}>{t.abTestingPage.pause}</Button>
                    )}
                    {test.status === "PAUSED" && (
                      <Button icon={PlayCircleIcon} onClick={() => {}}>{t.abTestingPage.resume}</Button>
                    )}
                    {test.status === "RUNNING" && (
                      <Button variant="primary" onClick={() => {}}>{t.abTestingPage.endTestPickWinner}</Button>
                    )}
                  </InlineStack>
                </InlineStack>

                <Divider />

                {/* Variants Comparison */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  {test.variants.map((variant) => {
                    const isWinner = ("winnerVariantId" in test) && test.winnerVariantId === variant.id;
                    const otherVariant = test.variants.find(v => v.id !== variant.id);
                    const significance = otherVariant
                      ? calculateSignificance(
                          variant.isControl ? variant.conversionRate : otherVariant.conversionRate,
                          variant.isControl ? otherVariant.conversionRate : variant.conversionRate,
                          variant.views
                        )
                      : null;

                    return (
                      <Box
                        key={variant.id}
                        padding="400"
                        background={isWinner ? "bg-surface-success" : "bg-surface-secondary"}
                        borderRadius="200"
                        borderWidth="025"
                        borderColor={isWinner ? "border-success" : "border"}
                      >
                        <BlockStack gap="400">
                          <InlineStack align="space-between" blockAlign="center">
                            <InlineStack gap="200" blockAlign="center">
                              <Text variant="headingSm" as="h4">{variant.name}</Text>
                              {variant.isControl && (
                                <Badge>{t.abTestingPage.control}</Badge>
                              )}
                              {isWinner && (
                                <Badge tone="success" icon={CheckIcon}>{t.abTestingPage.winner}</Badge>
                              )}
                            </InlineStack>
                            {!variant.isControl && significance && (
                              <Tooltip content={`${significance.confidence}% ${t.abTestingPage.confidence}`}>
                                <Badge tone={significance.lift > 0 ? "success" : "critical"}>
                                  {`${significance.lift > 0 ? "+" : ""}${significance.lift.toFixed(1)}% ${t.abTestingPage.lift}`}
                                </Badge>
                              </Tooltip>
                            )}
                          </InlineStack>

                          {/* Metrics */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px' }}>
                            <BlockStack gap="100">
                              <InlineStack gap="100" blockAlign="center">
                                <Icon source={ViewIcon} tone="subdued" />
                                <Text variant="bodySm" as="span" tone="subdued">{t.abTestingPage.views}</Text>
                              </InlineStack>
                              <Text variant="headingMd" as="p">{variant.views.toLocaleString()}</Text>
                            </BlockStack>

                            <BlockStack gap="100">
                              <InlineStack gap="100" blockAlign="center">
                                <Icon source={CartIcon} tone="subdued" />
                                <Text variant="bodySm" as="span" tone="subdued">{t.abTestingPage.addToCart}</Text>
                              </InlineStack>
                              <Text variant="headingMd" as="p">{variant.addToCarts}</Text>
                            </BlockStack>

                            <BlockStack gap="100">
                              <InlineStack gap="100" blockAlign="center">
                                <Icon source={CheckIcon} tone="subdued" />
                                <Text variant="bodySm" as="span" tone="subdued">{t.abTestingPage.purchases}</Text>
                              </InlineStack>
                              <Text variant="headingMd" as="p">{variant.purchases}</Text>
                            </BlockStack>

                            <BlockStack gap="100">
                              <InlineStack gap="100" blockAlign="center">
                                <Icon source={CashDollarIcon} tone="subdued" />
                                <Text variant="bodySm" as="span" tone="subdued">{t.abTestingPage.revenue}</Text>
                              </InlineStack>
                              <Text variant="headingMd" as="p">{formatCurrency(variant.revenue)}</Text>
                            </BlockStack>
                          </div>

                          {/* Conversion Rate */}
                          <BlockStack gap="200">
                            <InlineStack align="space-between">
                              <Text variant="bodySm" as="span" tone="subdued">{t.abTestingPage.conversionRate}</Text>
                              <Text variant="bodySm" as="span" fontWeight="semibold">
                                {variant.conversionRate}%
                              </Text>
                            </InlineStack>
                            <ProgressBar
                              progress={variant.conversionRate * 10}
                              size="small"
                              tone={isWinner ? "success" : "primary"}
                            />
                          </BlockStack>
                        </BlockStack>
                      </Box>
                    );
                  })}
                </div>

                {/* Statistical Note */}
                {test.status === "RUNNING" && (
                  <Banner>
                    <p>
                      <strong>{t.abTestingPage.tip}:</strong> {t.abTestingPage.statisticalTip}
                    </p>
                  </Banner>
                )}
              </BlockStack>
            </Card>
          ))
        )}

        {/* Create Test Modal */}
        <Modal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title={t.abTestingPage.createABTest}
          primaryAction={{
            content: t.abTestingPage.createTest,
            onAction: () => {
              // Submit form
              setShowCreateModal(false);
            },
          }}
          secondaryActions={[
            {
              content: t.abTestingPage.cancel,
              onAction: () => setShowCreateModal(false),
            },
          ]}
          size="large"
        >
          <Modal.Section>
            <BlockStack gap="400">
              <TextField
                label={t.abTestingPage.testName}
                value={newTest.name}
                onChange={(value) => setNewTest({ ...newTest, name: value })}
                placeholder={t.abTestingPage.testNamePlaceholder}
                autoComplete="off"
                helpText={t.abTestingPage.testNameHelp}
              />

              <Select
                label={t.abTestingPage.testType}
                options={[
                  { label: t.abTestingPage.discountPercentage, value: "DISCOUNT" },
                  { label: t.abTestingPage.fixedPrice, value: "PRICE" },
                  { label: t.abTestingPage.freeShippingThreshold, value: "SHIPPING" },
                  { label: t.abTestingPage.bundleDiscount, value: "BUNDLE" },
                ]}
                value={newTest.testType}
                onChange={(value) => setNewTest({ ...newTest, testType: value })}
              />

              <Select
                label={t.abTestingPage.targetAudience}
                options={[
                  { label: t.abTestingPage.allVisitors, value: "ALL_VISITORS" },
                  { label: t.abTestingPage.newVisitorsOnly, value: "NEW_VISITORS" },
                  { label: t.abTestingPage.returningVisitorsOnly, value: "RETURNING_VISITORS" },
                  { label: t.abTestingPage.specificProducts, value: "SPECIFIC_PRODUCTS" },
                  { label: t.abTestingPage.specificCollections, value: "SPECIFIC_COLLECTIONS" },
                ]}
                value={newTest.targetType}
                onChange={(value) => setNewTest({ ...newTest, targetType: value })}
              />

              <Divider />

              <Text variant="headingSm" as="h3">{t.abTestingPage.variants}</Text>

              <FormLayout>
                <FormLayout.Group>
                  <TextField
                    label={t.abTestingPage.controlA}
                    value={newTest.controlValue}
                    onChange={(value) => setNewTest({ ...newTest, controlValue: value })}
                    placeholder={newTest.testType === "DISCOUNT" ? "10" : "99.00"}
                    suffix={newTest.testType === "DISCOUNT" ? "%" : "$"}
                    autoComplete="off"
                    helpText={t.abTestingPage.currentOriginalValue}
                  />
                  <TextField
                    label={t.abTestingPage.variantB}
                    value={newTest.variantValue}
                    onChange={(value) => setNewTest({ ...newTest, variantValue: value })}
                    placeholder={newTest.testType === "DISCOUNT" ? "15" : "89.00"}
                    suffix={newTest.testType === "DISCOUNT" ? "%" : "$"}
                    autoComplete="off"
                    helpText={t.abTestingPage.newValueToTest}
                  />
                </FormLayout.Group>
              </FormLayout>

              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text as="span" variant="bodyMd">{t.abTestingPage.trafficSplitLabel}</Text>
                  <Text as="span" variant="bodyMd" fontWeight="semibold">
                    {newTest.splitPercent}% / {100 - newTest.splitPercent}%
                  </Text>
                </InlineStack>
                <RangeSlider
                  label=""
                  value={newTest.splitPercent}
                  onChange={(value) => setNewTest({ ...newTest, splitPercent: value as number })}
                  output
                  min={10}
                  max={90}
                  step={5}
                />
                <Text as="span" variant="bodySm" tone="subdued">
                  {t.abTestingPage.controlPercent}: {newTest.splitPercent}% {t.abTestingPage.ofVisitors} • {t.abTestingPage.variantPercent}: {100 - newTest.splitPercent}% {t.abTestingPage.ofVisitors}
                </Text>
              </BlockStack>

              <Banner tone="info">
                <p>
                  {t.abTestingPage.splitRecommendation}
                </p>
              </Banner>
            </BlockStack>
          </Modal.Section>
        </Modal>
      </BlockStack>
    </Page>
  );
}
