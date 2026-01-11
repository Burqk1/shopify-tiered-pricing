/**
 * Shop Redact Webhook Handler (GDPR)
 *
 * Deletes all shop data when requested by Shopify.
 * Called 48 hours after app uninstall.
 */

import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import { deleteShop } from "~/models/shop.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for shop: ${shop}`);
  console.log("Shop redact payload:", JSON.stringify(payload));

  // Delete all shop data
  try {
    await deleteShop(shop);
    console.log(`Successfully deleted all data for shop: ${shop}`);
  } catch (error) {
    console.error(`Failed to delete shop data: ${error}`);
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
