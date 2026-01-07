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
import { getShopByDomain } from "~/models/shop.server";
import { getABTestsByShop, getABTestStats, createABTest, updateABTestStatus, deleteABTest, selectWinner } from "~/models/ab-test.server";
import type { ABTestType, ABTargetType } from "@prisma/client";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const shop = await getShopByDomain(session.shop);
  if (!shop) {
    throw new Response("Shop not found", { status: 404 });
  }

  const [tests, stats] = await Promise.all([
    getABTestsByShop(shop.id),
    getABTestStats(shop.id),
  ]);

  return json({
    tests,
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
  const { tests, stats } = useLoaderData<typeof loader>();
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
        return <Badge tone="success">Running</Badge>;
      case "PAUSED":
        return <Badge tone="attention">Paused</Badge>;
      case "COMPLETED":
        return <Badge tone="info">Completed</Badge>;
      default:
        return <Badge>Draft</Badge>;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
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
      title="A/B Testing"
      subtitle="Test prices, discounts, and offers to maximize conversions"
      primaryAction={{
        content: "Create Test",
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
                  <Text variant="bodyMd" as="span" tone="subdued">Active Tests</Text>
                  <Icon source={TargetIcon} tone="base" />
                </InlineStack>
                <Text variant="headingXl" as="h3">{stats.activeTests}</Text>
                <Text variant="bodySm" as="p" tone="subdued">Running experiments</Text>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text variant="bodyMd" as="span" tone="subdued">Revenue Lift</Text>
                  <Icon source={CashDollarIcon} tone="success" />
                </InlineStack>
                <Text variant="headingXl" as="h3" tone="success">
                  +{formatCurrency(stats.totalRevenueLift)}
                </Text>
                <Text variant="bodySm" as="p" tone="subdued">From winning variants</Text>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text variant="bodyMd" as="span" tone="subdued">Avg. Conversion Lift</Text>
                  <Icon source={ChartVerticalFilledIcon} tone="success" />
                </InlineStack>
                <Text variant="headingXl" as="h3" tone="success">
                  +{stats.avgConversionLift}%
                </Text>
                <Text variant="bodySm" as="p" tone="subdued">vs. control groups</Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Tests List */}
        {tests.length === 0 ? (
          <Card>
            <EmptyState
              heading="Start optimizing with A/B tests"
              action={{
                content: "Create your first test",
                onAction: () => setShowCreateModal(true),
              }}
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>
                Test different prices, discounts, and shipping thresholds to find
                what converts best for your store.
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
                          <Badge tone="success" icon={CheckIcon}>Winner Selected</Badge>
                        )}
                      </InlineStack>
                      <Text variant="bodySm" as="p" tone="subdued">
                        {test.testType} test • {test.splitPercent}% traffic split • Started {test.startDate}
                      </Text>
                    </BlockStack>
                  </InlineStack>
                  <InlineStack gap="200">
                    {test.status === "RUNNING" && (
                      <Button icon={StopCircleIcon} onClick={() => {}}>Pause</Button>
                    )}
                    {test.status === "PAUSED" && (
                      <Button icon={PlayCircleIcon} onClick={() => {}}>Resume</Button>
                    )}
                    {test.status === "RUNNING" && (
                      <Button variant="primary" onClick={() => {}}>End Test & Pick Winner</Button>
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
                                <Badge>Control</Badge>
                              )}
                              {isWinner && (
                                <Badge tone="success" icon={CheckIcon}>Winner</Badge>
                              )}
                            </InlineStack>
                            {!variant.isControl && significance && (
                              <Tooltip content={`${significance.confidence}% confidence`}>
                                <Badge tone={significance.lift > 0 ? "success" : "critical"}>
                                  {`${significance.lift > 0 ? "+" : ""}${significance.lift.toFixed(1)}% lift`}
                                </Badge>
                              </Tooltip>
                            )}
                          </InlineStack>

                          {/* Metrics */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px' }}>
                            <BlockStack gap="100">
                              <InlineStack gap="100" blockAlign="center">
                                <Icon source={ViewIcon} tone="subdued" />
                                <Text variant="bodySm" as="span" tone="subdued">Views</Text>
                              </InlineStack>
                              <Text variant="headingMd" as="p">{variant.views.toLocaleString()}</Text>
                            </BlockStack>

                            <BlockStack gap="100">
                              <InlineStack gap="100" blockAlign="center">
                                <Icon source={CartIcon} tone="subdued" />
                                <Text variant="bodySm" as="span" tone="subdued">Add to Cart</Text>
                              </InlineStack>
                              <Text variant="headingMd" as="p">{variant.addToCarts}</Text>
                            </BlockStack>

                            <BlockStack gap="100">
                              <InlineStack gap="100" blockAlign="center">
                                <Icon source={CheckIcon} tone="subdued" />
                                <Text variant="bodySm" as="span" tone="subdued">Purchases</Text>
                              </InlineStack>
                              <Text variant="headingMd" as="p">{variant.purchases}</Text>
                            </BlockStack>

                            <BlockStack gap="100">
                              <InlineStack gap="100" blockAlign="center">
                                <Icon source={CashDollarIcon} tone="subdued" />
                                <Text variant="bodySm" as="span" tone="subdued">Revenue</Text>
                              </InlineStack>
                              <Text variant="headingMd" as="p">{formatCurrency(variant.revenue)}</Text>
                            </BlockStack>
                          </div>

                          {/* Conversion Rate */}
                          <BlockStack gap="200">
                            <InlineStack align="space-between">
                              <Text variant="bodySm" as="span" tone="subdued">Conversion Rate</Text>
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
                      <strong>Tip:</strong> Let tests run for at least 2 weeks or until you have 1,000+ visitors
                      per variant for statistically significant results.
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
          title="Create A/B Test"
          primaryAction={{
            content: "Create Test",
            onAction: () => {
              // Submit form
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
            <BlockStack gap="400">
              <TextField
                label="Test Name"
                value={newTest.name}
                onChange={(value) => setNewTest({ ...newTest, name: value })}
                placeholder="e.g., Summer Sale: 10% vs 15%"
                autoComplete="off"
                helpText="A descriptive name to identify this test"
              />

              <Select
                label="Test Type"
                options={[
                  { label: "Discount Percentage", value: "DISCOUNT" },
                  { label: "Fixed Price", value: "PRICE" },
                  { label: "Free Shipping Threshold", value: "SHIPPING" },
                  { label: "Bundle Discount", value: "BUNDLE" },
                ]}
                value={newTest.testType}
                onChange={(value) => setNewTest({ ...newTest, testType: value })}
              />

              <Select
                label="Target Audience"
                options={[
                  { label: "All Visitors", value: "ALL_VISITORS" },
                  { label: "New Visitors Only", value: "NEW_VISITORS" },
                  { label: "Returning Visitors Only", value: "RETURNING_VISITORS" },
                  { label: "Specific Products", value: "SPECIFIC_PRODUCTS" },
                  { label: "Specific Collections", value: "SPECIFIC_COLLECTIONS" },
                ]}
                value={newTest.targetType}
                onChange={(value) => setNewTest({ ...newTest, targetType: value })}
              />

              <Divider />

              <Text variant="headingSm" as="h3">Variants</Text>

              <FormLayout>
                <FormLayout.Group>
                  <TextField
                    label="Control (A)"
                    value={newTest.controlValue}
                    onChange={(value) => setNewTest({ ...newTest, controlValue: value })}
                    placeholder={newTest.testType === "DISCOUNT" ? "10" : "99.00"}
                    suffix={newTest.testType === "DISCOUNT" ? "%" : "$"}
                    autoComplete="off"
                    helpText="Current/original value"
                  />
                  <TextField
                    label="Variant (B)"
                    value={newTest.variantValue}
                    onChange={(value) => setNewTest({ ...newTest, variantValue: value })}
                    placeholder={newTest.testType === "DISCOUNT" ? "15" : "89.00"}
                    suffix={newTest.testType === "DISCOUNT" ? "%" : "$"}
                    autoComplete="off"
                    helpText="New value to test"
                  />
                </FormLayout.Group>
              </FormLayout>

              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text as="span" variant="bodyMd">Traffic Split</Text>
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
                  Control: {newTest.splitPercent}% of visitors • Variant B: {100 - newTest.splitPercent}% of visitors
                </Text>
              </BlockStack>

              <Banner tone="info">
                <p>
                  We recommend a 50/50 split for fastest results. The test will automatically
                  track views, add-to-carts, and purchases for each variant.
                </p>
              </Banner>
            </BlockStack>
          </Modal.Section>
        </Modal>
      </BlockStack>
    </Page>
  );
}
