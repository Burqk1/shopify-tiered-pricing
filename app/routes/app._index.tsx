/**
 * Dashboard Route (app._index.tsx)
 *
 * Main dashboard showing:
 * - Overview stats
 * - List of pricing rules
 * - Quick actions
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate, useSubmit } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Badge,
  IndexTable,
  useIndexResourceState,
  EmptyState,
  Banner,
} from "@shopify/polaris";
import { useState } from "react";
import { PlusIcon, RefreshIcon } from "@shopify/polaris-icons";

import { authenticate } from "~/shopify.server";
import { DeleteConfirmModal } from "~/components/DeleteConfirmModal";
import { getShopWithRules, canCreateRule, getPlanFeatures, getLocaleSettings } from "~/models/shop.server";
import { updateRuleStatus, deletePricingRule } from "~/models/pricing-rule.server";
import { syncRulesToShopify } from "~/services/sync-engine.server";
import { getSyncStats } from "~/models/sync-log.server";
import { getTranslations } from "~/i18n";
import type { RuleStatus } from "@prisma/client";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

  const shopData = await getShopWithRules(session.shop);

  if (!shopData) {
    throw new Response("Shop not found", { status: 404 });
  }

  const [canCreate, syncStats, localeSettings] = await Promise.all([
    canCreateRule(session.shop),
    getSyncStats(shopData.id),
    getLocaleSettings(session.shop),
  ]);

  const planFeatures = getPlanFeatures(shopData.plan);
  const locale = localeSettings?.locale || "en";
  const t = getTranslations(locale);

  return json({
    shop: {
      domain: session.shop,
      plan: shopData.plan,
      ruleLimit: planFeatures.ruleLimit,
    },
    rules: shopData.rules.map((rule) => ({
      id: rule.id,
      name: rule.name,
      status: rule.status,
      priority: rule.priority,
      conditionCount: rule.conditions.length,
      tierCount: rule.tiers.length,
      syncedAt: rule.syncedAt?.toISOString(),
      syncError: rule.syncError,
      createdAt: rule.createdAt.toISOString(),
    })),
    canCreate,
    syncStats: {
      totalSyncs: syncStats.totalSyncs,
      successRate: syncStats.totalSyncs > 0
        ? Math.round((syncStats.successCount / syncStats.totalSyncs) * 100)
        : 100,
      lastSync: syncStats.lastSync?.toISOString(),
    },
    t,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("action");

  const shopData = await getShopWithRules(session.shop);
  if (!shopData) {
    return json({ error: "Shop not found" }, { status: 404 });
  }

  switch (action) {
    case "sync": {
      const result = await syncRulesToShopify(admin, shopData.id, session.shop);
      return json({
        success: result.success,
        message: result.success
          ? `Synced ${result.rulesCount} rules successfully`
          : `Sync failed: ${result.error}`,
      });
    }

    case "updateStatus": {
      const ruleId = formData.get("ruleId") as string;
      const status = formData.get("status") as RuleStatus;
      await updateRuleStatus(ruleId, status);
      return json({ success: true });
    }

    case "delete": {
      const ruleId = formData.get("ruleId") as string;
      await deletePricingRule(ruleId);
      return json({ success: true });
    }

    default:
      return json({ error: "Unknown action" }, { status: 400 });
  }
};

export default function Dashboard() {
  const { shop, rules, canCreate, syncStats, t } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const submit = useSubmit();

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<{ id: string; name: string } | null>(null);

  const resourceName = {
    singular: t.rules.title.toLowerCase().replace("s", ""),
    plural: t.rules.title.toLowerCase(),
  };

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(rules);

  const handleSync = () => {
    submit({ action: "sync" }, { method: "POST" });
  };

  const handleStatusChange = (ruleId: string, status: RuleStatus) => {
    submit(
      { action: "updateStatus", ruleId, status },
      { method: "POST" }
    );
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
    const statusConfig = {
      DRAFT: { tone: "info" as const, label: t.rules.draft },
      ACTIVE: { tone: "success" as const, label: t.rules.active },
      PAUSED: { tone: "warning" as const, label: t.rules.paused },
      ARCHIVED: { tone: "critical" as const, label: t.rules.archived },
    };
    const config = statusConfig[status];
    return <Badge tone={config.tone}>{config.label}</Badge>;
  };

  const rowMarkup = rules.map((rule, index) => (
    <IndexTable.Row
      id={rule.id}
      key={rule.id}
      selected={selectedResources.includes(rule.id)}
      position={index}
    >
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="semibold" as="span">
          {rule.name}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>{getStatusBadge(rule.status as RuleStatus)}</IndexTable.Cell>
      <IndexTable.Cell>{rule.priority}</IndexTable.Cell>
      <IndexTable.Cell>{rule.conditionCount} {t.rules.conditions.toLowerCase()}</IndexTable.Cell>
      <IndexTable.Cell>{rule.tierCount} {t.rules.tiers.toLowerCase()}</IndexTable.Cell>
      <IndexTable.Cell>
        {rule.syncedAt ? (
          <Text variant="bodySm" tone="subdued" as="span">
            {new Date(rule.syncedAt).toLocaleDateString()}
          </Text>
        ) : rule.syncError ? (
          <Badge tone="critical">{t.common.error}</Badge>
        ) : (
          <Badge tone="attention">{t.dashboard.never}</Badge>
        )}
      </IndexTable.Cell>
      <IndexTable.Cell>
        <InlineStack gap="200">
          <Button size="slim" onClick={() => navigate(`/app/rules/${rule.id}`)}>
            {t.common.edit}
          </Button>
          {rule.status === "DRAFT" && (
            <Button
              size="slim"
              tone="success"
              onClick={() => handleStatusChange(rule.id, "ACTIVE")}
            >
              {t.rules.activateRule}
            </Button>
          )}
          {rule.status === "ACTIVE" && (
            <Button
              size="slim"
              onClick={() => handleStatusChange(rule.id, "PAUSED")}
            >
              {t.rules.pauseRule}
            </Button>
          )}
          <Button
            size="slim"
            tone="critical"
            onClick={() => openDeleteModal({ id: rule.id, name: rule.name })}
          >
            {t.common.delete}
          </Button>
        </InlineStack>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  const emptyStateMarkup = (
    <EmptyState
      heading={t.dashboard.createFirstRule}
      action={{
        content: t.rules.createRule,
        onAction: () => navigate("/app/rules/new"),
      }}
      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
    >
      <p>{t.dashboard.createFirstRuleDesc}</p>
    </EmptyState>
  );

  return (
    <Page
      title={t.dashboard.title}
      primaryAction={{
        content: t.rules.createRule,
        icon: PlusIcon,
        disabled: !canCreate,
        onAction: () => navigate("/app/rules/new"),
      }}
      secondaryActions={[
        {
          content: t.rules.syncRule,
          icon: RefreshIcon,
          onAction: handleSync,
        },
      ]}
    >
      <BlockStack gap="500">
        {!canCreate && (
          <Banner
            title={t.dashboard.ruleLimit}
            action={{ content: t.dashboard.upgradePlan, url: "/app/settings" }}
            tone="warning"
          >
            <p>{t.dashboard.upgradePlanDesc}</p>
          </Banner>
        )}

        {/* Stats Cards */}
        <Layout>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">
                  {t.rules.title}
                </Text>
                <Text variant="headingXl" as="p">
                  {rules.length}
                  {shop.ruleLimit !== "unlimited" && (
                    <Text variant="bodySm" tone="subdued" as="span">
                      {" "}
                      / {shop.ruleLimit}
                    </Text>
                  )}
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">
                  {t.dashboard.activeRules}
                </Text>
                <Text variant="headingXl" as="p">
                  {rules.filter((r) => r.status === "ACTIVE").length}
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">
                  {t.settings.syncStatistics}
                </Text>
                <InlineStack gap="200" align="start">
                  <Badge tone={syncStats.successRate >= 90 ? "success" : "warning"}>
                    {`${syncStats.successRate}% ${t.settings.successRate.toLowerCase()}`}
                  </Badge>
                  {syncStats.lastSync && (
                    <Text variant="bodySm" tone="subdued" as="span">
                      {t.settings.lastSync}: {new Date(syncStats.lastSync).toLocaleDateString()}
                    </Text>
                  )}
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Rules Table */}
        <Card padding="0">
          {rules.length === 0 ? (
            emptyStateMarkup
          ) : (
            <IndexTable
              resourceName={resourceName}
              itemCount={rules.length}
              selectedItemsCount={
                allResourcesSelected ? "All" : selectedResources.length
              }
              onSelectionChange={handleSelectionChange}
              headings={[
                { title: t.settings.name },
                { title: t.rules.active },
                { title: t.rules.priority },
                { title: t.rules.conditions },
                { title: t.rules.tiers },
                { title: t.settings.syncStatistics },
                { title: t.common.edit },
              ]}
            >
              {rowMarkup}
            </IndexTable>
          )}
        </Card>

        {/* Plan Info */}
        <Card>
          <BlockStack gap="200">
            <InlineStack align="space-between">
              <Text variant="headingSm" as="h3">
                {t.settings.currentPlan}: {shop.plan}
              </Text>
              <Button variant="plain" url="/app/settings">
                {t.settings.title}
              </Button>
            </InlineStack>
            <Text variant="bodySm" tone="subdued" as="p">
              {shop.ruleLimit === "unlimited"
                ? t.dashboard.unlimited + " " + t.rules.title.toLowerCase()
                : `${shop.ruleLimit} ${t.rules.title.toLowerCase()}`}
            </Text>
          </BlockStack>
        </Card>
      </BlockStack>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        open={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setRuleToDelete(null);
        }}
        onConfirm={handleDelete}
        itemName={ruleToDelete?.name}
        itemType={t.rules.title.toLowerCase()}
      />
    </Page>
  );
}
