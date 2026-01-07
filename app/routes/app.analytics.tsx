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
import { getShopByDomain } from "~/models/shop.server";
import { getAnalyticsSummary } from "~/models/analytics.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const url = new URL(request.url);
  const days = parseInt(url.searchParams.get("days") || "30", 10);

  const shop = await getShopByDomain(session.shop);
  if (!shop) {
    throw new Response("Shop not found", { status: 404 });
  }

  const analytics = await getAnalyticsSummary(shop.id, days);

  return json({ analytics, days, currency: "USD" });
};

export default function Analytics() {
  const { analytics, days, currency } = useLoaderData<typeof loader>();
  const [selectedPeriod, setSelectedPeriod] = useState(days.toString());

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
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
      title="Analytics Dashboard"
      subtitle="Track your discount performance and revenue impact"
      backAction={{ content: "Home", url: "/app" }}
      secondaryActions={[
        {
          content: "Export Detailed CSV",
          onAction: () => {
            window.location.href = `/api/analytics-export?days=${selectedPeriod}&type=detailed`;
          },
        },
        {
          content: "Export Summary CSV",
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
              Time Period
            </Text>
            <Select
              label=""
              labelHidden
              options={[
                { label: "Last 7 days", value: "7" },
                { label: "Last 30 days", value: "30" },
                { label: "Last 90 days", value: "90" },
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
                  Total Orders with Discount
                </Text>
                <Text variant="heading2xl" as="p">
                  {analytics.summary.totalOrders}
                </Text>
                <Text variant="bodySm" tone="subdued" as="p">
                  orders used volume discounts
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3" tone="subdued">
                  Revenue from Discounted Orders
                </Text>
                <Text variant="heading2xl" as="p">
                  {formatCurrency(analytics.summary.totalRevenue)}
                </Text>
                <Text variant="bodySm" tone="success" as="p">
                  {formatCurrency(analytics.summary.totalDiscount)} saved by customers
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3" tone="subdued">
                  Average Discount
                </Text>
                <Text variant="heading2xl" as="p">
                  {formatPercent(analytics.summary.averageDiscount)}
                </Text>
                <Text variant="bodySm" tone="subdued" as="p">
                  average discount per item
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Revenue Chart (Simple Bar) */}
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">
              Daily Revenue Trend
            </Text>
            {analytics.dailyStats.length === 0 ? (
              <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                <Text as="p" alignment="center" tone="subdued">
                  No discount usage data yet. Revenue will appear here once
                  customers start using your volume discounts.
                </Text>
              </Box>
            ) : (
              <BlockStack gap="200">
                {analytics.dailyStats.slice(-14).map((day) => (
                  <InlineStack key={day.date} gap="300" align="start" blockAlign="center">
                    <Box minWidth="80px">
                      <Text variant="bodySm" as="span">
                        {new Date(day.date).toLocaleDateString("en-US", {
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
                      {formatCurrency(day.revenue)} ({day.orders} orders)
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
                  Performance by Tier
                </Text>
                {analytics.byTier.length === 0 ? (
                  <Text tone="subdued" as="p">
                    No tier data yet
                  </Text>
                ) : (
                  <DataTable
                    columnContentTypes={["text", "numeric", "numeric"]}
                    headings={["Tier", "Uses", "Revenue"]}
                    rows={analytics.byTier.map((t) => [
                      t.tier,
                      t.count.toString(),
                      formatCurrency(t.revenue),
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
                  Performance by Rule
                </Text>
                {analytics.byRule.length === 0 ? (
                  <Text tone="subdued" as="p">
                    No rule data yet
                  </Text>
                ) : (
                  <DataTable
                    columnContentTypes={["text", "numeric", "numeric"]}
                    headings={["Rule", "Uses", "Revenue"]}
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
              Top Products by Discount Revenue
            </Text>
            {analytics.topProducts.length === 0 ? (
              <Text tone="subdued" as="p">
                No product data yet. This will show your best-performing
                products once customers start using discounts.
              </Text>
            ) : (
              <DataTable
                columnContentTypes={["text", "numeric", "numeric", "numeric"]}
                headings={["Product", "Times Discounted", "Units Sold", "Revenue"]}
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
              Recent Discount Usage
            </Text>
            {analytics.recentUsages.length === 0 ? (
              <Text tone="subdued" as="p">
                No recent activity. Discount usage will appear here in
                real-time.
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
                headings={["Order", "Product", "Qty", "Discount", "Date"]}
                rows={analytics.recentUsages.map((u) => [
                  `#${u.orderNumber}`,
                  u.productTitle || "N/A",
                  u.quantity.toString(),
                  `${formatPercent(u.discountPercent)} (${formatCurrency(u.discountAmount)})`,
                  new Date(u.createdAt).toLocaleDateString(),
                ])}
              />
            )}
          </BlockStack>
        </Card>

        {/* Pro Tips */}
        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd" as="h2">
              Optimization Tips
            </Text>
            <BlockStack gap="200">
              <InlineStack gap="200">
                <Badge tone="info">Tip</Badge>
                <Text as="p">
                  Products with high discount usage but low revenue might need
                  adjusted tier thresholds.
                </Text>
              </InlineStack>
              <InlineStack gap="200">
                <Badge tone="info">Tip</Badge>
                <Text as="p">
                  If average discount is below 10%, consider adding more
                  aggressive tiers to boost conversions.
                </Text>
              </InlineStack>
              <InlineStack gap="200">
                <Badge tone="info">Tip</Badge>
                <Text as="p">
                  Use countdown timers on your best-performing products to
                  create urgency.
                </Text>
              </InlineStack>
            </BlockStack>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
