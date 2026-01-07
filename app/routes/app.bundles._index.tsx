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
import { getShopByDomain } from "~/models/shop.server";
import { getBundlesByShop, updateBundleStatus, deleteBundle } from "~/models/bundle.server";
import type { RuleStatus } from "@prisma/client";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const shop = await getShopByDomain(session.shop);
  if (!shop) {
    throw new Response("Shop not found", { status: 404 });
  }

  const bundles = await getBundlesByShop(shop.id);

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
  const { bundles } = useLoaderData<typeof loader>();
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
      DRAFT: { tone: "info", label: "Draft" },
      ACTIVE: { tone: "success", label: "Active" },
      PAUSED: { tone: "warning", label: "Paused" },
      ARCHIVED: { tone: "critical", label: "Archived" },
    };
    const c = config[status] || config.DRAFT;
    return <Badge tone={c.tone}>{c.label}</Badge>;
  };

  const formatDiscount = (type: string, value: number) => {
    return type === "PERCENTAGE" ? `${value}% off` : `$${value} off`;
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
        {bundle.productCount} products
        <Text variant="bodySm" tone="subdued" as="p">
          {bundle.requireAll ? "Must buy all" : "Mix & match"}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <InlineStack gap="200">
          <Button size="slim" onClick={() => navigate(`/app/bundles/${bundle.id}`)}>
            Edit
          </Button>
          {bundle.status === "DRAFT" && (
            <Button
              size="slim"
              tone="success"
              onClick={() => handleStatusChange(bundle.id, "ACTIVE")}
            >
              Activate
            </Button>
          )}
          {bundle.status === "ACTIVE" && (
            <Button size="slim" onClick={() => handleStatusChange(bundle.id, "PAUSED")}>
              Pause
            </Button>
          )}
          <Button size="slim" tone="critical" onClick={() => openDeleteModal({ id: bundle.id, name: bundle.name })}>
            Delete
          </Button>
        </InlineStack>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title="Bundle Discounts"
      subtitle="Create product bundles with special discounts"
      backAction={{ content: "Home", url: "/app" }}
      primaryAction={{
        content: "Create Bundle",
        icon: PlusIcon,
        onAction: () => navigate("/app/bundles/new"),
      }}
    >
      <Card padding="0">
        {bundles.length === 0 ? (
          <EmptyState
            heading="Create your first product bundle"
            action={{
              content: "Create Bundle",
              onAction: () => navigate("/app/bundles/new"),
            }}
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            <p>
              Bundle products together and offer a special discount. "Buy shirt
              + pants + belt, get 25% off!"
            </p>
          </EmptyState>
        ) : (
          <IndexTable
            resourceName={{ singular: "bundle", plural: "bundles" }}
            itemCount={bundles.length}
            headings={[
              { title: "Bundle" },
              { title: "Status" },
              { title: "Discount" },
              { title: "Products" },
              { title: "Actions" },
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
