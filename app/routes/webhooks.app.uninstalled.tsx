/**
 * App Uninstalled Webhook Handler
 *
 * Clean up shop data when app is uninstalled (GDPR compliance).
 */

import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import { deleteShop } from "~/models/shop.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for shop: ${shop}`);

  // Clean up shop data
  try {
    await deleteShop(shop);
    console.log(`Successfully deleted data for shop: ${shop}`);
  } catch (error) {
    console.error(`Failed to delete shop data: ${error}`);
  }

  return new Response(null, { status: 200 });
};
