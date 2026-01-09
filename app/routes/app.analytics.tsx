/**
 * Analytics Dashboard Route
 *
 * Shows discount performance metrics, revenue impact, and usage trends.
 */

import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Box,
  Divider,
  Badge,
  DataTable,
  Select,
  SkeletonBodyText,
} from "@shopify/polaris";
import { useState } from "react";

import { authenticate } from "~/shopify.server";
import { getShopByDomain, getLocaleSettings } from "~/models/shop.server";
import { getAnalyticsSummary } from "~/models/analytics.server";
import { getTranslations } from "~/i18n";
import { requireFeatureAccess } from "~/utils/plan-guard.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  // Check if user has access (PROFESSIONAL plan required for advanced analytics)
  await requireFeatureAccess(session.shop, "competitorTracking");

  const url = new URL(request.url);
  const days = parseInt(url.searchParams.get("days") || "30", 10);

  const shop = await getShopByDomain(session.shop);
  if (!shop) {
    throw new Response("Shop not found", { status: 404 });
  }

  const analytics = await getAnalyticsSummary(shop.id, days);

  const localeSettings = await getLocaleSettings(session.shop);
  const locale = localeSettings?.locale || "en";
  const t = getTranslations(locale);

  return json({ analytics, days, currency: "USD", t, locale });
};

