/**
 * Create New Discount Route
 *
 * UI for creating a new tiered volume discount.
 * This connects the pricing rules to Shopify's discount system.
 */

import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import {
  Page,
  Card,
  FormLayout,
  TextField,
  Select,
  Button,
  Banner,
  BlockStack,
  Text,
} from "@shopify/polaris";
import { useState } from "react";

import { authenticate } from "~/shopify.server";
import { getActiveRulesForSync } from "~/models/pricing-rule.server";
import { getShopByDomain } from "~/models/shop.server";
import type { ShopifyDiscountNodeWithApp } from "~/types/shopify";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

  // Get shop and active rules
  const shop = await getShopByDomain(session.shop);
  if (!shop) {
    throw new Response("Shop not found", { status: 404 });
  }

  const rules = await getActiveRulesForSync(shop.id);

  // Get existing automatic discounts to show
  const response = await admin.graphql(`
    query {
      discountNodes(first: 10, query: "type:automatic") {
        nodes {
          id
          discount {
            ... on DiscountAutomaticApp {
              title
              status
            }
          }
        }
      }
    }
  `);

  const data = await response.json();

  return json({
    rules: rules.map((r) => ({ id: r.id, name: r.name })),
    existingDiscounts: data.data?.discountNodes?.nodes || [],
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const title = formData.get("title") as string;
  const ruleId = formData.get("ruleId") as string;

  if (!title || !ruleId) {
    return json({ error: "Title and rule are required" }, { status: 400 });
  }

  // Get the rule details
  const shop = await getShopByDomain(session.shop);
  if (!shop) {
    return json({ error: "Shop not found" }, { status: 404 });
  }

  const rules = await getActiveRulesForSync(shop.id);
  const rule = rules.find((r) => r.id === ruleId);

  if (!rule) {
    return json({ error: "Rule not found" }, { status: 404 });
  }

  // Build discount configuration
  const config = {
    tiers: rule.tiers.map((t) => ({
      minQuantity: t.minQuantity,
      maxQuantity: t.maxQuantity,
      valueType: t.valueType,
      value: Number(t.value),
    })),
    productIds: rule.conditions
      .filter((c) => c.type === "PRODUCT")
      .map((c) => c.value),
    collectionIds: rule.conditions
      .filter((c) => c.type === "COLLECTION")
      .map((c) => c.value),
    allProducts: rule.conditions.some((c) => c.type === "ALL_PRODUCTS"),
  };

  try {
    // Create automatic discount via GraphQL
    const response = await admin.graphql(`
      mutation discountAutomaticAppCreate($automaticAppDiscount: DiscountAutomaticAppInput!) {
        discountAutomaticAppCreate(automaticAppDiscount: $automaticAppDiscount) {
          automaticAppDiscount {
            discountId
          }
          userErrors {
            field
            message
          }
        }
      }
    `, {
      variables: {
        automaticAppDiscount: {
          title,
          functionId: process.env.SHOPIFY_TIERED_DISCOUNT_FUNCTION_ID,
          startsAt: new Date().toISOString(),
          metafields: [
            {
              namespace: "tiered-pricing",
              key: "config",
              type: "json",
              value: JSON.stringify(config),
            },
          ],
        },
      },
    });

    const result = await response.json();

    if (result.data?.discountAutomaticAppCreate?.userErrors?.length > 0) {
      return json({
        error: result.data.discountAutomaticAppCreate.userErrors[0].message,
      }, { status: 400 });
    }

    return redirect("/app");
  } catch (error) {
    console.error("Failed to create discount:", error);
    return json({ error: "Failed to create discount" }, { status: 500 });
  }
};

export default function NewDiscount() {
  const { rules, existingDiscounts } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();

  const [title, setTitle] = useState("");
  const [selectedRule, setSelectedRule] = useState("");

  const isLoading = navigation.state === "submitting";

  const ruleOptions = [
    { label: "Select a pricing rule...", value: "" },
    ...rules.map((r) => ({ label: r.name, value: r.id })),
  ];

  const handleSubmit = () => {
    const formData = new FormData();
    formData.append("title", title);
    formData.append("ruleId", selectedRule);
    submit(formData, { method: "post" });
  };

  return (
    <Page
      title="Create Volume Discount"
      backAction={{ content: "Home", url: "/app" }}
    >
      <BlockStack gap="400">
        <Banner tone="info">
          <p>
            This will create an automatic discount that applies your tiered
            pricing rules at checkout. Customers will automatically receive
            discounts based on quantity.
          </p>
        </Banner>

        {rules.length === 0 ? (
          <Card>
            <BlockStack gap="200">
              <Text as="p">
                You need to create a pricing rule first before you can create a
                discount.
              </Text>
              <Button url="/app/rules/new">Create Pricing Rule</Button>
            </BlockStack>
          </Card>
        ) : (
          <Card>
            <FormLayout>
              <TextField
                label="Discount Title"
                value={title}
                onChange={setTitle}
                placeholder="e.g., Volume Discount - T-Shirts"
                helpText="This will be shown to customers at checkout"
                autoComplete="off"
              />

              <Select
                label="Pricing Rule"
                options={ruleOptions}
                value={selectedRule}
                onChange={setSelectedRule}
                helpText="Select which pricing rule to use for this discount"
              />

              <Button
                variant="primary"
                onClick={handleSubmit}
                loading={isLoading}
                disabled={!title || !selectedRule}
              >
                Create Discount
              </Button>
            </FormLayout>
          </Card>
        )}

        {existingDiscounts.length > 0 && (
          <Card>
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">
                Existing Discounts
              </Text>
              {existingDiscounts.map((d: ShopifyDiscountNodeWithApp) => (
                <Text as="p" key={d.id}>
                  {d.discount?.title || "Unnamed"} -{" "}
                  {d.discount?.status || "Unknown"}
                </Text>
              ))}
            </BlockStack>
          </Card>
        )}
      </BlockStack>
    </Page>
  );
}
