/**
 * Dashboard Route (app._index.tsx)
 *
 * Enhanced main dashboard showing:
 * - Overview stats with visual metrics
 * - Quick action widgets
 * - Feature shortcuts
 * - List of pricing rules
 * - Getting started guide
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
  Grid,
  Icon,
  ProgressBar,
  Tooltip,
  Divider,
} from "@shopify/polaris";
import { useState } from "react";
import {
  PlusIcon,
  RefreshIcon,
  ChartVerticalFilledIcon,
  DiscountIcon,
  CartIcon,
  ClockIcon,
  GiftCardIcon,
  PersonIcon,
  TargetIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  StarFilledIcon,
} from "@shopify/polaris-icons";

import { authenticate } from "~/shopify.server";
import { DeleteConfirmModal } from "~/components/DeleteConfirmModal";
import { getShopWithRules, canCreateRule, getPlanFeatures, getLocaleSettings } from "~/models/shop.server";
import { updateRuleStatus, deletePricingRule, markRuleSynced } from "~/models/pricing-rule.server";
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

  // Calculate quick stats
  const activeRules = shopData.rules.filter((r) => r.status === "ACTIVE").length;
  const draftRules = shopData.rules.filter((r) => r.status === "DRAFT").length;
  const syncedRules = shopData.rules.filter((r) => r.syncedAt !== null).length;

  // Check if user has completed setup steps
  const hasRules = shopData.rules.length > 0;
  const hasActiveRules = activeRules > 0;
  const hasSyncedRules = syncedRules > 0;
  const setupProgress = [hasRules, hasSyncedRules, hasActiveRules].filter(Boolean).length;

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
    quickStats: {
      totalRules: shopData.rules.length,
      activeRules,
      draftRules,
      syncedRules,
    },
    setupProgress,
    isSetupComplete: setupProgress === 3,
    planFeatures,
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
      // Mark all active rules as synced (simplified for demo)
      const activeRules = shopData.rules.filter(r => r.status === "ACTIVE");
      for (const rule of activeRules) {
        await markRuleSynced(rule.id);
      }
      return json({
        success: true,
        message: `Synced ${activeRules.length} rules successfully`,
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
  const { shop, rules, canCreate, syncStats, quickStats, setupProgress, isSetupComplete, planFeatures, t } = useLoaderData<typeof loader>();
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

  // Quick action widgets
  const quickActions = [
    { icon: DiscountIcon, label: "Volume Discount", url: "/app/rules/new", description: "Create tiered pricing" },
    { icon: GiftCardIcon, label: "BOGO Offer", url: "/app/bogo/new", description: "Buy X Get Y" },
    { icon: CartIcon, label: "Free Shipping", url: "/app/cart-progress/new", description: "Cart progress bar" },
    { icon: ClockIcon, label: "Timer", url: "/app/timers/new", description: "Countdown urgency" },
    { icon: TargetIcon, label: "Bundle", url: "/app/bundles/new", description: "Product bundles" },
    { icon: PersonIcon, label: "Wholesale", url: "/app/wholesale", description: "B2B pricing" },
  ];

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
      secondaryAction={{
        content: "Setup Guide",
        onAction: () => navigate("/app/setup"),
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
        {/* Setup Progress Banner - Show only if not complete */}
        {!isSetupComplete && (
          <Card>
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center">
                <BlockStack gap="100">
                  <Text variant="headingSm" as="h3">
                    {t.dashboard.gettingStarted}
                  </Text>
                  <Text variant="bodySm" tone="subdued" as="span">
                    {setupProgress} of 3 steps completed
                  </Text>
                </BlockStack>
                <Button variant="plain" onClick={() => navigate("/app/setup")}>
                  View Setup Guide
                </Button>
              </InlineStack>
              <ProgressBar progress={(setupProgress / 3) * 100} tone="primary" size="small" />
              <InlineStack gap="300">
                <Tooltip content="Create your first pricing rule">
                  <Badge tone={quickStats.totalRules > 0 ? "success" : "attention"}>
                    {`${quickStats.totalRules > 0 ? "✓" : "1"} Create Rule`}
                  </Badge>
                </Tooltip>
                <Tooltip content="Sync rules to your storefront">
                  <Badge tone={quickStats.syncedRules > 0 ? "success" : "attention"}>
                    {`${quickStats.syncedRules > 0 ? "✓" : "2"} Sync`}
                  </Badge>
                </Tooltip>
                <Tooltip content="Activate at least one rule">
                  <Badge tone={quickStats.activeRules > 0 ? "success" : "attention"}>
                    {`${quickStats.activeRules > 0 ? "✓" : "3"} Activate`}
                  </Badge>
                </Tooltip>
              </InlineStack>
            </BlockStack>
          </Card>
        )}

        {!canCreate && (
          <Banner
            title={t.dashboard.ruleLimit}
            action={{ content: t.dashboard.upgradePlan, url: "/app/settings" }}
            tone="warning"
          >
            <p>{t.dashboard.upgradePlanDesc}</p>
          </Banner>
        )}

        {/* Enhanced Stats Cards */}
        <Grid>
          <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingSm" as="h3">{t.rules.title}</Text>
                  <Box background="bg-fill-info" borderRadius="full" padding="100">
                    <Icon source={DiscountIcon} tone="info" />
                  </Box>
                </InlineStack>
                <Text variant="heading2xl" as="p">
                  {quickStats.totalRules}
                  {shop.ruleLimit !== "unlimited" && (
                    <Text variant="bodySm" tone="subdued" as="span"> / {shop.ruleLimit}</Text>
                  )}
                </Text>
                {shop.ruleLimit !== "unlimited" && (
                  <ProgressBar
                    progress={(quickStats.totalRules / Number(shop.ruleLimit)) * 100}
                    tone="primary"
                    size="small"
                  />
                )}
              </BlockStack>
            </Card>
          </Grid.Cell>

          <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingSm" as="h3">{t.dashboard.activeRules}</Text>
                  <Box background="bg-fill-success" borderRadius="full" padding="100">
                    <Icon source={CheckCircleIcon} tone="success" />
                  </Box>
                </InlineStack>
                <Text variant="heading2xl" as="p" tone="success">
                  {quickStats.activeRules}
                </Text>
                {quickStats.draftRules > 0 && (
                  <Text variant="bodySm" tone="subdued" as="p">
                    {quickStats.draftRules} draft{quickStats.draftRules > 1 ? "s" : ""} pending
                  </Text>
                )}
              </BlockStack>
            </Card>
          </Grid.Cell>

          <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingSm" as="h3">{t.settings.syncStatistics}</Text>
                  <Box background={syncStats.successRate >= 90 ? "bg-fill-success" : "bg-fill-warning"} borderRadius="full" padding="100">
                    <Icon source={RefreshIcon} tone={syncStats.successRate >= 90 ? "success" : "warning"} />
                  </Box>
                </InlineStack>
                <Text variant="heading2xl" as="p" tone={syncStats.successRate >= 90 ? "success" : "caution"}>
                  {syncStats.successRate}%
                </Text>
                {syncStats.lastSync && (
                  <Text variant="bodySm" tone="subdued" as="p">
                    Last: {new Date(syncStats.lastSync).toLocaleDateString()}
                  </Text>
                )}
              </BlockStack>
            </Card>
          </Grid.Cell>

          <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingSm" as="h3">{t.settings.currentPlan}</Text>
                  <Box background="bg-fill-magic" borderRadius="full" padding="100">
                    <Icon source={StarFilledIcon} tone="magic" />
                  </Box>
                </InlineStack>
                <Text variant="heading2xl" as="p">
                  {shop.plan}
                </Text>
                <Button variant="plain" onClick={() => navigate("/app/settings")} icon={ArrowRightIcon}>
                  {shop.plan === "FREE" ? "Upgrade" : "Manage"}
                </Button>
              </BlockStack>
            </Card>
          </Grid.Cell>
        </Grid>

        {/* Quick Actions Widget */}
        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center">
              <Text variant="headingMd" as="h3">{t.dashboard.quickActions}</Text>
              <Button variant="plain" onClick={() => navigate("/app/setup")}>
                All Features
              </Button>
            </InlineStack>
            <Grid>
              {quickActions.map((action, i) => (
                <Grid.Cell key={i} columnSpan={{ xs: 3, sm: 2, md: 2, lg: 2, xl: 2 }}>
                  <Box
                    padding="300"
                    background="bg-surface-secondary"
                    borderRadius="200"
                    borderWidth="025"
                    borderColor="border"
                  >
                    <BlockStack gap="200" inlineAlign="center">
                      <Button
                        variant="plain"
                        onClick={() => navigate(action.url)}
                        icon={action.icon}
                      />
                      <Text variant="bodySm" as="p" fontWeight="semibold" alignment="center">
                        {action.label}
                      </Text>
                      <Text variant="bodySm" as="p" tone="subdued" alignment="center">
                        {action.description}
                      </Text>
                    </BlockStack>
                  </Box>
                </Grid.Cell>
              ))}
            </Grid>
          </BlockStack>
        </Card>

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

        {/* Feature Access Banner - Show for FREE plan */}
        {shop.plan === "FREE" && (
          <Banner
            title="Unlock Premium Features"
            action={{ content: "Upgrade Now", url: "/app/settings" }}
            secondaryAction={{ content: "Compare Plans", url: "/app/settings" }}
            tone="info"
          >
            <p>Get AI-powered pricing suggestions, A/B testing, competitor tracking, and more with Growth or Professional plans.</p>
          </Banner>
        )}
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