export default function Analytics() {
  const { analytics, days, currency, t, locale } = useLoaderData<typeof loader>();
  const [selectedPeriod, setSelectedPeriod] = useState(days.toString());

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(locale === "en" ? "en-US" : locale, {
      style: "currency",
      currency,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  // Prepare data for charts (simple bar representation)
  const maxRevenue = Math.max(
    ...analytics.dailyStats.map((d) => d.revenue),
    1
  );

  return (
    <Page
      title={t.analyticsPage.title}
      subtitle={t.analyticsPage.subtitle}
      backAction={{ content: t.analyticsPage.backToHome, url: "/app" }}
      secondaryActions={[
        {
          content: t.analyticsPage.exportDetailedCSV,
          onAction: () => {
            window.location.href = `/api/analytics-export?days=${selectedPeriod}&type=detailed`;
          },
        },
        {
          content: t.analyticsPage.exportSummaryCSV,
          onAction: () => {
            window.location.href = `/api/analytics-export?days=${selectedPeriod}&type=summary`;
          },
        },
      ]}
    >
      <BlockStack gap="500">
        {/* Period Selector */}
        <Card>
          <InlineStack align="space-between" blockAlign="center">
            <Text variant="headingSm" as="h3">
              {t.analyticsPage.timePeriod}
            </Text>
            <Select
              label=""
              labelHidden
              options={[
                { label: t.analyticsPage.last7Days, value: "7" },
                { label: t.analyticsPage.last30Days, value: "30" },
                { label: t.analyticsPage.last90Days, value: "90" },
              ]}
              value={selectedPeriod}
              onChange={(value) => {
                setSelectedPeriod(value);
                window.location.href = `/app/analytics?days=${value}`;
              }}
            />
          </InlineStack>
        </Card>

        {/* Summary Cards */}
        <Layout>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3" tone="subdued">
                  {t.analyticsPage.totalOrdersWithDiscount}
                </Text>
                <Text variant="heading2xl" as="p">
                  {analytics.summary.totalOrders}
                </Text>
                <Text variant="bodySm" tone="subdued" as="p">
                  {t.analyticsPage.ordersUsedVolumeDiscounts}
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3" tone="subdued">
                  {t.analyticsPage.revenueFromDiscountedOrders}
                </Text>
                <Text variant="heading2xl" as="p">
                  {formatCurrency(analytics.summary.totalRevenue)}
                </Text>
                <Text variant="bodySm" tone="success" as="p">
                  {formatCurrency(analytics.summary.totalDiscount)} {t.analyticsPage.savedByCustomers}
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3" tone="subdued">
                  {t.analyticsPage.averageDiscount}
                </Text>
                <Text variant="heading2xl" as="p">
                  {formatPercent(analytics.summary.averageDiscount)}
                </Text>
                <Text variant="bodySm" tone="subdued" as="p">
                  {t.analyticsPage.averageDiscountPerItem}
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Revenue Chart (Simple Bar) */}
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">
              {t.analyticsPage.dailyRevenueTrend}
            </Text>
            {analytics.dailyStats.length === 0 ? (
              <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                <Text as="p" alignment="center" tone="subdued">
                  {t.analyticsPage.noDiscountDataYet}
                </Text>
              </Box>
            ) : (
              <BlockStack gap="200">
                {analytics.dailyStats.slice(-14).map((day) => (
                  <InlineStack key={day.date} gap="300" align="start" blockAlign="center">
                    <Box minWidth="80px">
                      <Text variant="bodySm" as="span">
                        {new Date(day.date).toLocaleDateString(locale === "en" ? "en-US" : locale, {
                          month: "short",
                          day: "numeric",
                        })}
                      </Text>
                    </Box>
                    <Box minWidth="200px">
                      <Box
                        minHeight="20px"
                        background="bg-fill-success"
                        borderRadius="100"
                        minWidth={day.revenue > 0 ? "4px" : "0"}
                        width={`${(day.revenue / maxRevenue) * 100}%`}
                      />
                    </Box>
                    <Text variant="bodySm" as="span">
                      {formatCurrency(day.revenue)} ({day.orders} {t.analyticsPage.orders})
                    </Text>
                  </InlineStack>
                ))}
              </BlockStack>
            )}
          </BlockStack>
        </Card>

        {/* Top Performing Tiers */}
        <Layout>
          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  {t.analyticsPage.performanceByTier}
                </Text>
                {analytics.byTier.length === 0 ? (
                  <Text tone="subdued" as="p">
                    {t.analyticsPage.noTierDataYet}
                  </Text>
                ) : (
                  <DataTable
                    columnContentTypes={["text", "numeric", "numeric"]}
                    headings={[t.analyticsPage.tier, t.analyticsPage.uses, t.analyticsPage.revenue]}
                    rows={analytics.byTier.map((tier) => [
                      tier.tier,
                      tier.count.toString(),
                      formatCurrency(tier.revenue),
                    ])}
                  />
                )}
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  {t.analyticsPage.performanceByRule}
                </Text>
                {analytics.byRule.length === 0 ? (
                  <Text tone="subdued" as="p">
                    {t.analyticsPage.noRuleDataYet}
                  </Text>
                ) : (
                  <DataTable
                    columnContentTypes={["text", "numeric", "numeric"]}
                    headings={[t.analyticsPage.rule, t.analyticsPage.uses, t.analyticsPage.revenue]}
                    rows={analytics.byRule.map((r) => [
                      r.ruleId.slice(0, 8) + "...",
                      r.count.toString(),
                      formatCurrency(r.revenue),
                    ])}
                  />
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Top Products */}
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">
              {t.analyticsPage.topProductsByDiscountRevenue}
            </Text>
            {analytics.topProducts.length === 0 ? (
              <Text tone="subdued" as="p">
                {t.analyticsPage.noProductDataYet}
              </Text>
            ) : (
              <DataTable
                columnContentTypes={["text", "numeric", "numeric", "numeric"]}
                headings={[t.analyticsPage.product, t.analyticsPage.timesDiscounted, t.analyticsPage.unitsSold, t.analyticsPage.revenue]}
                rows={analytics.topProducts.map((p) => [
                  p.title,
                  p.count.toString(),
                  p.quantity.toString(),
                  formatCurrency(p.revenue),
                ])}
              />
            )}
          </BlockStack>
        </Card>

        {/* Recent Activity */}
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">
              {t.analyticsPage.recentDiscountUsage}
            </Text>
            {analytics.recentUsages.length === 0 ? (
              <Text tone="subdued" as="p">
                {t.analyticsPage.noRecentActivity}
              </Text>
            ) : (
              <DataTable
                columnContentTypes={[
                  "text",
                  "text",
                  "numeric",
                  "text",
                  "text",
                ]}
                headings={[t.analyticsPage.order, t.analyticsPage.product, t.analyticsPage.qty, t.analyticsPage.discount, t.analyticsPage.date]}
                rows={analytics.recentUsages.map((u) => [
                  `#${u.orderNumber}`,
                  u.productTitle || "N/A",
                  u.quantity.toString(),
                  `${formatPercent(u.discountPercent)} (${formatCurrency(u.discountAmount)})`,
                  new Date(u.createdAt).toLocaleDateString(locale === "en" ? "en-US" : locale),
                ])}
              />
            )}
          </BlockStack>
        </Card>

        {/* Pro Tips */}
        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd" as="h2">
              {t.analyticsPage.optimizationTips}
            </Text>
            <BlockStack gap="200">
              <InlineStack gap="200">
                <Badge tone="info">{t.analyticsPage.tip}</Badge>
                <Text as="p">
                  {t.analyticsPage.tip1}
                </Text>
              </InlineStack>
              <InlineStack gap="200">
                <Badge tone="info">{t.analyticsPage.tip}</Badge>
                <Text as="p">
                  {t.analyticsPage.tip2}
                </Text>
              </InlineStack>
              <InlineStack gap="200">
                <Badge tone="info">{t.analyticsPage.tip}</Badge>
                <Text as="p">
                  {t.analyticsPage.tip3}
                </Text>
              </InlineStack>
            </BlockStack>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
