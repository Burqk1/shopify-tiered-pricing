/**
 * Auth Callback Route
 *
 * Handles OAuth callback from Shopify.
 * This splat route catches all /auth/* paths for OAuth flow.
 */

import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // authenticate.admin will handle the OAuth callback and redirect appropriately
  await authenticate.admin(request);

  // This return should not be reached as authenticate.admin redirects on success
  return new Response(null, { status: 200 });
};
