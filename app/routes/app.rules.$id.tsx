/**
 * Edit Rule Route (app.rules.$id.tsx)
 *
 * Edit existing pricing rule with all fields pre-populated.
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  useLoaderData,
  useNavigate,
  useSubmit,
  useActionData,
  useSearchParams,
} from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Select,
  Button,
  BlockStack,
  InlineStack,
  Text,
  Banner,
  Badge,
  Modal,
  Box,
} from "@shopify/polaris";
import { useState, useCallback, useEffect } from "react";
import type { GraphQLEdge, ShopifyProduct, ShopifyCollection } from "~/types/shopify";

import { authenticate } from "~/shopify.server";
import { getShopByDomain, getPlanFeatures } from "~/models/shop.server";
import {
  getPricingRule,
  updatePricingRule,
  updateRuleStatus,
  deletePricingRule,
  duplicatePricingRule,
  validateTiers,
} from "~/models/pricing-rule.server";
import { syncRulesToShopify } from "~/services/sync-engine.server";
import type { ConditionType, DiscountType, RuleStatus } from "@prisma/client";

// Components
import { TierBuilder, type Tier } from "~/components/TierBuilder";
import { ConditionSelector, type Condition } from "~/components/ConditionSelector";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const ruleId = params.id;

  if (!ruleId) {
    throw new Response("Rule ID required", { status: 400 });
  }

  const [shop, rule] = await Promise.all([
    getShopByDomain(session.shop),
    getPricingRule(ruleId),
  ]);

  if (!shop) {
    throw new Response("Shop not found", { status: 404 });
  }

  if (!rule) {
    throw new Response("Rule not found", { status: 404 });
  }

  // Verify rule belongs to this shop
  if (rule.shopId !== shop.id) {
    throw new Response("Unauthorized", { status: 403 });
  }

  const planFeatures = getPlanFeatures(shop.plan);

  // Fetch products and collections
  const [productsQuery, collectionsQuery] = await Promise.all([
    admin.graphql(`
      query GetProducts {
        products(first: 50) {
          edges {
            node {
              id
              title
              featuredImage { url }
            }
          }
        }
      }
    `),
    admin.graphql(`
      query GetCollections {
        collections(first: 50) {
          edges {
            node {
              id
              title
            }
          }
        }
      }
    `),
  ]);

  const productsData = await productsQuery.json();
  const collectionsData = await collectionsQuery.json();

  return json({
    shop: {
      id: shop.id,
      plan: shop.plan,
    },
    features: planFeatures,
    rule: {
      id: rule.id,
      name: rule.name,
      description: rule.description,
      priority: rule.priority,
      status: rule.status,
      syncedAt: rule.syncedAt?.toISOString(),
      syncError: rule.syncError,
      conditions: rule.conditions.map((c) => ({
        type: c.type as ConditionType,
        value: c.value,
        label: c.label,
      })),
      tiers: rule.tiers.map((t) => ({
        minQuantity: t.minQuantity,
        maxQuantity: t.maxQuantity,
        valueType: t.valueType as DiscountType,
        value: Number(t.value),
        message: t.message,
      })),
    },
    products: productsData.data?.products?.edges?.map((e: GraphQLEdge<ShopifyProduct>) => ({
      id: e.node.id,
      title: e.node.title,
      image: e.node.featuredImage?.url,
    })) || [],
    collections: collectionsData.data?.collections?.edges?.map((e: GraphQLEdge<ShopifyCollection>) => ({
      id: e.node.id,
      title: e.node.title,
    })) || [],
  });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("action");
  const ruleId = params.id;

  if (!ruleId) {
    return json({ error: "Rule ID required" }, { status: 400 });
  }

  const shop = await getShopByDomain(session.shop);
  if (!shop) {
    return json({ error: "Shop not found" }, { status: 404 });
  }

  switch (action) {
    case "update": {
      const name = formData.get("name") as string;
      const priority = parseInt(formData.get("priority") as string) || 0;
      const conditionsJson = formData.get("conditions") as string;
      const tiersJson = formData.get("tiers") as string;
      const activateNow = formData.get("activateNow") === "true";

      if (!name) {
        return json({ error: "Rule name is required" }, { status: 400 });
      }

      let conditions: { type: ConditionType; value: string; label?: string }[];
      let tiers: { minQuantity: number; maxQuantity?: number; valueType: DiscountType; value: number; message?: string }[];

      try {
        conditions = JSON.parse(conditionsJson || "[]");
        tiers = JSON.parse(tiersJson || "[]");
      } catch {
        return json({ error: "Invalid form data" }, { status: 400 });
      }

      const tierValidation = validateTiers(tiers);
      if (!tierValidation.valid) {
        return json({ error: tierValidation.error }, { status: 400 });
      }

      await updatePricingRule(ruleId, {
        name,
        priority,
        status: activateNow ? "ACTIVE" : undefined,
        conditions,
        tiers,
      });

      if (activateNow) {
        await syncRulesToShopify(admin, shop.id, session.shop);
      }

      return json({ success: true, message: "Rule updated successfully" });
    }

    case "activate": {
      await updateRuleStatus(ruleId, "ACTIVE");
      await syncRulesToShopify(admin, shop.id, session.shop);
      return json({ success: true, message: "Rule activated and synced" });
    }

    case "pause": {
      await updateRuleStatus(ruleId, "PAUSED");
      await syncRulesToShopify(admin, shop.id, session.shop);
      return json({ success: true, message: "Rule paused" });
    }

    case "duplicate": {
      const newRule = await duplicatePricingRule(ruleId);
      return redirect(`/app/rules/${newRule.id}`);
    }

    case "delete": {
      await deletePricingRule(ruleId);
      await syncRulesToShopify(admin, shop.id, session.shop);
      return redirect("/app?deleted=true");
    }

    default:
      return json({ error: "Unknown action" }, { status: 400 });
  }
};

export default function EditRule() {
  const { shop, features, rule, products, collections } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const submit = useSubmit();
  const [searchParams] = useSearchParams();

  const isNewlyCreated = searchParams.get("created") === "true";

  // Form state
  const [name, setName] = useState(rule.name);
  const [priority, setPriority] = useState(rule.priority.toString());
  const [conditions, setConditions] = useState<Condition[]>(rule.conditions);
  const [tiers, setTiers] = useState<Tier[]>(rule.tiers);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const handleSubmit = useCallback(
    (activateNow: boolean) => {
      const formData = new FormData();
      formData.append("action", "update");
      formData.append("name", name);
      formData.append("priority", priority);
      formData.append("conditions", JSON.stringify(conditions));
      formData.append("tiers", JSON.stringify(tiers));
      formData.append("activateNow", activateNow.toString());

      submit(formData, { method: "POST" });
    },
    [name, priority, conditions, tiers, submit]
  );

  const handleStatusAction = (action: string) => {
    submit({ action }, { method: "POST" });
  };

  const handleDelete = () => {
    submit({ action: "delete" }, { method: "POST" });
  };

  const getStatusBadge = (status: RuleStatus) => {
    const config = {
      DRAFT: { tone: "info" as const, label: "Draft" },
      ACTIVE: { tone: "success" as const, label: "Active" },
      PAUSED: { tone: "warning" as const, label: "Paused" },
      ARCHIVED: { tone: "critical" as const, label: "Archived" },
    };
    return <Badge tone={config[status].tone}>{config[status].label}</Badge>;
  };

  return (
    <Page
      title={`Edit: ${rule.name}`}
      titleMetadata={getStatusBadge(rule.status as RuleStatus)}
      backAction={{ content: "Dashboard", url: "/app" }}
      primaryAction={{
        content: rule.status === "ACTIVE" ? "Save Changes" : "Save & Activate",
        onAction: () => handleSubmit(rule.status !== "ACTIVE"),
      }}
      secondaryActions={[
        ...(rule.status === "ACTIVE"
          ? [{ content: "Pause", onAction: () => handleStatusAction("pause") }]
          : [{ content: "Activate", onAction: () => handleStatusAction("activate") }]),
        { content: "Duplicate", onAction: () => handleStatusAction("duplicate") },
        {
          content: "Delete",
          destructive: true,
          onAction: () => setDeleteModalOpen(true),
        },
      ]}
    >
      <BlockStack gap="500">
        {isNewlyCreated && (
          <Banner tone="success" title="Rule created successfully!">
            <p>Your pricing rule has been saved. Activate it to start applying discounts.</p>
          </Banner>
        )}

        {actionData && "error" in actionData && actionData.error && (
          <Banner tone="critical" title="Error">
            <p>{actionData.error}</p>
          </Banner>
        )}

        {actionData && "success" in actionData && actionData.success && "message" in actionData && (
          <Banner tone="success">
            <p>{actionData.message}</p>
          </Banner>
        )}

        {rule.syncError && (
          <Banner tone="warning" title="Sync Error">
            <p>Last sync failed: {rule.syncError}</p>
          </Banner>
        )}

        {/* Sync Status */}
        {rule.status === "ACTIVE" && (
          <Card>
            <InlineStack align="space-between">
              <BlockStack gap="100">
                <Text variant="headingSm" as="h3">
                  Sync Status
                </Text>
                <Text variant="bodySm" tone="subdued" as="p">
                  {rule.syncedAt
                    ? `Last synced: ${new Date(rule.syncedAt).toLocaleString()}`
                    : "Not yet synced"}
                </Text>
              </BlockStack>
              <Badge tone={rule.syncedAt ? "success" : "attention"}>
                {rule.syncedAt ? "Synced" : "Pending Sync"}
              </Badge>
            </InlineStack>
          </Card>
        )}

        {/* Basic Info */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  Basic Information
                </Text>
                <FormLayout>
                  <TextField
                    label="Rule Name"
                    value={name}
                    onChange={setName}
                    autoComplete="off"
                  />
                  <Select
                    label="Priority"
                    options={[
                      { label: "Low (0)", value: "0" },
                      { label: "Medium (5)", value: "5" },
                      { label: "High (10)", value: "10" },
                    ]}
                    value={priority}
                    onChange={setPriority}
                  />
                </FormLayout>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Conditions */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  Conditions
                </Text>
                <ConditionSelector
                  conditions={conditions}
                  onChange={setConditions}
                  products={products}
                  collections={collections}
                  allowCustomerTags={features.customerTags}
                />
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Discount Tiers */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  Discount Tiers
                </Text>
                <TierBuilder tiers={tiers} onChange={setTiers} />
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Actions */}
        <Layout>
          <Layout.Section>
            <InlineStack gap="300" align="end">
              <Button onClick={() => navigate("/app")}>Cancel</Button>
              <Button onClick={() => handleSubmit(false)}>Save as Draft</Button>
              <Button variant="primary" onClick={() => handleSubmit(true)}>
                {rule.status === "ACTIVE" ? "Save Changes" : "Save & Activate"}
              </Button>
            </InlineStack>
          </Layout.Section>
        </Layout>
      </BlockStack>

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete pricing rule?"
        primaryAction={{
          content: "Delete",
          destructive: true,
          onAction: handleDelete,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => setDeleteModalOpen(false),
          },
        ]}
      >
        <Modal.Section>
          <Text as="p">
            Are you sure you want to delete "{rule.name}"? This action cannot be undone.
          </Text>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
