/**
 * Import/Export Route
 *
 * CSV import and export functionality for rules
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate, useSubmit, useNavigation } from "@remix-run/react";
import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Banner,
  Layout,
  DropZone,
  Thumbnail,
  List,
  IndexTable,
  Badge,
  Box,
  Divider,
  ProgressBar,
} from "@shopify/polaris";
import { useState, useCallback } from "react";
import { ImportIcon, ExportIcon, NoteIcon } from "@shopify/polaris-icons";

import { authenticate } from "~/shopify.server";
import { getShopByDomain, getLocaleSettings } from "~/models/shop.server";
import {
  getImportJobs,
  createImportJob,
  getPricingRulesCSVTemplate,
  getBogoCSVTemplate,
  getGeoRulesCSVTemplate,
} from "~/models/import-job.server";
import { getTranslations } from "~/i18n";

// Client-side CSV templates (duplicated from server for client use)
const CSV_TEMPLATES = {
  PRICING_RULES: `name,priority,condition_type,condition_value,tier_min_qty,tier_max_qty,tier_value_type,tier_discount_value,tier_message,status
"10% Off 5+ Items",5,ALL,,5,,PERCENTAGE,10,"Buy 5+ get 10% off",ACTIVE
"20% Off 10+ Items",5,ALL,,10,,PERCENTAGE,20,"Buy 10+ get 20% off",ACTIVE
"$5 Off Premium Collection",3,COLLECTION,Premium Collection,3,,FIXED_AMOUNT,5,,ACTIVE`,
  BOGO_OFFERS: `name,bogo_type,buy_quantity,get_quantity,discount_type,discount_value,max_uses,status
"Buy 2 Get 1 Free",BUY_X_GET_Y,2,1,PERCENTAGE,100,,ACTIVE
"Buy 3 Get 1 Half Off",BUY_X_GET_Y,3,1,PERCENTAGE,50,,ACTIVE`,
  GEO_RULES: `name,countries,adjustment_type,adjustment_value,display_currency,round_prices,status
"EU Pricing",DE;FR;IT;ES,PERCENTAGE,10,EUR,true,ACTIVE
"UK Pricing",GB,PERCENTAGE,5,GBP,true,ACTIVE`,
};

// Import requireFeatureAccess for plan gating
import { requireFeatureAccess } from "~/utils/plan-guard.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  // Check if user has access (GROWTH+ plan required)
  await requireFeatureAccess(session.shop, "customerTags");

  const shop = await getShopByDomain(session.shop);
  if (!shop) {
    throw new Response("Shop not found", { status: 404 });
  }

  const jobs = await getImportJobs(shop.id);

  const localeSettings = await getLocaleSettings(session.shop);
  const locale = localeSettings?.locale || "en";
  const t = getTranslations(locale);

  return json({
    jobs: jobs.map((j) => ({
      id: j.id,
      jobType: j.jobType,
      status: j.status,
      fileName: j.fileName,
      totalRows: j.totalRows,
      successRows: j.successRows,
      errorRows: j.errorRows,
      createdAt: j.createdAt.toISOString(),
      completedAt: j.completedAt?.toISOString(),
    })),
    shopId: shop.id,
    t,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const shop = await getShopByDomain(session.shop);
  if (!shop) {
    return json({ error: "Shop not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const action = formData.get("action");

  switch (action) {
    case "downloadTemplate": {
      const templateType = formData.get("templateType") as string;
      let content = "";
      let filename = "";

      switch (templateType) {
        case "pricing_rules":
          content = getPricingRulesCSVTemplate();
          filename = "pricing_rules_template.csv";
          break;
        case "bogo":
          content = getBogoCSVTemplate();
          filename = "bogo_template.csv";
          break;
        case "geo_rules":
          content = getGeoRulesCSVTemplate();
          filename = "geo_rules_template.csv";
          break;
        default:
          return json({ error: "Unknown template type" }, { status: 400 });
      }

      return json({ content, filename });
    }

    case "import": {
      // Handle file upload
      const file = formData.get("file") as File;
      const importType = formData.get("importType") as string;

      if (!file) {
        return json({ error: "No file provided" }, { status: 400 });
      }

      // Create import job
      const job = await createImportJob({
        shopId: shop.id,
        jobType: importType as any,
        fileName: file.name,
        fileSize: file.size,
      });

      // Process would happen asynchronously
      // For now, return the job ID
      return json({ success: true, jobId: job.id });
    }

    default:
      return json({ error: "Unknown action" }, { status: 400 });
  }
};

export default function ImportExport() {
  const { jobs, shopId, t } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importType, setImportType] = useState("PRICING_RULES");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleDropZoneDrop = useCallback(
    (_dropFiles: File[], acceptedFiles: File[], _rejectedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        setSelectedFile(acceptedFiles[0]);
        setError("");
      }
    },
    []
  );

  const handleDownloadTemplate = useCallback(
    (templateType: string) => {
      const content = CSV_TEMPLATES[templateType as keyof typeof CSV_TEMPLATES];
      if (!content) return;

      const blob = new Blob([content], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${templateType.toLowerCase()}_template.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    []
  );

  const handleImport = useCallback(() => {
    if (!selectedFile) {
      setError("Please select a file to import");
      return;
    }

    const formData = new FormData();
    formData.append("action", "import");
    formData.append("file", selectedFile);
    formData.append("importType", importType);

    submit(formData, { method: "POST", encType: "multipart/form-data" });
    setSuccess("Import started! Check the history below for progress.");
    setSelectedFile(null);
  }, [selectedFile, importType, submit]);

  const getStatusBadge = (status: string) => {
    const config: Record<string, { tone: "success" | "warning" | "critical" | "info"; label: string }> = {
      PENDING: { tone: "info", label: "Pending" },
      PROCESSING: { tone: "warning", label: "Processing" },
      COMPLETED: { tone: "success", label: "Completed" },
      FAILED: { tone: "critical", label: "Failed" },
      CANCELLED: { tone: "critical", label: "Cancelled" },
    };
    const c = config[status] || { tone: "info", label: status };
    return <Badge tone={c.tone}>{c.label}</Badge>;
  };

  const jobTypeLabels: Record<string, string> = {
    PRICING_RULES: "Pricing Rules",
    BUNDLES: "Bundles",
    CUSTOMER_GROUPS: "Customer Groups",
    BOGO_OFFERS: "BOGO Offers",
    GEO_RULES: "Geo Rules",
  };

  const fileUpload = !selectedFile && (
    <DropZone.FileUpload actionHint="or drop files to upload" />
  );

  const uploadedFile = selectedFile && (
    <InlineStack gap="200" align="center">
      <Thumbnail size="small" alt={selectedFile.name} source={NoteIcon} />
      <BlockStack gap="050">
        <Text variant="bodySm" fontWeight="medium" as="span">
          {selectedFile.name}
        </Text>
        <Text variant="bodySm" tone="subdued" as="span">
          {(selectedFile.size / 1024).toFixed(1)} KB
        </Text>
      </BlockStack>
    </InlineStack>
  );

  return (
    <Page
      title="Import / Export"
      subtitle="Bulk manage your pricing rules via CSV"
      backAction={{ content: t.nav.dashboard, url: "/app" }}
    >
      <BlockStack gap="500">
        {error && (
          <Banner tone="critical" onDismiss={() => setError("")}>
            {error}
          </Banner>
        )}
        {success && (
          <Banner tone="success" onDismiss={() => setSuccess("")}>
            {success}
          </Banner>
        )}

        <Layout>
          {/* Export Section */}
          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text variant="headingSm" as="h3">📤 Export</Text>
                </InlineStack>
                <Text variant="bodyMd" as="p">
                  Download your existing rules as CSV files for backup or editing.
                </Text>
                <Divider />
                <BlockStack gap="300">
                  <Button
                    fullWidth
                    icon={ExportIcon}
                    onClick={() => navigate("/app/api/analytics-export?type=pricing_rules")}
                  >
                    Export Pricing Rules
                  </Button>
                  <Button
                    fullWidth
                    icon={ExportIcon}
                    onClick={() => navigate("/app/api/analytics-export?type=bundles")}
                  >
                    Export Bundles
                  </Button>
                  <Button
                    fullWidth
                    icon={ExportIcon}
                    onClick={() => navigate("/app/api/analytics-export?type=analytics")}
                  >
                    Export Analytics Data
                  </Button>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Import Section */}
          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text variant="headingSm" as="h3">📥 Import</Text>
                </InlineStack>
                <Text variant="bodyMd" as="p">
                  Upload CSV files to bulk create or update rules.
                </Text>
                <Divider />

                {/* Import Type Selection */}
                <BlockStack gap="200">
                  <Text variant="bodySm" fontWeight="semibold" as="span">Select import type:</Text>
                  <InlineStack gap="200" wrap>
                    {["PRICING_RULES", "BOGO_OFFERS", "GEO_RULES"].map((type) => (
                      <Button
                        key={type}
                        pressed={importType === type}
                        onClick={() => setImportType(type)}
                        size="slim"
                      >
                        {jobTypeLabels[type]}
                      </Button>
                    ))}
                  </InlineStack>
                </BlockStack>

                {/* File Drop Zone */}
                <DropZone
                  onDrop={handleDropZoneDrop}
                  accept=".csv"
                  type="file"
                  allowMultiple={false}
                >
                  {uploadedFile}
                  {fileUpload}
                </DropZone>

                <InlineStack gap="200">
                  <Button
                    variant="primary"
                    icon={ImportIcon}
                    onClick={handleImport}
                    loading={isSubmitting}
                    disabled={!selectedFile}
                  >
                    Import File
                  </Button>
                  <Button
                    onClick={() => handleDownloadTemplate(importType)}
                  >
                    Download Template
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* CSV Format Help */}
        <Card>
          <BlockStack gap="400">
            <Text variant="headingSm" as="h3">📋 CSV Format Guide</Text>
            <Layout>
              <Layout.Section variant="oneThird">
                <BlockStack gap="200">
                  <Text variant="bodyMd" fontWeight="semibold" as="h4">Pricing Rules</Text>
                  <List type="bullet">
                    <List.Item>name (required)</List.Item>
                    <List.Item>priority (0-10)</List.Item>
                    <List.Item>condition_type</List.Item>
                    <List.Item>tier_min_qty</List.Item>
                    <List.Item>tier_discount_value</List.Item>
                  </List>
                </BlockStack>
              </Layout.Section>
              <Layout.Section variant="oneThird">
                <BlockStack gap="200">
                  <Text variant="bodyMd" fontWeight="semibold" as="h4">BOGO Offers</Text>
                  <List type="bullet">
                    <List.Item>name (required)</List.Item>
                    <List.Item>bogo_type</List.Item>
                    <List.Item>buy_quantity</List.Item>
                    <List.Item>get_quantity</List.Item>
                    <List.Item>discount_value</List.Item>
                  </List>
                </BlockStack>
              </Layout.Section>
              <Layout.Section variant="oneThird">
                <BlockStack gap="200">
                  <Text variant="bodyMd" fontWeight="semibold" as="h4">Geo Rules</Text>
                  <List type="bullet">
                    <List.Item>name (required)</List.Item>
                    <List.Item>countries (comma-separated)</List.Item>
                    <List.Item>adjustment_type</List.Item>
                    <List.Item>adjustment_value</List.Item>
                    <List.Item>display_currency</List.Item>
                  </List>
                </BlockStack>
              </Layout.Section>
            </Layout>
          </BlockStack>
        </Card>

        {/* Import History */}
        <Card>
          <BlockStack gap="400">
            <Text variant="headingSm" as="h3">Import History</Text>
            {jobs.length === 0 ? (
              <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                <Text variant="bodyMd" tone="subdued" as="p">
                  No import jobs yet. Import a CSV file to get started.
                </Text>
              </Box>
            ) : (
              <IndexTable
                resourceName={{ singular: "import job", plural: "import jobs" }}
                itemCount={jobs.length}
                headings={[
                  { title: "File" },
                  { title: "Type" },
                  { title: "Status" },
                  { title: "Progress" },
                  { title: "Date" },
                ]}
                selectable={false}
              >
                {jobs.map((job, index) => (
                  <IndexTable.Row id={job.id} key={job.id} position={index}>
                    <IndexTable.Cell>
                      <Text variant="bodyMd" as="span">{job.fileName}</Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Badge>{jobTypeLabels[job.jobType] || job.jobType}</Badge>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      {getStatusBadge(job.status)}
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <BlockStack gap="100">
                        <ProgressBar
                          progress={job.totalRows > 0 ? (job.successRows / job.totalRows) * 100 : 0}
                          size="small"
                          tone={job.errorRows > 0 ? "critical" : "success"}
                        />
                        <Text variant="bodySm" tone="subdued" as="span">
                          {job.successRows}/{job.totalRows} rows
                          {job.errorRows > 0 && ` (${job.errorRows} errors)`}
                        </Text>
                      </BlockStack>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text variant="bodySm" tone="subdued" as="span">
                        {new Date(job.createdAt).toLocaleDateString()}
                      </Text>
                    </IndexTable.Cell>
                  </IndexTable.Row>
                ))}
              </IndexTable>
            )}
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
