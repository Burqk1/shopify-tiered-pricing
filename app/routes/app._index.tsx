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
  Box,
} from "@shopify/polaris";
import { useState } from "react";
import { PlusIcon, RefreshIcon } from "@shopify/polaris-icons";

import { authenticate } from "~/shopify.server";
import { DeleteConfirmModal } from "~/components/DeleteConfirmModal";
import { getShopWithRules, canCreateRule, getPlanFeatures } from "~/models/shop.server";
import { updateRuleStatus, deletePricingRule } from "~/models/pricing-rule.server";
import { syncRulesToShopify } from "~/services/sync-engine.server";
import { getSyncStats } from "~/models/sync-log.server";
import type { RuleStatus } from "@prisma/client";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

  const shopData = await getShopWithRules(session.shop);

  if (!shopData) {
    throw new Response("Shop not found", { status: 404 });
  }

  const [canCreate, syncStats] = await Promise.all([
    canCreateRule(session.shop),
    getSyncStats(shopData.id),
  ]);

  const planFeatures = getPlanFeatures(shopData.plan);

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
  const { shop, rules, canCreate, syncStats } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const submit = useSubmit();

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<{ id: string; name: string } | null>(null);

  const resourceName = {
    singular: "pricing rule",
    plural: "pricing rules",
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
      DRAFT: { tone: "info" as const, label: "Draft" },
      ACTIVE: { tone: "success" as const, label: "Active" },
      PAUSED: { tone: "warning" as const, label: "Paused" },
      ARCHIVED: { tone: "critical" as const, label: "Archived" },
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
      <IndexTable.Cell>{rule.conditionCount} conditions</IndexTable.Cell>
      <IndexTable.Cell>{rule.tierCount} tiers</IndexTable.Cell>
      <IndexTable.Cell>
        {rule.syncedAt ? (
          <Text variant="bodySm" tone="subdued" as="span">
            {new Date(rule.syncedAt).toLocaleDateString()}
          </Text>
        ) : rule.syncError ? (
          <Badge tone="critical">Sync Error</Badge>
        ) : (
          <Badge tone="attention">Not Synced</Badge>
        )}
      </IndexTable.Cell>
      <IndexTable.Cell>
        <InlineStack gap="200">
          <Button size="slim" onClick={() => navigate(`/app/rules/${rule.id}`)}>
            Edit
          </Button>
          {rule.status === "DRAFT" && (
            <Button
              size="slim"
              tone="success"
              onClick={() => handleStatusChange(rule.id, "ACTIVE")}
            >
              Activate
            </Button>
          )}
          {rule.status === "ACTIVE" && (
            <Button
              size="slim"
              onClick={() => handleStatusChange(rule.id, "PAUSED")}
            >
              Pause
            </Button>
          )}
          <Button
            size="slim"
            tone="critical"
            onClick={() => openDeleteModal({ id: rule.id, name: rule.name })}
          >
            Delete
          </Button>
        </InlineStack>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  const emptyStateMarkup = (
    <EmptyState
      heading="Create your first pricing rule"
      action={{
        content: "Create Rule",
        onAction: () => navigate("/app/rules/new"),
      }}
      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
    >
      <p>
        Set up volume discounts, wholesale pricing, or customer-specific rates
        to boost your sales.
      </p>
    </EmptyState>
  );

  return (
    <Page
      title="Tiered Pricing Dashboard"
      primaryAction={{
        content: "Create Rule",
        icon: PlusIcon,
        disabled: !canCreate,
        onAction: () => navigate("/app/rules/new"),
      }}
      secondaryActions={[
        {
          content: "Sync to Shopify",
          icon: RefreshIcon,
          onAction: handleSync,
        },
      ]}
    >
      <BlockStack gap="500">
        {!canCreate && (
          <Banner
            title="Rule limit reached"
            action={{ content: "Upgrade Plan", url: "/app/settings" }}
            tone="warning"
          >
            <p>
              You've reached the maximum number of rules for your plan.
              Upgrade to create more rules.
            </p>
          </Banner>
        )}

        {/* Stats Cards */}
        <Layout>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">
                  Total Rules
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
                  Active Rules
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
                  Sync Status
                </Text>
                <InlineStack gap="200" align="start">
                  <Badge tone={syncStats.successRate >= 90 ? "success" : "warning"}>
                    {`${syncStats.successRate}% success`}
                  </Badge>
                  {syncStats.lastSync && (
                    <Text variant="bodySm" tone="subdued" as="span">
                      Last: {new Date(syncStats.lastSync).toLocaleDateString()}
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
                { title: "Name" },
                { title: "Status" },
                { title: "Priority" },
                { title: "Conditions" },
                { title: "Tiers" },
                { title: "Sync Status" },
                { title: "Actions" },
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
                Current Plan: {shop.plan}
              </Text>
              <Button variant="plain" url="/app/settings">
                Manage Plan
              </Button>
            </InlineStack>
            <Text variant="bodySm" tone="subdued" as="p">
              {shop.ruleLimit === "unlimited"
                ? "Unlimited pricing rules"
                : `${shop.ruleLimit} pricing rule${shop.ruleLimit === 1 ? "" : "s"} included`}
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
        itemType="pricing rule"
      />
    </Page>
  );
}
