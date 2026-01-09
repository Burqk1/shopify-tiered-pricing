/**
 * Bundles List Route
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate, useSubmit } from "@remix-run/react";
import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Badge,
  IndexTable,
  EmptyState,
  Thumbnail,
} from "@shopify/polaris";
import { useState } from "react";
import { PlusIcon, ImageIcon } from "@shopify/polaris-icons";

import { authenticate } from "~/shopify.server";
import { DeleteConfirmModal } from "~/components/DeleteConfirmModal";
import { getShopByDomain, getLocaleSettings } from "~/models/shop.server";
import { getBundlesByShop, updateBundleStatus, deleteBundle } from "~/models/bundle.server";
import { getTranslations } from "~/i18n";
import type { RuleStatus } from "@prisma/client";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const shop = await getShopByDomain(session.shop);
  if (!shop) {
    throw new Response("Shop not found", { status: 404 });
  }

  const bundles = await getBundlesByShop(shop.id);

  const localeSettings = await getLocaleSettings(session.shop);
  const locale = localeSettings?.locale || "en";
  const t = getTranslations(locale);

  return json({
    bundles: bundles.map((b) => ({
      id: b.id,
      name: b.name,
      status: b.status,
      discountType: b.discountType,
      discountValue: Number(b.discountValue),
      productCount: b.products.length,
      products: b.products.map((p) => p.productTitle || "Product").slice(0, 3),
      requireAll: b.requireAll,
    })),
    t,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("action");

  switch (action) {
    case "updateStatus": {
      const bundleId = formData.get("bundleId") as string;
      const status = formData.get("status") as RuleStatus;
      await updateBundleStatus(bundleId, status);
      return json({ success: true });
    }
    case "delete": {
      const bundleId = formData.get("bundleId") as string;
      await deleteBundle(bundleId);
      return json({ success: true });
    }
    default:
      return json({ error: "Unknown action" }, { status: 400 });
  }
};

export default function BundlesList() {
  const { bundles, t } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const submit = useSubmit();

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [bundleToDelete, setBundleToDelete] = useState<{ id: string; name: string } | null>(null);

  const handleStatusChange = (bundleId: string, status: RuleStatus) => {
    submit({ action: "updateStatus", bundleId, status }, { method: "POST" });
  };

  const openDeleteModal = (bundle: { id: string; name: string }) => {
    setBundleToDelete(bundle);
    setDeleteModalOpen(true);
  };

  const handleDelete = () => {
    if (bundleToDelete) {
      submit({ action: "delete", bundleId: bundleToDelete.id }, { method: "POST" });
      setDeleteModalOpen(false);
      setBundleToDelete(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { tone: "info" | "success" | "warning" | "critical"; label: string }> = {
      DRAFT: { tone: "info", label: t.bundlesPage.draftStatus },
      ACTIVE: { tone: "success", label: t.bundlesPage.activeStatus },
      PAUSED: { tone: "warning", label: t.bundlesPage.pausedStatus },
      ARCHIVED: { tone: "critical", label: t.bundlesPage.archivedStatus },
    };
    const c = config[status] || config.DRAFT;
    return <Badge tone={c.tone}>{c.label}</Badge>;
  };

  const formatDiscount = (type: string, value: number) => {
    return type === "PERCENTAGE" ? `${value}% ${t.bundlesPage.off}` : `$${value} ${t.bundlesPage.off}`;
  };

  const rowMarkup = bundles.map((bundle, index) => (
    <IndexTable.Row id={bundle.id} key={bundle.id} position={index}>
      <IndexTable.Cell>
        <BlockStack gap="100">
          <Text variant="bodyMd" fontWeight="semibold" as="span">
            {bundle.name}
          </Text>
          <Text variant="bodySm" tone="subdued" as="span">
            {bundle.products.join(" + ")}
            {bundle.productCount > 3 && ` +${bundle.productCount - 3} more`}
          </Text>
        </BlockStack>
      </IndexTable.Cell>
      <IndexTable.Cell>{getStatusBadge(bundle.status)}</IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone="success">{formatDiscount(bundle.discountType, bundle.discountValue)}</Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {bundle.productCount} {t.bundlesPage.products}
        <Text variant="bodySm" tone="subdued" as="p">
          {bundle.requireAll ? t.bundlesPage.mustBuyAll : t.bundlesPage.mixMatch}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <InlineStack gap="200">
          <Button size="slim" onClick={() => navigate(`/app/bundles/${bundle.id}`)}>
            {t.bundlesPage.edit}
          </Button>
          {bundle.status === "DRAFT" && (
            <Button
              size="slim"
              tone="success"
              onClick={() => handleStatusChange(bundle.id, "ACTIVE")}
            >
              {t.bundlesPage.activate}
            </Button>
          )}
          {bundle.status === "ACTIVE" && (
            <Button size="slim" onClick={() => handleStatusChange(bundle.id, "PAUSED")}>
              {t.bundlesPage.pause}
            </Button>
          )}
          <Button size="slim" tone="critical" onClick={() => openDeleteModal({ id: bundle.id, name: bundle.name })}>
            {t.bundlesPage.delete}
          </Button>
        </InlineStack>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title={t.bundlesPage.title}
      subtitle={t.bundlesPage.subtitle}
      backAction={{ content: t.bundlesPage.backToHome, url: "/app" }}
      primaryAction={{
        content: t.bundlesPage.createBundle,
        icon: PlusIcon,
        onAction: () => navigate("/app/bundles/new"),
      }}
    >
      <Card padding="0">
        {bundles.length === 0 ? (
          <EmptyState
            heading={t.bundlesPage.createFirstBundle}
            action={{
              content: t.bundlesPage.createBundle,
              onAction: () => navigate("/app/bundles/new"),
            }}
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            <p>
              {t.bundlesPage.emptyStateDesc}
            </p>
          </EmptyState>
        ) : (
          <IndexTable
            resourceName={{ singular: t.bundlesPage.bundle, plural: t.bundlesPage.bundles }}
            itemCount={bundles.length}
            headings={[
              { title: t.bundlesPage.bundle },
              { title: t.bundlesPage.status },
              { title: t.bundlesPage.discount },
              { title: t.bundlesPage.products },
              { title: t.bundlesPage.actions },
            ]}
            selectable={false}
          >
            {rowMarkup}
          </IndexTable>
        )}
      </Card>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        open={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setBundleToDelete(null);
        }}
        onConfirm={handleDelete}
        itemName={bundleToDelete?.name}
        itemType="bundle"
      />
    </Page>
  );
}
