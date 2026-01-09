/**
 * Geo Targeting Rules List Route
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate, useSubmit } from "@remix-run/react";
import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Badge,
  IndexTable,
  EmptyState,
  Layout,
  Box,
} from "@shopify/polaris";
import { useState } from "react";
import { PlusIcon } from "@shopify/polaris-icons";

import { authenticate } from "~/shopify.server";
import { DeleteConfirmModal } from "~/components/DeleteConfirmModal";
import { getShopByDomain, getLocaleSettings } from "~/models/shop.server";
import { getGeoRules, updateGeoRuleStatus, deleteGeoRule } from "~/models/geo-rules.server";
import { COUNTRY_DATA } from "~/utils/country-data";
import { getTranslations } from "~/i18n";
import { requireFeatureAccess } from "~/utils/plan-guard.server";
import type { RuleStatus } from "@prisma/client";

// Local type until Prisma migration
type GeoAdjustmentType = "PERCENTAGE" | "FIXED_AMOUNT" | "FIXED_PRICE" | "MULTIPLIER";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  // Check if user has access (PROFESSIONAL plan required for multi-currency/geo)
  await requireFeatureAccess(session.shop, "multiCurrency");

  const shop = await getShopByDomain(session.shop);
  if (!shop) {
    throw new Response("Shop not found", { status: 404 });
  }

  const rules = await getGeoRules(shop.id);

  const localeSettings = await getLocaleSettings(session.shop);
  const locale = localeSettings?.locale || "en";
  const t = getTranslations(locale);

  return json({
    rules: rules.map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status,
      priority: r.priority,
      countries: r.countries,
      adjustmentType: r.adjustmentType,
      adjustmentValue: Number(r.adjustmentValue),
      applyTo: r.applyTo,
      displayCurrency: r.displayCurrency,
    })),
    shopId: shop.id,
    currency: shop.currencySymbol || "$",
    t,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("action");

  switch (action) {
    case "updateStatus": {
      const ruleId = formData.get("ruleId") as string;
      const status = formData.get("status") as RuleStatus;
      await updateGeoRuleStatus(ruleId, status);
      return json({ success: true });
    }
    case "delete": {
      const ruleId = formData.get("ruleId") as string;
      await deleteGeoRule(ruleId);
      return json({ success: true });
    }
    default:
      return json({ error: "Unknown action" }, { status: 400 });
  }
};

const ADJUSTMENT_TYPE_LABELS: Record<GeoAdjustmentType, string> = {
  PERCENTAGE: "% Adjustment",
  FIXED_AMOUNT: "Fixed Amount",
  FIXED_PRICE: "Fixed Price",
  MULTIPLIER: "Multiplier",
};

export default function GeoTargetingList() {
  const { rules, currency, t } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const submit = useSubmit();

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<{ id: string; name: string } | null>(null);

  const handleStatusChange = (ruleId: string, status: RuleStatus) => {
    submit({ action: "updateStatus", ruleId, status }, { method: "POST" });
  };

  const openDeleteModal = (rule: { id: string; name: string }) => {
    setRuleToDelete(rule);
    setDeleteModalOpen(true);
  };

  const handleDelete = () => {
    if (ruleToDelete) {
      submit({ action: "delete", ruleId: ruleToDelete.id }, { method: "POST" });
      setDeleteModalOpen(false);
      setRuleToDelete(null);
    }
  };

  const getStatusBadge = (status: RuleStatus) => {
    const config = {
      DRAFT: { tone: "info" as const, label: t.rules.draft },
      ACTIVE: { tone: "success" as const, label: t.rules.active },
      PAUSED: { tone: "warning" as const, label: t.rules.paused },
      ARCHIVED: { tone: "critical" as const, label: t.rules.archived },
    };
    const c = config[status];
    return <Badge tone={c.tone}>{c.label}</Badge>;
  };

  const formatCountries = (countries: string[]) => {
    if (countries.length === 0) return "All Countries";
    if (countries.length <= 3) {
      return countries.map((c) => COUNTRY_DATA[c]?.name || c).join(", ");
    }
    return `${countries.slice(0, 2).map((c) => COUNTRY_DATA[c]?.name || c).join(", ")} +${countries.length - 2} more`;
  };

  const formatAdjustment = (type: GeoAdjustmentType, value: number) => {
    const sign = value >= 0 ? "+" : "";
    switch (type) {
      case "PERCENTAGE":
        return `${sign}${value}%`;
      case "FIXED_AMOUNT":
        return `${sign}${currency}${value}`;
      case "FIXED_PRICE":
        return `= ${currency}${value}`;
      case "MULTIPLIER":
        return `×${value}`;
      default:
        return String(value);
    }
  };

  const rowMarkup = rules.map((rule, index) => (
    <IndexTable.Row id={rule.id} key={rule.id} position={index}>
      <IndexTable.Cell>
        <BlockStack gap="100">
          <Text variant="bodyMd" fontWeight="semibold" as="span">
            {rule.name}
          </Text>
          <Text variant="bodySm" tone="subdued" as="span">
            Priority: {rule.priority}
          </Text>
        </BlockStack>
      </IndexTable.Cell>
      <IndexTable.Cell>{getStatusBadge(rule.status as RuleStatus)}</IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodyMd" as="span">
          {formatCountries(rule.countries)}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge
          tone={rule.adjustmentValue >= 0 ? "warning" : "success"}
        >
          {formatAdjustment(rule.adjustmentType as GeoAdjustmentType, rule.adjustmentValue)}
        </Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {rule.displayCurrency && (
          <Badge>{rule.displayCurrency}</Badge>
        )}
      </IndexTable.Cell>
      <IndexTable.Cell>
        <InlineStack gap="200">
          <Button size="slim" onClick={() => navigate(`/app/geo-targeting/${rule.id}`)}>
            {t.common.edit}
          </Button>
          {rule.status === "DRAFT" && (
            <Button size="slim" tone="success" onClick={() => handleStatusChange(rule.id, "ACTIVE")}>
              Activate
            </Button>
          )}
          {rule.status === "ACTIVE" && (
            <Button size="slim" onClick={() => handleStatusChange(rule.id, "PAUSED")}>
              Pause
            </Button>
          )}
          <Button size="slim" tone="critical" onClick={() => openDeleteModal(rule)}>
            {t.common.delete}
          </Button>
        </InlineStack>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  const emptyState = (
    <EmptyState
      heading="Create your first Geo Rule"
      action={{
        content: "Create Geo Rule",
        onAction: () => navigate("/app/geo-targeting/new"),
      }}
      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
    >
      <p>
        Customize pricing based on customer location. Adjust prices for different countries and regions.
      </p>
    </EmptyState>
  );

  // Stats
  const activeRules = rules.filter((r) => r.status === "ACTIVE").length;
  const totalCountries = new Set(rules.flatMap((r) => r.countries)).size;

  return (
    <Page
      title="Geo Targeting"
      subtitle="Location-based pricing rules"
      primaryAction={{
        content: "Create Geo Rule",
        icon: PlusIcon,
        onAction: () => navigate("/app/geo-targeting/new"),
      }}
      backAction={{ content: t.nav.dashboard, url: "/app" }}
    >
      <BlockStack gap="500">
        {/* Info Banner */}
        <Card>
          <BlockStack gap="300">
            <Text variant="headingSm" as="h3">🌍 How Geo Targeting Works</Text>
            <Text variant="bodyMd" as="p">
              Automatically adjust prices based on customer location. Perfect for:
            </Text>
            <InlineStack gap="400" wrap>
              <Box padding="200" background="bg-surface-secondary" borderRadius="200">
                <Text variant="bodySm" as="span">EU VAT compliance</Text>
              </Box>
              <Box padding="200" background="bg-surface-secondary" borderRadius="200">
                <Text variant="bodySm" as="span">Regional pricing strategy</Text>
              </Box>
              <Box padding="200" background="bg-surface-secondary" borderRadius="200">
                <Text variant="bodySm" as="span">Currency conversion markup</Text>
              </Box>
              <Box padding="200" background="bg-surface-secondary" borderRadius="200">
                <Text variant="bodySm" as="span">Market-specific discounts</Text>
              </Box>
            </InlineStack>
          </BlockStack>
        </Card>

        {/* Stats Cards */}
        <Layout>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">Active Rules</Text>
                <Text variant="headingXl" as="p">{activeRules}</Text>
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">Countries Covered</Text>
                <Text variant="headingXl" as="p">{totalCountries}</Text>
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">Total Rules</Text>
                <Text variant="headingXl" as="p">{rules.length}</Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Common Regions */}
        <Card>
          <BlockStack gap="300">
            <Text variant="headingSm" as="h3">Quick Setup - Popular Regions</Text>
            <InlineStack gap="200" wrap>
              <Button onClick={() => navigate("/app/geo-targeting/new?region=eu")}>
                🇪🇺 European Union
              </Button>
              <Button onClick={() => navigate("/app/geo-targeting/new?region=na")}>
                🇺🇸 North America
              </Button>
              <Button onClick={() => navigate("/app/geo-targeting/new?region=apac")}>
                🌏 Asia Pacific
              </Button>
              <Button onClick={() => navigate("/app/geo-targeting/new?region=latam")}>
                🌎 Latin America
              </Button>
            </InlineStack>
          </BlockStack>
        </Card>

        {/* Rules Table */}
        <Card padding="0">
          {rules.length === 0 ? (
            emptyState
          ) : (
            <IndexTable
              resourceName={{ singular: "geo rule", plural: "geo rules" }}
              itemCount={rules.length}
              headings={[
                { title: "Name" },
                { title: "Status" },
                { title: "Countries" },
                { title: "Adjustment" },
                { title: "Currency" },
                { title: "Actions" },
              ]}
              selectable={false}
            >
              {rowMarkup}
            </IndexTable>
          )}
        </Card>
      </BlockStack>

      <DeleteConfirmModal
        open={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setRuleToDelete(null);
        }}
        onConfirm={handleDelete}
        itemName={ruleToDelete?.name}
        itemType="geo rule"
      />
    </Page>
  );
}
