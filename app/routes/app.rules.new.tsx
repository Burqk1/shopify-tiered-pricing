/**
 * Create New Rule Route (app.rules.new.tsx)
 *
 * Form for creating a new pricing rule with:
 * - Basic info (name, priority)
 * - Conditions (products, collections, tags)
 * - Discount tiers
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useNavigate, useSubmit, useActionData } from "@remix-run/react";
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
  Divider,
  Box,
  Checkbox,
} from "@shopify/polaris";
import { useState, useCallback } from "react";
import type { GraphQLEdge, ShopifyProduct, ShopifyCollection } from "~/types/shopify";

import { authenticate } from "~/shopify.server";
import { getShopByDomain, canCreateRule, getPlanFeatures } from "~/models/shop.server";
import { createPricingRule, validateTiers } from "~/models/pricing-rule.server";
import { syncRulesToShopify } from "~/services/sync-engine.server";
import type { ConditionType, DiscountType } from "@prisma/client";

// Components
import { TierBuilder, type Tier } from "~/components/TierBuilder";
import { ConditionSelector, type Condition } from "~/components/ConditionSelector";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

  const shop = await getShopByDomain(session.shop);
  if (!shop) {
    throw new Response("Shop not found", { status: 404 });
  }

  const canCreate = await canCreateRule(session.shop);
  if (!canCreate) {
    return redirect("/app?error=rule_limit_reached");
  }

  const planFeatures = getPlanFeatures(shop.plan);

  // Fetch products and collections for the picker
  const productsQuery = await admin.graphql(`
    query GetProducts {
      products(first: 50) {
        edges {
          node {
            id
            title
            featuredImage {
              url
            }
          }
        }
      }
    }
  `);

  const collectionsQuery = await admin.graphql(`
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
  `);

  const productsData = await productsQuery.json();
  const collectionsData = await collectionsQuery.json();

  return json({
    shop: {
      id: shop.id,
      plan: shop.plan,
    },
    features: planFeatures,
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

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const shop = await getShopByDomain(session.shop);
  if (!shop) {
    return json({ error: "Shop not found" }, { status: 404 });
  }

  // Parse form data
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

  if (conditions.length === 0) {
    return json({ error: "At least one condition is required" }, { status: 400 });
  }

  if (tiers.length === 0) {
    return json({ error: "At least one tier is required" }, { status: 400 });
  }

  // Validate tiers
  const tierValidation = validateTiers(tiers);
  if (!tierValidation.valid) {
    return json({ error: tierValidation.error }, { status: 400 });
  }

  try {
    // Create the rule
    const rule = await createPricingRule({
      shopId: shop.id,
      name,
      priority,
      conditions,
      tiers,
    });

    // If activate now, update status and sync
    if (activateNow) {
      await syncRulesToShopify(admin, shop.id, session.shop);
    }

    return redirect(`/app/rules/${rule.id}?created=true`);
  } catch (error) {
    console.error("Failed to create rule:", error);
    return json({ error: "Failed to create rule" }, { status: 500 });
  }
};

export default function CreateRule() {
  const { shop, features, products, collections } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const submit = useSubmit();

  // Form state
  const [name, setName] = useState("");
  const [priority, setPriority] = useState("0");
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([
    { minQuantity: 1, valueType: "PERCENTAGE", value: 0 },
  ]);
  const [enableScheduling, setEnableScheduling] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("00:00");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("23:59");

  const handleSubmit = useCallback(
    (activateNow: boolean) => {
      const formData = new FormData();
      formData.append("name", name);
      formData.append("priority", priority);
      formData.append("conditions", JSON.stringify(conditions));
      formData.append("tiers", JSON.stringify(tiers));
      formData.append("activateNow", activateNow.toString());

      if (enableScheduling) {
        if (startDate) {
          formData.append("startDate", `${startDate}T${startTime}`);
        }
        if (endDate) {
          formData.append("endDate", `${endDate}T${endTime}`);
        }
      }

      submit(formData, { method: "POST" });
    },
    [name, priority, conditions, tiers, enableScheduling, startDate, startTime, endDate, endTime, submit]
  );

  return (
    <Page
      title="Create Pricing Rule"
      backAction={{ content: "Dashboard", url: "/app" }}
      primaryAction={{
        content: "Save & Activate",
        onAction: () => handleSubmit(true),
      }}
      secondaryActions={[
        {
          content: "Save as Draft",
          onAction: () => handleSubmit(false),
        },
      ]}
    >
      <BlockStack gap="500">
        {actionData?.error && (
          <Banner tone="critical" title="Error">
            <p>{actionData.error}</p>
          </Banner>
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
                    placeholder="e.g., Wholesale T-Shirt Discount"
                    autoComplete="off"
                    helpText="A descriptive name to identify this rule"
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
                    helpText="Higher priority rules take precedence when multiple rules match"
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
                <Text variant="bodyMd" tone="subdued" as="p">
                  Define which products or customers this rule applies to.
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
                <Text variant="bodyMd" tone="subdued" as="p">
                  Set up quantity-based discounts. Customers will automatically get
                  the best applicable tier.
                </Text>
                <TierBuilder tiers={tiers} onChange={setTiers} />
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Scheduling */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  Schedule Campaign
                </Text>
                <Checkbox
                  label="Enable scheduling"
                  checked={enableScheduling}
                  onChange={setEnableScheduling}
                  helpText="Set specific start and end dates for this discount rule"
                />
                {enableScheduling && (
                  <FormLayout>
                    <FormLayout.Group>
                      <TextField
                        type="date"
                        label="Start Date"
                        value={startDate}
                        onChange={setStartDate}
                        autoComplete="off"
                        helpText="Leave empty to start immediately"
                      />
                      <TextField
                        type="time"
                        label="Start Time"
                        value={startTime}
                        onChange={setStartTime}
                        autoComplete="off"
                      />
                    </FormLayout.Group>
                    <FormLayout.Group>
                      <TextField
                        type="date"
                        label="End Date"
                        value={endDate}
                        onChange={setEndDate}
                        autoComplete="off"
                        helpText="Leave empty for no end date"
                      />
                      <TextField
                        type="time"
                        label="End Time"
                        value={endTime}
                        onChange={setEndTime}
                        autoComplete="off"
                      />
                    </FormLayout.Group>
                    <Banner tone="info">
                      <p>Scheduled campaigns will automatically activate and deactivate at the specified times.</p>
                    </Banner>
                  </FormLayout>
                )}
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
                Save & Activate
              </Button>
            </InlineStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
