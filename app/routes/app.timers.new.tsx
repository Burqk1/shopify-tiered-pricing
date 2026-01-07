/**
 * Create New Timer Route
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
  BlockStack,
  InlineStack,
  Text,
  ColorPicker,
  Checkbox,
  Banner,
  Box,
  hsbToRgb,
  rgbToHsb,
} from "@shopify/polaris";
import { useState } from "react";

import { authenticate } from "~/shopify.server";
import { getShopByDomain } from "~/models/shop.server";
import { createTimer } from "~/models/timer.server";
import { getActiveRulesForSync } from "~/models/pricing-rule.server";
import type { TimerShowOn } from "@prisma/client";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const shop = await getShopByDomain(session.shop);
  if (!shop) {
    throw new Response("Shop not found", { status: 404 });
  }

  const rules = await getActiveRulesForSync(shop.id);

  return json({
    shopId: shop.id,
    rules: rules.map((r) => ({ id: r.id, name: r.name })),
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  const shop = await getShopByDomain(session.shop);
  if (!shop) {
    return json({ error: "Shop not found" }, { status: 404 });
  }

  const name = formData.get("name") as string;
  const endDate = formData.get("endDate") as string;
  const endTime = formData.get("endTime") as string;
  const title = formData.get("title") as string;
  const style = formData.get("style") as string;
  const bgColor = formData.get("bgColor") as string;
  const textColor = formData.get("textColor") as string;
  const showOn = formData.get("showOn") as TimerShowOn;
  const linkedRuleId = formData.get("linkedRuleId") as string;
  const expiredMessage = formData.get("expiredMessage") as string;
  const hideOnExpiry = formData.get("hideOnExpiry") === "true";

  if (!name || !endDate || !endTime) {
    return json({ error: "Name and end time are required" }, { status: 400 });
  }

  const endDateTime = new Date(`${endDate}T${endTime}`);

  if (endDateTime <= new Date()) {
    return json({ error: "End time must be in the future" }, { status: 400 });
  }

  await createTimer({
    shopId: shop.id,
    name,
    endTime: endDateTime,
    title: title || "Sale ends in:",
    style: style || "default",
    bgColor: bgColor || "#ff4444",
    textColor: textColor || "#ffffff",
    showOn: showOn || "ALL_PAGES",
    linkedRuleId: linkedRuleId || undefined,
    expiredMessage: expiredMessage || undefined,
    hideOnExpiry,
  });

  return redirect("/app/timers");
};

export default function NewTimer() {
  const { rules } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();

  const [name, setName] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("23:59");
  const [title, setTitle] = useState("Sale ends in:");
  const [style, setStyle] = useState("default");
  const [bgColor, setBgColor] = useState("#ff4444");
  const [textColor, setTextColor] = useState("#ffffff");
  const [showOn, setShowOn] = useState<TimerShowOn>("ALL_PAGES");
  const [linkedRuleId, setLinkedRuleId] = useState("");
  const [expiredMessage, setExpiredMessage] = useState("");
  const [hideOnExpiry, setHideOnExpiry] = useState(false);

  const isLoading = navigation.state === "submitting";

  // Quick preset buttons
  const setPreset = (hours: number) => {
    const future = new Date();
    future.setHours(future.getHours() + hours);
    setEndDate(future.toISOString().split("T")[0]);
    setEndTime(future.toISOString().split("T")[1].slice(0, 5));
  };

  const handleSubmit = () => {
    const formData = new FormData();
    formData.append("name", name);
    formData.append("endDate", endDate);
    formData.append("endTime", endTime);
    formData.append("title", title);
    formData.append("style", style);
    formData.append("bgColor", bgColor);
    formData.append("textColor", textColor);
    formData.append("showOn", showOn);
    formData.append("linkedRuleId", linkedRuleId);
    formData.append("expiredMessage", expiredMessage);
    formData.append("hideOnExpiry", hideOnExpiry.toString());
    submit(formData, { method: "post" });
  };

  return (
    <Page
      title="Create Countdown Timer"
      backAction={{ content: "Timers", url: "/app/timers" }}
    >
      <BlockStack gap="500">
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">
              Timer Details
            </Text>
            <FormLayout>
              <TextField
                label="Timer Name"
                value={name}
                onChange={setName}
                placeholder="e.g., Flash Sale Timer"
                helpText="Internal name for your reference"
                autoComplete="off"
              />

              <TextField
                label="Display Title"
                value={title}
                onChange={setTitle}
                placeholder="Sale ends in:"
                helpText="Text shown above the countdown"
                autoComplete="off"
              />
            </FormLayout>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">
              End Time
            </Text>

            <InlineStack gap="200">
              <Button size="slim" onClick={() => setPreset(1)}>
                +1 Hour
              </Button>
              <Button size="slim" onClick={() => setPreset(6)}>
                +6 Hours
              </Button>
              <Button size="slim" onClick={() => setPreset(24)}>
                +24 Hours
              </Button>
              <Button size="slim" onClick={() => setPreset(72)}>
                +3 Days
              </Button>
              <Button size="slim" onClick={() => setPreset(168)}>
                +7 Days
              </Button>
            </InlineStack>

            <FormLayout>
              <FormLayout.Group>
                <TextField
                  type="date"
                  label="End Date"
                  value={endDate}
                  onChange={setEndDate}
                  autoComplete="off"
                />
                <TextField
                  type="time"
                  label="End Time"
                  value={endTime}
                  onChange={setEndTime}
                  autoComplete="off"
                />
              </FormLayout.Group>
            </FormLayout>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">
              Appearance
            </Text>
            <FormLayout>
              <Select
                label="Style"
                options={[
                  { label: "Default (Full Width Banner)", value: "default" },
                  { label: "Minimal (Compact)", value: "minimal" },
                  { label: "Floating Badge", value: "floating" },
                  { label: "Gradient", value: "gradient" },
                  { label: "Neon Glow", value: "neon" },
                  { label: "Glass Effect", value: "glass" },
                  { label: "Circular Cards", value: "circular" },
                ]}
                value={style}
                onChange={setStyle}
              />

              <FormLayout.Group>
                <TextField
                  label="Background Color"
                  value={bgColor}
                  onChange={setBgColor}
                  placeholder="#ff4444"
                  helpText="Hex color code (e.g., #ff4444)"
                  autoComplete="off"
                  prefix={
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        backgroundColor: bgColor,
                        borderRadius: 4,
                        border: "1px solid #ccc",
                      }}
                    />
                  }
                />
                <TextField
                  label="Text Color"
                  value={textColor}
                  onChange={setTextColor}
                  placeholder="#ffffff"
                  helpText="Hex color code (e.g., #ffffff)"
                  autoComplete="off"
                  prefix={
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        backgroundColor: textColor,
                        borderRadius: 4,
                        border: "1px solid #ccc",
                      }}
                    />
                  }
                />
              </FormLayout.Group>
            </FormLayout>

            {/* Preview */}
            <Text variant="headingSm" as="h3">
              Preview
            </Text>
            <Box
              padding="400"
              borderRadius="200"
              background="bg-surface-secondary"
            >
              <div
                style={{
                  backgroundColor: bgColor,
                  color: textColor,
                  padding: style === "minimal" ? "8px 16px" : "16px",
                  borderRadius: "8px",
                  textAlign: "center",
                  fontFamily: "system-ui",
                }}
              >
                <div style={{ fontSize: style === "minimal" ? "12px" : "14px" }}>
                  {title}
                </div>
                <div
                  style={{
                    fontSize: style === "minimal" ? "18px" : "24px",
                    fontWeight: "bold",
                    marginTop: "4px",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  02:14:35:42
                </div>
                {style !== "minimal" && (
                  <div style={{ fontSize: "10px", marginTop: "4px", opacity: 0.8 }}>
                    DAYS &nbsp;&nbsp; HOURS &nbsp;&nbsp; MINS &nbsp;&nbsp; SECS
                  </div>
                )}
              </div>
            </Box>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">
              Settings
            </Text>
            <FormLayout>
              <Select
                label="Show On"
                options={[
                  { label: "All Pages", value: "ALL_PAGES" },
                  { label: "Product Pages Only", value: "PRODUCT_PAGES" },
                  { label: "Collection Pages Only", value: "COLLECTION_PAGES" },
                  { label: "Cart Page Only", value: "CART_PAGE" },
                ]}
                value={showOn}
                onChange={(v) => setShowOn(v as TimerShowOn)}
              />

              <Select
                label="Link to Pricing Rule (Optional)"
                options={[
                  { label: "None", value: "" },
                  ...rules.map((r) => ({ label: r.name, value: r.id })),
                ]}
                value={linkedRuleId}
                onChange={setLinkedRuleId}
                helpText="Automatically pause the rule when timer expires"
              />

              <TextField
                label="Expired Message (Optional)"
                value={expiredMessage}
                onChange={setExpiredMessage}
                placeholder="e.g., Sale has ended!"
                autoComplete="off"
              />

              <Checkbox
                label="Hide timer when expired"
                checked={hideOnExpiry}
                onChange={setHideOnExpiry}
              />
            </FormLayout>
          </BlockStack>
        </Card>

        <InlineStack align="end" gap="200">
          <Button url="/app/timers">Cancel</Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={isLoading}
            disabled={!name || !endDate || !endTime}
          >
            Create Timer
          </Button>
        </InlineStack>
      </BlockStack>
    </Page>
  );
}
