/**
 * AI Dynamic Pricing Dashboard
 *
 * AI-powered pricing recommendations based on:
 * - Demand signals (views, sales velocity)
 * - Inventory levels
 * - Competitor pricing (when available)
 * - Historical performance
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
  Thumbnail,
  Modal,
  TextField,
  Select,
  Divider,
  Box,
  Banner,
  ProgressBar,
  Tooltip,
  Tabs,
  IndexTable,
  useIndexResourceState,
} from "@shopify/polaris";
import {
  AutomationIcon,
  ChartVerticalIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  CheckIcon,
  XIcon,
  RefreshIcon,
  AlertCircleIcon,
  ClockIcon,
} from "@shopify/polaris-icons";
import { useState, useCallback } from "react";

import { authenticate } from "~/shopify.server";
import { getShopByDomain } from "~/models/shop.server";
import { getPricingInsights, getPricingInsightStats, updateInsightStatus, bulkApplyInsights, bulkDismissInsights } from "~/models/pricing-insight.server";
import { getMLModelConfig, upsertMLModelConfig } from "~/services/ml-pricing.server";
import { getAutoApplyRules, getAutoApplyStats, createAutoApplyRule, updateAutoApplyRule } from "~/services/auto-apply.server";
import { createABTestFromInsight, getInsightABTestResults } from "~/models/ab-test.server";
import type { InsightStatus } from "@prisma/client";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

  const shop = await getShopByDomain(session.shop);
  if (!shop) {
    throw new Response("Shop not found", { status: 404 });
  }

  const [insights, stats, mlConfig, autoApplyRules, autoApplyStats] = await Promise.all([
    getPricingInsights(shop.id),
    getPricingInsightStats(shop.id),
    getMLModelConfig(shop.id),
    getAutoApplyRules(shop.id),
    getAutoApplyStats(shop.id),
  ]);

  // Enrich insights with product data from Shopify
  const productIds = insights.map((i) => i.productId).filter(Boolean);
  let productData: Record<string, { title: string; image: string }> = {};

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
            }
          }
        }
      `, {
        variables: { ids: productIds },
      });

      const data = await response.json();
      if (data.data?.nodes) {
        productData = data.data.nodes.reduce((acc: Record<string, { title: string; image: string }>, node: { id: string; title: string; featuredImage?: { url: string } } | null) => {
          if (node && node.id) {
            acc[node.id] = {
              title: node.title,
              image: node.featuredImage?.url || "",
            };
          }
          return acc;
        }, {});
      }
    } catch (error) {
      console.error("Error fetching product data:", error);
    }
  }

  // Merge product data with insights
  const enrichedInsights = insights.map((insight) => ({
    ...insight,
    productTitle: productData[insight.productId]?.title || "Unknown Product",
    productImage: productData[insight.productId]?.image || "",
  }));

  return json({
    insights: enrichedInsights,
    stats: {
      totalInsights: stats.totalInsights,
      pendingReview: stats.newInsights,
      applied: stats.appliedInsights,
      totalRevenueLift: stats.totalPotentialLift,
      avgConfidence: stats.avgConfidence,
      autoAppliedToday: autoApplyStats.appliedToday,
      autoAppliedLast30Days: autoApplyStats.appliedLast30Days,
    },
    mlConfig: mlConfig ? {
      weightDemand: Number(mlConfig.weightDemand),
      weightInventory: Number(mlConfig.weightInventory),
      weightCompetitor: Number(mlConfig.weightCompetitor),
      weightConversion: Number(mlConfig.weightConversion),
      weightMargin: Number(mlConfig.weightMargin),
      weightSeasonality: Number(mlConfig.weightSeasonality),
      minMarginPercent: Number(mlConfig.minMarginPercent),
      maxPriceIncrease: Number(mlConfig.maxPriceIncrease),
      maxPriceDecrease: Number(mlConfig.maxPriceDecrease),
      minConfidenceShow: Number(mlConfig.minConfidenceShow),
      minConfidenceApply: Number(mlConfig.minConfidenceApply),
    } : null,
    autoApplyRules: autoApplyRules.map(rule => ({
      id: rule.id,
      name: rule.name,
      status: rule.status,
      minConfidence: Number(rule.minConfidence),
      maxPriceChangePercent: Number(rule.maxPriceChangePercent),
      allowIncrease: rule.allowIncrease,
      allowDecrease: rule.allowDecrease,
      totalApplied: rule.totalApplied,
    })),
    settings: {
      autoApplyEnabled: autoApplyRules.some(r => r.status === "ACTIVE"),
      minConfidence: mlConfig ? Number(mlConfig.minConfidenceShow) * 100 : 50,
      maxPriceChange: mlConfig ? Number(mlConfig.maxPriceIncrease) : 20,
      minMargin: mlConfig ? Number(mlConfig.minMarginPercent) : 10,
    },
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const shop = await getShopByDomain(session.shop);
  if (!shop) {
    throw new Response("Shop not found", { status: 404 });
  }

  const formData = await request.formData();
  const action = formData.get("action") as string;

  switch (action) {
    case "updateSettings": {
      const minConfidence = parseFloat(formData.get("minConfidence") as string) / 100;
      const maxPriceIncrease = parseFloat(formData.get("maxPriceChange") as string);
      const minMarginPercent = parseFloat(formData.get("minMargin") as string);

      await upsertMLModelConfig(shop.id, {
        minConfidenceShow: minConfidence,
        maxPriceIncrease,
        maxPriceDecrease: maxPriceIncrease,
        minMarginPercent,
      });

      return json({ success: true });
    }

    case "applyInsight": {
      const insightId = formData.get("insightId") as string;
      await updateInsightStatus(insightId, "APPLIED");
      return json({ success: true });
    }

    case "dismissInsight": {
      const insightId = formData.get("insightId") as string;
      await updateInsightStatus(insightId, "DISMISSED");
      return json({ success: true });
    }

    case "bulkApply": {
      const insightIds = JSON.parse(formData.get("insightIds") as string);
      await bulkApplyInsights(insightIds);
      return json({ success: true });
    }

    case "bulkDismiss": {
      const insightIds = JSON.parse(formData.get("insightIds") as string);
      await bulkDismissInsights(insightIds);
      return json({ success: true });
    }

    case "createABTest": {
      const insightId = formData.get("insightId") as string;
      const test = await createABTestFromInsight(shop.id, insightId);
      return json({ success: true, testId: test.id });
    }

    case "toggleAutoApply": {
      const ruleId = formData.get("ruleId") as string;
      const enabled = formData.get("enabled") === "true";

      if (ruleId) {
        await updateAutoApplyRule(ruleId, {
          status: enabled ? "ACTIVE" : "PAUSED",
        });
      } else if (enabled) {
        // Create a default auto-apply rule if none exists
        await createAutoApplyRule(shop.id, {
          name: "Default Auto-Apply Rule",
          minConfidence: 0.85,
          maxPriceChangePercent: 15,
          applyToAllProducts: true,
        });
      }

      return json({ success: true });
    }

    default:
      return json({ error: "Unknown action" }, { status: 400 });
  }
};

export default function AIPricingDashboard() {
  const { insights, stats, settings, autoApplyRules, mlConfig } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isLoading = navigation.state !== "idle";

  const [selectedTab, setSelectedTab] = useState(0);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [aiSettings, setAiSettings] = useState({
    minConfidence: settings.minConfidence,
    maxPriceChange: settings.maxPriceChange,
    minMargin: settings.minMargin,
    autoApplyEnabled: settings.autoApplyEnabled,
  });

  const handleApplyInsight = useCallback((insightId: string) => {
    const formData = new FormData();
    formData.append("action", "applyInsight");
    formData.append("insightId", insightId);
    submit(formData, { method: "post" });
  }, [submit]);

  const handleDismissInsight = useCallback((insightId: string) => {
    const formData = new FormData();
    formData.append("action", "dismissInsight");
    formData.append("insightId", insightId);
    submit(formData, { method: "post" });
  }, [submit]);

  const handleCreateABTest = useCallback((insightId: string) => {
    const formData = new FormData();
    formData.append("action", "createABTest");
    formData.append("insightId", insightId);
    submit(formData, { method: "post" });
  }, [submit]);

  const handleSaveSettings = useCallback(() => {
    const formData = new FormData();
    formData.append("action", "updateSettings");
    formData.append("minConfidence", aiSettings.minConfidence.toString());
    formData.append("maxPriceChange", aiSettings.maxPriceChange.toString());
    formData.append("minMargin", aiSettings.minMargin.toString());
    submit(formData, { method: "post" });
    setShowSettingsModal(false);
  }, [submit, aiSettings]);

  const handleToggleAutoApply = useCallback((enabled: boolean) => {
    const formData = new FormData();
    formData.append("action", "toggleAutoApply");
    formData.append("enabled", enabled.toString());
    if (autoApplyRules.length > 0) {
      formData.append("ruleId", autoApplyRules[0].id);
    }
    submit(formData, { method: "post" });
  }, [submit, autoApplyRules]);

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(insights);

  const handleBulkApply = useCallback(() => {
    const formData = new FormData();
    formData.append("action", "bulkApply");
    formData.append("insightIds", JSON.stringify(selectedResources));
    submit(formData, { method: "post" });
  }, [submit, selectedResources]);

  const handleBulkDismiss = useCallback(() => {
    const formData = new FormData();
    formData.append("action", "bulkDismiss");
    formData.append("insightIds", JSON.stringify(selectedResources));
    submit(formData, { method: "post" });
  }, [submit, selectedResources]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getConfidenceBadge = (score: number) => {
    if (score >= 0.85) return <Badge tone="success">High Confidence</Badge>;
    if (score >= 0.7) return <Badge tone="attention">Medium Confidence</Badge>;
    return <Badge tone="warning">Low Confidence</Badge>;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "NEW":
        return <Badge tone="info">New</Badge>;
      case "VIEWED":
        return <Badge>Viewed</Badge>;
      case "APPLIED":
        return <Badge tone="success">Applied</Badge>;
      case "DISMISSED":
        return <Badge tone="critical">Dismissed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const tabs = [
    { id: "all", content: "All Insights", badge: insights.length.toString() },
    { id: "increase", content: "Price Increases", badge: insights.filter(i => i.direction === "increase").length.toString() },
    { id: "decrease", content: "Price Decreases", badge: insights.filter(i => i.direction === "decrease").length.toString() },
    { id: "applied", content: "Applied", badge: "12" },
  ];

  const filteredInsights = insights.filter(insight => {
    if (selectedTab === 0) return true;
    if (selectedTab === 1) return insight.direction === "increase";
    if (selectedTab === 2) return insight.direction === "decrease";
    if (selectedTab === 3) return insight.status === "APPLIED";
    return true;
  });

  return (
    <Page
      title="AI Pricing Optimizer"
      subtitle="Smart pricing recommendations powered by machine learning"
      primaryAction={{
        content: "Refresh Insights",
        icon: RefreshIcon,
        onAction: () => {},
      }}
      secondaryActions={[
        {
          content: "Settings",
          onAction: () => setShowSettingsModal(true),
        },
      ]}
    >
      <BlockStack gap="600">
        {/* Stats Overview */}
        <Layout>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text variant="bodySm" as="span" tone="subdued">Pending Review</Text>
                  <Icon source={AutomationIcon} tone="info" />
                </InlineStack>
                <Text variant="headingXl" as="h3">{stats.pendingReview}</Text>
                <Text variant="bodySm" as="p" tone="subdued">New suggestions</Text>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text variant="bodySm" as="span" tone="subdued">Applied</Text>
                  <Icon source={CheckIcon} tone="success" />
                </InlineStack>
                <Text variant="headingXl" as="h3">{stats.applied}</Text>
                <Text variant="bodySm" as="p" tone="subdued">Recommendations used</Text>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text variant="bodySm" as="span" tone="subdued">Revenue Lift</Text>
                  <Icon source={ChartVerticalIcon} tone="success" />
                </InlineStack>
                <Text variant="headingXl" as="h3" tone="success">
                  +{formatCurrency(stats.totalRevenueLift)}
                </Text>
                <Text variant="bodySm" as="p" tone="subdued">From applied suggestions</Text>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text variant="bodySm" as="span" tone="subdued">Avg. Confidence</Text>
                  <Icon source={AutomationIcon} tone="base" />
                </InlineStack>
                <Text variant="headingXl" as="h3">{stats.avgConfidence}%</Text>
                <ProgressBar progress={stats.avgConfidence} size="small" tone="primary" />
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* How it works */}
        <Banner title="How AI Pricing Works" tone="info">
          <BlockStack gap="200">
            <Text as="p">Our AI analyzes multiple signals to suggest optimal prices:</Text>
            <InlineStack gap="400">
              <Text variant="bodySm" as="span">📊 Demand patterns</Text>
              <Text variant="bodySm" as="span">📦 Inventory levels</Text>
              <Text variant="bodySm" as="span">💰 Competitor pricing</Text>
              <Text variant="bodySm" as="span">📈 Conversion rates</Text>
              <Text variant="bodySm" as="span">🕐 Time-based trends</Text>
            </InlineStack>
          </BlockStack>
        </Banner>

        {/* Tabs */}
        <Card padding="0">
          <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
            <Box padding="400">
              {filteredInsights.length === 0 ? (
                <EmptyState
                  heading="No insights available"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>Check back later for new pricing recommendations.</p>
                </EmptyState>
              ) : (
                <BlockStack gap="400">
                  {selectedResources.length > 0 && (
                    <InlineStack gap="200">
                      <Button onClick={handleBulkApply} loading={isLoading}>
                        {`Apply Selected (${selectedResources.length})`}
                      </Button>
                      <Button onClick={handleBulkDismiss} loading={isLoading}>
                        Dismiss Selected
                      </Button>
                    </InlineStack>
                  )}

                  {filteredInsights.map((insight) => (
                    <Box
                      key={insight.id}
                      padding="400"
                      background="bg-surface-secondary"
                      borderRadius="200"
                      borderWidth="025"
                      borderColor="border"
                    >
                      <BlockStack gap="400">
                        <InlineStack align="space-between" blockAlign="start">
                          {/* Product Info */}
                          <InlineStack gap="400" blockAlign="center">
                            <Thumbnail
                              source={insight.productImage}
                              alt={insight.productTitle}
                              size="medium"
                            />

                            <BlockStack gap="200">
                              <InlineStack gap="200" blockAlign="center">
                                <Text variant="headingSm" as="h3">
                                  {insight.productTitle}
                                </Text>
                                {getStatusBadge(insight.status)}
                                {getConfidenceBadge(insight.confidenceScore)}
                              </InlineStack>

                              <InlineStack gap="400" blockAlign="center">
                                {/* Price Change */}
                                <InlineStack gap="200" blockAlign="center">
                                  <Text variant="bodyMd" as="span" tone="subdued">
                                    {formatCurrency(insight.currentPrice)}
                                  </Text>
                                  <Text variant="bodyMd" as="span">→</Text>
                                  <Text
                                    variant="headingMd"
                                    as="span"
                                    tone={insight.direction === "increase" ? "caution" : "success"}
                                  >
                                    {formatCurrency(insight.suggestedPrice)}
                                  </Text>
                                  <Badge
                                    tone={insight.direction === "increase" ? "attention" : "success"}
                                  >
                                    {`${insight.direction === "increase" ? "+" : ""}${insight.priceChange.toFixed(1)}%`}
                                  </Badge>
                                </InlineStack>

                                <Text variant="bodySm" as="span" tone="subdued">|</Text>

                                {/* Reason */}
                                <InlineStack gap="100" blockAlign="center">
                                  <Icon source={AutomationIcon} tone="subdued" />
                                  <Text variant="bodySm" as="span" tone="subdued">
                                    {insight.reason}
                                  </Text>
                                </InlineStack>
                              </InlineStack>
                            </BlockStack>
                          </InlineStack>

                          {/* Actions */}
                          <InlineStack gap="200">
                            <Button
                              variant="primary"
                              onClick={() => handleApplyInsight(insight.id)}
                              icon={CheckIcon}
                              loading={isLoading}
                              disabled={insight.status === "APPLIED" || insight.status === "DISMISSED"}
                            >
                              Apply
                            </Button>
                            <Button
                              onClick={() => handleCreateABTest(insight.id)}
                              disabled={insight.status === "APPLIED" || insight.status === "DISMISSED"}
                            >
                              A/B Test
                            </Button>
                            <Button
                              onClick={() => handleDismissInsight(insight.id)}
                              icon={XIcon}
                              loading={isLoading}
                              disabled={insight.status === "APPLIED" || insight.status === "DISMISSED"}
                            >
                              Dismiss
                            </Button>
                          </InlineStack>
                        </InlineStack>

                        {/* Factors */}
                        <Divider />

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '16px' }}>
                          <BlockStack gap="100">
                            <Text variant="bodySm" as="span" tone="subdued">Demand Score</Text>
                            <InlineStack gap="100" blockAlign="center">
                              <Text variant="headingSm" as="p">{insight.factors.demandScore}</Text>
                              <ProgressBar
                                progress={insight.factors.demandScore}
                                size="small"
                                tone={insight.factors.demandScore > 70 ? "success" : "primary"}
                              />
                            </InlineStack>
                          </BlockStack>

                          <BlockStack gap="100">
                            <Text variant="bodySm" as="span" tone="subdued">Inventory</Text>
                            <Text variant="headingSm" as="p">{insight.factors.inventoryLevel} units</Text>
                          </BlockStack>

                          <BlockStack gap="100">
                            <Text variant="bodySm" as="span" tone="subdued">Competitor Avg</Text>
                            <Text variant="headingSm" as="p">
                              {formatCurrency(insight.factors.competitorAvg)}
                            </Text>
                          </BlockStack>

                          <BlockStack gap="100">
                            <Text variant="bodySm" as="span" tone="subdued">Views (7d)</Text>
                            <Text variant="headingSm" as="p">
                              {insight.factors.viewsLast7Days.toLocaleString()}
                            </Text>
                          </BlockStack>

                          <BlockStack gap="100">
                            <Text variant="bodySm" as="span" tone="subdued">Sales (7d)</Text>
                            <Text variant="headingSm" as="p">{insight.factors.salesLast7Days}</Text>
                          </BlockStack>

                          <BlockStack gap="100">
                            <Text variant="bodySm" as="span" tone="subdued">Conv. Rate</Text>
                            <Text variant="headingSm" as="p" tone="success">
                              {insight.factors.conversionRate}%
                            </Text>
                          </BlockStack>
                        </div>

                        {/* Potential Impact */}
                        <Box padding="300" background="bg-surface-success" borderRadius="100">
                          <InlineStack align="space-between">
                            <Text variant="bodySm" as="span">
                              💰 Potential monthly revenue lift:
                            </Text>
                            <Text variant="bodySm" as="span" fontWeight="semibold" tone="success">
                              +{formatCurrency(insight.potentialRevenueLift)}
                            </Text>
                          </InlineStack>
                        </Box>
                      </BlockStack>
                    </Box>
                  ))}
                </BlockStack>
              )}
            </Box>
          </Tabs>
        </Card>

        {/* Settings Modal */}
        <Modal
          open={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          title="AI Pricing Settings"
          primaryAction={{
            content: "Save Settings",
            onAction: handleSaveSettings,
            loading: isLoading,
          }}
          secondaryActions={[
            {
              content: "Cancel",
              onAction: () => setShowSettingsModal(false),
            },
          ]}
        >
          <Modal.Section>
            <BlockStack gap="500">
              <Text variant="headingMd" as="h3">Display Settings</Text>

              <TextField
                label="Minimum Confidence Score (%)"
                type="number"
                value={aiSettings.minConfidence.toString()}
                onChange={(value) => setAiSettings({ ...aiSettings, minConfidence: parseInt(value) || 0 })}
                helpText="Only show suggestions above this confidence level (0-100)"
                autoComplete="off"
                min={0}
                max={100}
              />

              <Divider />

              <Text variant="headingMd" as="h3">Price Constraints</Text>

              <TextField
                label="Maximum Price Change (%)"
                type="number"
                value={aiSettings.maxPriceChange.toString()}
                onChange={(value) => setAiSettings({ ...aiSettings, maxPriceChange: parseInt(value) || 0 })}
                helpText="Limit how much AI can suggest changing prices (both increase and decrease)"
                autoComplete="off"
                min={1}
                max={50}
              />

              <TextField
                label="Minimum Profit Margin (%)"
                type="number"
                value={aiSettings.minMargin.toString()}
                onChange={(value) => setAiSettings({ ...aiSettings, minMargin: parseInt(value) || 0 })}
                helpText="AI will never suggest prices below this margin (requires cost price data)"
                autoComplete="off"
                min={0}
                max={90}
              />

              <Divider />

              <Text variant="headingMd" as="h3">Auto-Apply</Text>

              <Banner tone={aiSettings.autoApplyEnabled ? "success" : "info"}>
                <BlockStack gap="200">
                  <InlineStack align="space-between" blockAlign="center">
                    <BlockStack gap="100">
                      <Text variant="bodyMd" as="p" fontWeight="semibold">
                        {aiSettings.autoApplyEnabled ? "Auto-Apply is Enabled" : "Auto-Apply is Disabled"}
                      </Text>
                      <Text variant="bodySm" as="p" tone="subdued">
                        {aiSettings.autoApplyEnabled
                          ? `Automatically applying high-confidence suggestions (≥85%)`
                          : "Enable to automatically apply high-confidence price changes"
                        }
                      </Text>
                    </BlockStack>
                    <Button
                      onClick={() => {
                        setAiSettings({ ...aiSettings, autoApplyEnabled: !aiSettings.autoApplyEnabled });
                        handleToggleAutoApply(!aiSettings.autoApplyEnabled);
                      }}
                    >
                      {aiSettings.autoApplyEnabled ? "Disable" : "Enable"}
                    </Button>
                  </InlineStack>

                  {aiSettings.autoApplyEnabled && (
                    <Box paddingBlockStart="200">
                      <BlockStack gap="100">
                        <Text variant="bodySm" as="p">Auto-apply rules:</Text>
                        <Text variant="bodySm" as="p" tone="subdued">
                          • Confidence ≥ 85%
                        </Text>
                        <Text variant="bodySm" as="p" tone="subdued">
                          • Price change ≤ 15%
                        </Text>
                        <Text variant="bodySm" as="p" tone="subdued">
                          • Maintains minimum profit margin
                        </Text>
                        <Text variant="bodySm" as="p" tone="subdued">
                          • Max 10 auto-applies per day
                        </Text>
                      </BlockStack>
                    </Box>
                  )}
                </BlockStack>
              </Banner>

              {stats.autoAppliedLast30Days > 0 && (
                <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                  <InlineStack align="space-between">
                    <Text variant="bodySm" as="span">Auto-applied today:</Text>
                    <Text variant="bodySm" as="span" fontWeight="semibold">{stats.autoAppliedToday}</Text>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text variant="bodySm" as="span">Auto-applied (30 days):</Text>
                    <Text variant="bodySm" as="span" fontWeight="semibold">{stats.autoAppliedLast30Days}</Text>
                  </InlineStack>
                </Box>
              )}

              <Divider />

              <Text variant="headingMd" as="h3">ML Model Weights</Text>
              <Text variant="bodySm" as="p" tone="subdued">
                Adjust how much weight each factor has in pricing decisions. Values should sum to 1.0.
              </Text>

              {mlConfig && (
                <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                  <BlockStack gap="200">
                    <InlineStack align="space-between">
                      <Text variant="bodySm" as="span">Demand Score</Text>
                      <Text variant="bodySm" as="span">{(mlConfig.weightDemand * 100).toFixed(0)}%</Text>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text variant="bodySm" as="span">Inventory Level</Text>
                      <Text variant="bodySm" as="span">{(mlConfig.weightInventory * 100).toFixed(0)}%</Text>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text variant="bodySm" as="span">Competitor Position</Text>
                      <Text variant="bodySm" as="span">{(mlConfig.weightCompetitor * 100).toFixed(0)}%</Text>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text variant="bodySm" as="span">Conversion Rate</Text>
                      <Text variant="bodySm" as="span">{(mlConfig.weightConversion * 100).toFixed(0)}%</Text>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text variant="bodySm" as="span">Profit Margin</Text>
                      <Text variant="bodySm" as="span">{(mlConfig.weightMargin * 100).toFixed(0)}%</Text>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text variant="bodySm" as="span">Seasonality</Text>
                      <Text variant="bodySm" as="span">{(mlConfig.weightSeasonality * 100).toFixed(0)}%</Text>
                    </InlineStack>
                  </BlockStack>
                </Box>
              )}

              {!mlConfig && (
                <Text variant="bodySm" as="p" tone="subdued">
                  Using default weights. Weights will be customizable after first insight generation.
                </Text>
              )}
            </BlockStack>
          </Modal.Section>
        </Modal>
      </BlockStack>
    </Page>
  );
}
