/**
 * Auth Callback Route
 *
 * Handles OAuth callback from Shopify.
 * This splat route catches all /auth/* paths for OAuth flow.
 */

import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { authenticate } from "~/shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // authenticate.admin will handle the OAuth callback
  const { session } = await authenticate.admin(request);

  // After successful authentication, redirect to app UI
  if (session?.shop) {
    return redirect(`/app?shop=${session.shop}`);
  }

  // Fallback redirect to app
  return redirect("/app");
};
