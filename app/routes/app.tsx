/**
 * App Layout Route
 *
 * This is the main layout for all authenticated admin routes.
 * Handles authentication and provides Polaris + App Bridge context.
 */

import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Outlet, useLoaderData, useRouteError, useNavigate, useLocation } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { Frame, Navigation } from "@shopify/polaris";
import {
  HomeIcon,
  ListBulletedIcon,
  SettingsIcon,
  DiscountIcon,
  QuestionCircleIcon,
  ChartVerticalFilledIcon,
  ClockIcon,
  CollectionIcon,
  PersonIcon,
  AutomationIcon,
  TargetIcon,
  OrderIcon,
} from "@shopify/polaris-icons";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";

import { authenticate } from "~/shopify.server";
import { getOrCreateShop } from "~/models/shop.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  console.log("[app.tsx loader] Starting authentication...");

  try {
    const { session } = await authenticate.admin(request);
    console.log("[app.tsx loader] Authenticated shop:", session.shop);

    // Ensure shop exists in our database
    await getOrCreateShop(session.shop, {
      accessToken: session.accessToken,
    });
    console.log("[app.tsx loader] Shop record ensured");

    return json({
      apiKey: process.env.SHOPIFY_API_KEY || "",
    });
  } catch (error) {
    console.error("[app.tsx loader] Error:", error);
    throw error;
  }
};

/**
 * Check if the current path matches a navigation item
 * Uses exact matching for leaf routes and prefix matching for parent routes
 */
function isNavItemSelected(currentPath: string, itemPath: string, exactMatch = false): boolean {
  if (exactMatch) {
    return currentPath === itemPath;
  }
  // For parent routes, check if current path starts with item path
  // but ensure we don't match partial segments (e.g., /app/rules shouldn't match /app/ru)
  if (currentPath === itemPath) return true;
  return currentPath.startsWith(itemPath + "/") || currentPath.startsWith(itemPath + "?");
}

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;

  const navigationMarkup = (
    <Navigation location={path}>
      <Navigation.Section
        items={[
          {
            label: "Home",
            icon: HomeIcon,
            onClick: () => navigate("/app"),
            selected: isNavItemSelected(path, "/app", true),
          },
          {
            label: "Pricing Rules",
            icon: ListBulletedIcon,
            onClick: () => navigate("/app/rules/new"),
            selected: isNavItemSelected(path, "/app/rules"),
          },
          {
            label: "Discounts",
            icon: DiscountIcon,
            onClick: () => navigate("/app/discount/new"),
            selected: isNavItemSelected(path, "/app/discount"),
          },
          {
            label: "Bundles",
            icon: CollectionIcon,
            onClick: () => navigate("/app/bundles"),
            selected: isNavItemSelected(path, "/app/bundles"),
          },
          {
            label: "Timers",
            icon: ClockIcon,
            onClick: () => navigate("/app/timers"),
            selected: isNavItemSelected(path, "/app/timers"),
          },
          {
            label: "B2B/Wholesale",
            icon: PersonIcon,
            onClick: () => navigate("/app/wholesale"),
            selected: isNavItemSelected(path, "/app/wholesale"),
          },
          {
            label: "A/B Testing",
            icon: TargetIcon,
            onClick: () => navigate("/app/ab-testing"),
            selected: isNavItemSelected(path, "/app/ab-testing"),
          },
          {
            label: "Post-Purchase",
            icon: OrderIcon,
            onClick: () => navigate("/app/upsells"),
            selected: isNavItemSelected(path, "/app/upsells"),
          },
          {
            label: "AI Pricing",
            icon: AutomationIcon,
            onClick: () => navigate("/app/ai-pricing"),
            selected: isNavItemSelected(path, "/app/ai-pricing"),
          },
          {
            label: "Analytics",
            icon: ChartVerticalFilledIcon,
            onClick: () => navigate("/app/analytics"),
            selected: isNavItemSelected(path, "/app/analytics"),
          },
          {
            label: "Settings",
            icon: SettingsIcon,
            onClick: () => navigate("/app/settings"),
            selected: isNavItemSelected(path, "/app/settings", true),
          },
          {
            label: "Help",
            icon: QuestionCircleIcon,
            onClick: () => navigate("/app/help"),
            selected: isNavItemSelected(path, "/app/help", true),
          },
        ]}
      />
    </Navigation>
  );

  return (
    <AppProvider isEmbeddedApp={false} apiKey={apiKey}>
      <Frame navigation={navigationMarkup}>
        <Outlet />
      </Frame>
    </AppProvider>
  );
}

// Shopify needs Alarm Alarm Alarm
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs: Parameters<typeof boundary.headers>[0]) => {
  return boundary.headers(headersArgs);
};
