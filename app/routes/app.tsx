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
  GiftCardIcon,
  CartIcon,
  GlobeIcon,
  ImportIcon,
  LockIcon,
} from "@shopify/polaris-icons";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";

import { authenticate } from "~/shopify.server";
import { getOrCreateShop, getLocaleSettings, getPlanFeatures } from "~/models/shop.server";
import { getTranslations } from "~/i18n";
import type { Plan } from "@prisma/client";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  console.log("[app.tsx loader] Starting authentication...");

  try {
    const { session } = await authenticate.admin(request);
    console.log("[app.tsx loader] Authenticated shop:", session.shop);

    // Ensure shop exists in our database
    const shop = await getOrCreateShop(session.shop, {
      accessToken: session.accessToken,
    });
    console.log("[app.tsx loader] Shop record ensured");

    // Get locale settings for translations
    const localeSettings = await getLocaleSettings(session.shop);
    const locale = localeSettings?.locale || "en";
    const t = getTranslations(locale);

    // Get plan features for navigation gating
    const plan = shop.plan as Plan;
    const planFeatures = getPlanFeatures(plan);

    return json({
      apiKey: process.env.SHOPIFY_API_KEY || "",
      t,
      plan,
      planFeatures,
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
  const { apiKey, t, plan, planFeatures } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;

  // Helper to create nav item with optional lock for premium features
  const createNavItem = (
    label: string,
    icon: typeof HomeIcon,
    targetPath: string,
    exactMatch = false,
    requiredFeature?: keyof typeof planFeatures | null,
    requiredPlan?: Plan[]
  ) => {
    // Check if feature is locked
    const isLocked = requiredFeature
      ? !planFeatures[requiredFeature]
      : requiredPlan
        ? !requiredPlan.includes(plan)
        : false;

    return {
      label: isLocked ? `${label} 🔒` : label,
      icon: isLocked ? LockIcon : icon,
      disabled: isLocked, // Makes the item appear faded/dimmed
      onClick: () => {
        if (isLocked) {
          // Redirect to upgrade page instead
          navigate("/app/settings?tab=billing&upgrade=true");
        } else {
          navigate(targetPath);
        }
      },
      selected: isNavItemSelected(path, targetPath, exactMatch),
    };
  };

  const navigationMarkup = (
    <Navigation location={path}>
      <Navigation.Section
        items={[
          // Always available
          createNavItem(t.nav.home, HomeIcon, "/app", true),
          createNavItem(t.nav.pricingRules, ListBulletedIcon, "/app/rules/new"),
          createNavItem(t.nav.discounts, DiscountIcon, "/app/discount/new"),

          // GROWTH+ features (unlimitedRules unlocks these)
          createNavItem(t.nav.bundles, CollectionIcon, "/app/bundles", false, "customerTags"),
          createNavItem(t.nav.bogo || "BOGO", GiftCardIcon, "/app/bogo", false, "customerTags"),
          createNavItem(t.nav.cartProgress || "Cart Progress", CartIcon, "/app/cart-progress", false, "customerTags"),
          createNavItem(t.nav.gifts || "Gifts", GiftCardIcon, "/app/gifts", false, "customerTags"),
          createNavItem(t.nav.timers, ClockIcon, "/app/timers", false, "cssEditor"),
          createNavItem(t.nav.wholesale, PersonIcon, "/app/wholesale", false, "customerTags"),
          createNavItem(t.nav.abTesting, TargetIcon, "/app/ab-testing", false, "abTesting"),
          createNavItem(t.nav.postPurchase, OrderIcon, "/app/upsells", false, "customerTags"),

          // PROFESSIONAL features
          createNavItem(t.nav.aiPricing, AutomationIcon, "/app/ai-pricing", false, "aiPricing"),
          createNavItem(t.nav.analytics, ChartVerticalFilledIcon, "/app/analytics", false, "competitorTracking"),
          createNavItem(t.nav.geoTargeting || "Geo Targeting", GlobeIcon, "/app/geo-targeting", false, "multiCurrency"),
          createNavItem(t.nav.importExport || "Import/Export", ImportIcon, "/app/import-export", false, "customerTags"),

          // Always available
          createNavItem(t.nav.settings, SettingsIcon, "/app/settings", true),
          createNavItem(t.nav.help, QuestionCircleIcon, "/app/help", true),
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
