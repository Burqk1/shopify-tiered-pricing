/**
 * Customer Redact Webhook Handler (GDPR)
 *
 * Deletes customer data when requested by Shopify.
 * Required for GDPR compliance.
 */

import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for shop: ${shop}`);
  console.log("Customer redact payload:", JSON.stringify(payload));

  // This app doesn't store personal customer data
  // If you store customer data, delete it here based on payload.customer.id

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
