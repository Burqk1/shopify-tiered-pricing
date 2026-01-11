/**
 * Customer Data Request Webhook Handler (GDPR)
 *
 * Responds to customer data request from Shopify.
 * Returns customer data stored by the app.
 */

import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for shop: ${shop}`);
  console.log("Customer data request payload:", JSON.stringify(payload));

  // This app doesn't store personal customer data beyond what Shopify provides
  // If you store customer data, return it here

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
