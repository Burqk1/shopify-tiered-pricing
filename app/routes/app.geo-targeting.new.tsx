/**
 * Create Geo Targeting Rule Route
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useNavigate, useSubmit, useNavigation, useSearchParams } from "@remix-run/react";
import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  TextField,
  Select,
  Checkbox,
  Banner,
  Layout,
  FormLayout,
  Divider,
  Box,
  Tag,
  Autocomplete,
  Icon,
} from "@shopify/polaris";
import { useState, useCallback, useMemo, useEffect } from "react";
import { SearchIcon } from "@shopify/polaris-icons";

import { authenticate } from "~/shopify.server";
import { getShopByDomain, getLocaleSettings } from "~/models/shop.server";
import { createGeoRule, COUNTRY_DATA } from "~/models/geo-rules.server";
import { getTranslations } from "~/i18n";
import { requireFeatureAccess } from "~/utils/plan-guard.server";

// Region presets
const REGION_PRESETS: Record<string, string[]> = {
  eu: ["DE", "FR", "IT", "ES", "NL", "BE", "AT", "PT", "IE", "FI", "SE", "DK", "PL", "CZ", "GR"],
  na: ["US", "CA", "MX"],
  apac: ["JP", "KR", "AU", "CN", "IN", "SG", "TH", "MY", "ID", "PH"],
  latam: ["BR", "MX", "AR", "CL", "CO", "PE"],
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  // Check if user has access (PROFESSIONAL plan required for multi-currency/geo)
  await requireFeatureAccess(session.shop, "multiCurrency");

  const shop = await getShopByDomain(session.shop);
  if (!shop) {
    throw new Response("Shop not found", { status: 404 });
  }

  const localeSettings = await getLocaleSettings(session.shop);
  const locale = localeSettings?.locale || "en";
  const t = getTranslations(locale);

  return json({
    shopId: shop.id,
    currency: shop.currencySymbol || "$",
    t,
    countryData: COUNTRY_DATA,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const shop = await getShopByDomain(session.shop);
  if (!shop) {
    return json({ error: "Shop not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const data = Object.fromEntries(formData);

  try {
    const countries = (data.countries as string).split(",").filter(Boolean);

    const rule = await createGeoRule({
      shopId: shop.id,
      name: data.name as string,
      priority: parseInt(data.priority as string) || 0,
      countries,
      excludeCountries: (data.excludeCountries as string || "").split(",").filter(Boolean),
      adjustmentType: data.adjustmentType as any,
      adjustmentValue: parseFloat(data.adjustmentValue as string),
      applyTo: data.applyTo as any,
      showOriginalPrice: data.showOriginalPrice === "true",
      displayCurrency: data.displayCurrency as string || undefined,
    });

    const status = data.status as string;
    if (status === "ACTIVE") {
      const { updateGeoRuleStatus } = await import("~/models/geo-rules.server");
      await updateGeoRuleStatus(rule.id, "ACTIVE");
    }

    return redirect("/app/geo-targeting");
  } catch (error) {
    console.error("Failed to create geo rule:", error);
    return json({ error: "Failed to create geo rule" }, { status: 500 });
  }
};

export default function CreateGeoRule() {
  const { shopId, currency, t, countryData } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [searchParams] = useSearchParams();

  // Form state
  const [name, setName] = useState("");
  const [priority, setPriority] = useState("0");
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [excludeCountries, setExcludeCountries] = useState<string[]>([]);
  const [adjustmentType, setAdjustmentType] = useState("PERCENTAGE");
  const [adjustmentValue, setAdjustmentValue] = useState("0");
  const [applyTo, setApplyTo] = useState("ALL_PRODUCTS");
  const [showOriginalPrice, setShowOriginalPrice] = useState(true);
  const [displayCurrency, setDisplayCurrency] = useState("");
  const [error, setError] = useState("");

  // Country search
  const [countrySearch, setCountrySearch] = useState("");

  // Apply region preset from URL
  useEffect(() => {
    const region = searchParams.get("region");
    if (region && REGION_PRESETS[region]) {
      setSelectedCountries(REGION_PRESETS[region]);
      setName(region === "eu" ? "EU Pricing" : region === "na" ? "North America" : region === "apac" ? "Asia Pacific" : "Latin America");
    }
  }, [searchParams]);

  const countryOptions = useMemo(() => {
    return Object.entries(countryData)
      .filter(([code]) => !selectedCountries.includes(code))
      .map(([code, data]) => ({
        value: code,
        label: `${data.name} (${code})`,
      }));
  }, [countryData, selectedCountries]);

  const filteredCountryOptions = useMemo(() => {
    if (!countrySearch) return countryOptions.slice(0, 10);
    const search = countrySearch.toLowerCase();
    return countryOptions
      .filter((opt) => opt.label.toLowerCase().includes(search))
      .slice(0, 10);
  }, [countryOptions, countrySearch]);

  const handleAddCountry = useCallback((code: string) => {
    setSelectedCountries((prev) => [...prev, code]);
    setCountrySearch("");
  }, []);

  const handleRemoveCountry = useCallback((code: string) => {
    setSelectedCountries((prev) => prev.filter((c) => c !== code));
  }, []);

  const handleSubmit = useCallback(
    (status: string) => {
      if (!name.trim()) {
        setError("Please enter a rule name");
        return;
      }
      if (selectedCountries.length === 0) {
        setError("Please select at least one country");
        return;
      }

      const formData = new FormData();
      formData.append("name", name);
      formData.append("priority", priority);
      formData.append("countries", selectedCountries.join(","));
      formData.append("excludeCountries", excludeCountries.join(","));
      formData.append("adjustmentType", adjustmentType);
      formData.append("adjustmentValue", adjustmentValue);
      formData.append("applyTo", applyTo);
      formData.append("showOriginalPrice", showOriginalPrice.toString());
      formData.append("displayCurrency", displayCurrency);
      formData.append("status", status);

      submit(formData, { method: "POST" });
    },
    [name, priority, selectedCountries, excludeCountries, adjustmentType, adjustmentValue, applyTo, showOriginalPrice, displayCurrency, submit]
  );

  const adjustmentTypeOptions = [
    { label: "Percentage (+/- %)", value: "PERCENTAGE" },
    { label: `Fixed Amount (+/- ${currency})`, value: "FIXED_AMOUNT" },
    { label: "Fixed Price (=)", value: "FIXED_PRICE" },
    { label: "Multiplier (×)", value: "MULTIPLIER" },
  ];

  const applyToOptions = [
    { label: "All Products", value: "ALL_PRODUCTS" },
    { label: "Specific Products", value: "SPECIFIC_PRODUCTS" },
    { label: "Specific Collections", value: "SPECIFIC_COLLECTIONS" },
    { label: "Exclude Sale Items", value: "EXCLUDE_SALE_ITEMS" },
  ];

  const priorityOptions = [
    { label: "Low (0)", value: "0" },
    { label: "Medium (5)", value: "5" },
    { label: "High (10)", value: "10" },
  ];

  const currencyOptions = [
    { label: "Same as shop", value: "" },
    { label: "USD ($)", value: "USD" },
    { label: "EUR (€)", value: "EUR" },
    { label: "GBP (£)", value: "GBP" },
    { label: "CAD (CA$)", value: "CAD" },
    { label: "AUD (A$)", value: "AUD" },
    { label: "JPY (¥)", value: "JPY" },
  ];

  // Preview calculation
  const getPreviewPrice = () => {
    const basePrice = 100;
    const value = parseFloat(adjustmentValue) || 0;

    switch (adjustmentType) {
      case "PERCENTAGE":
        return basePrice * (1 + value / 100);
      case "FIXED_AMOUNT":
        return basePrice + value;
      case "FIXED_PRICE":
        return value;
      case "MULTIPLIER":
        return basePrice * value;
      default:
        return basePrice;
    }
  };

  return (
    <Page
      title="Create Geo Rule"
      backAction={{ content: "Geo Targeting", url: "/app/geo-targeting" }}
    >
      <BlockStack gap="500">
        {error && (
          <Banner tone="critical" onDismiss={() => setError("")}>
            {error}
          </Banner>
        )}

        {/* Price Preview */}
        <Card>
          <BlockStack gap="300">
            <Text variant="headingSm" as="h3">Price Preview</Text>
            <InlineStack gap="400" align="center">
              <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                <BlockStack gap="100">
                  <Text variant="bodySm" tone="subdued" as="span">Base Price</Text>
                  <Text variant="headingLg" as="p">{currency}100.00</Text>
                </BlockStack>
              </Box>
              <Text variant="headingMd" as="span">→</Text>
              <Box padding="300" background="bg-surface-success" borderRadius="200">
                <BlockStack gap="100">
                  <Text variant="bodySm" tone="subdued" as="span">Geo Price</Text>
                  <Text variant="headingLg" as="p">
                    {displayCurrency || currency}{getPreviewPrice().toFixed(2)}
                  </Text>
                </BlockStack>
              </Box>
            </InlineStack>
          </BlockStack>
        </Card>

        <Layout>
          <Layout.Section>
            {/* Basic Info */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingSm" as="h3">Basic Information</Text>
                <FormLayout>
                  <TextField
                    label="Rule Name"
                    value={name}
                    onChange={setName}
                    placeholder="e.g., EU Pricing +10%"
                    autoComplete="off"
                    helpText="Descriptive name for this rule"
                  />
                  <Select
                    label="Priority"
                    options={priorityOptions}
                    value={priority}
                    onChange={setPriority}
                    helpText="Higher priority rules are checked first"
                  />
                </FormLayout>
              </BlockStack>
            </Card>

            {/* Country Selection */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingSm" as="h3">Target Countries</Text>

                {/* Quick Presets */}
                <InlineStack gap="200">
                  <Button size="slim" onClick={() => setSelectedCountries(REGION_PRESETS.eu)}>
                    🇪🇺 EU
                  </Button>
                  <Button size="slim" onClick={() => setSelectedCountries(REGION_PRESETS.na)}>
                    🇺🇸 NA
                  </Button>
                  <Button size="slim" onClick={() => setSelectedCountries(REGION_PRESETS.apac)}>
                    🌏 APAC
                  </Button>
                  <Button size="slim" onClick={() => setSelectedCountries([])}>
                    Clear
                  </Button>
                </InlineStack>

                {/* Country Search */}
                <TextField
                  label="Search Countries"
                  value={countrySearch}
                  onChange={setCountrySearch}
                  placeholder="Type to search..."
                  autoComplete="off"
                  prefix={<Icon source={SearchIcon} />}
                />

                {/* Country Suggestions */}
                {countrySearch && filteredCountryOptions.length > 0 && (
                  <InlineStack gap="200" wrap>
                    {filteredCountryOptions.map((opt) => (
                      <Button
                        key={opt.value}
                        size="slim"
                        onClick={() => handleAddCountry(opt.value)}
                      >
                        + {opt.label}
                      </Button>
                    ))}
                  </InlineStack>
                )}

                {/* Selected Countries */}
                <BlockStack gap="200">
                  <Text variant="bodySm" fontWeight="semibold" as="span">Selected ({selectedCountries.length})</Text>
                  <InlineStack gap="200" wrap>
                    {selectedCountries.map((code) => (
                      <Tag key={code} onRemove={() => handleRemoveCountry(code)}>
                        {countryData[code]?.name || code}
                      </Tag>
                    ))}
                  </InlineStack>
                  {selectedCountries.length === 0 && (
                    <Text variant="bodySm" tone="subdued" as="span">No countries selected</Text>
                  )}
                </BlockStack>
              </BlockStack>
            </Card>

            {/* Price Adjustment */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingSm" as="h3">Price Adjustment</Text>
                <FormLayout>
                  <Select
                    label="Adjustment Type"
                    options={adjustmentTypeOptions}
                    value={adjustmentType}
                    onChange={setAdjustmentType}
                  />
                  <TextField
                    label={
                      adjustmentType === "PERCENTAGE" ? "Percentage" :
                      adjustmentType === "MULTIPLIER" ? "Multiplier" :
                      "Amount"
                    }
                    type="number"
                    value={adjustmentValue}
                    onChange={setAdjustmentValue}
                    autoComplete="off"
                    helpText={
                      adjustmentType === "PERCENTAGE" ? "Use negative for discount (e.g., -10 for 10% off)" :
                      adjustmentType === "MULTIPLIER" ? "e.g., 1.2 for 20% increase" :
                      "Use negative for discount"
                    }
                  />
                </FormLayout>
              </BlockStack>
            </Card>

            {/* Display Settings */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingSm" as="h3">Display Settings</Text>
                <FormLayout>
                  <Select
                    label="Apply To"
                    options={applyToOptions}
                    value={applyTo}
                    onChange={setApplyTo}
                  />
                  <Select
                    label="Display Currency"
                    options={currencyOptions}
                    value={displayCurrency}
                    onChange={setDisplayCurrency}
                    helpText="Show prices in this currency for selected countries"
                  />
                  <Checkbox
                    label="Show original price (strikethrough)"
                    checked={showOriginalPrice}
                    onChange={setShowOriginalPrice}
                    helpText="Display original price next to adjusted price"
                  />
                </FormLayout>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            {/* Tips */}
            <Card>
              <BlockStack gap="300">
                <Text variant="headingSm" as="h3">💡 Tips</Text>
                <BlockStack gap="200">
                  <Text variant="bodySm" as="p">
                    <strong>EU VAT:</strong> Use +20-25% for EU countries to cover VAT.
                  </Text>
                  <Text variant="bodySm" as="p">
                    <strong>Emerging markets:</strong> Consider -10-20% for price-sensitive regions.
                  </Text>
                  <Text variant="bodySm" as="p">
                    <strong>Currency:</strong> Showing local currency increases trust.
                  </Text>
                </BlockStack>
                <Divider />
                <Text variant="bodySm" tone="subdued" as="p">
                  Geo rules are detected automatically from customer's IP address.
                </Text>
              </BlockStack>
            </Card>

            {/* Actions */}
            <Card>
              <BlockStack gap="300">
                <Button
                  variant="primary"
                  size="large"
                  fullWidth
                  onClick={() => handleSubmit("ACTIVE")}
                  loading={isSubmitting}
                >
                  Save & Activate
                </Button>
                <Button
                  fullWidth
                  onClick={() => handleSubmit("DRAFT")}
                  loading={isSubmitting}
                >
                  Save as Draft
                </Button>
                <Button
                  fullWidth
                  variant="plain"
                  onClick={() => navigate("/app/geo-targeting")}
                >
                  Cancel
                </Button>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
