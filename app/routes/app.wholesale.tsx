/**
 * B2B/Wholesale Management Route
 * Manage customer groups and wholesale pricing
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Badge,
  IndexTable,
  EmptyState,
  Modal,
  FormLayout,
  TextField,
  Select,
  Checkbox,
  Banner,
} from "@shopify/polaris";
import { PlusIcon } from "@shopify/polaris-icons";
import { useState, useCallback } from "react";

import { authenticate } from "~/shopify.server";
import { DeleteConfirmModal } from "~/components/DeleteConfirmModal";
import { getShopByDomain } from "~/models/shop.server";
import prisma from "~/db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const shop = await getShopByDomain(session.shop);
  if (!shop) {
    throw new Response("Shop not found", { status: 404 });
  }

  const customerGroups = await prisma.customerGroup.findMany({
    where: { shopId: shop.id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { priceLists: true },
      },
    },
  });

  const pendingApplications = await prisma.wholesaleApplication.count({
    where: { shopId: shop.id, status: "PENDING" },
  });

  return json({
    customerGroups: customerGroups.map((g) => ({
      id: g.id,
      name: g.name,
      tag: g.tag,
      discountType: g.discountType,
      discountValue: Number(g.discountValue),
      minOrderValue: g.minOrderValue ? Number(g.minOrderValue) : null,
      taxExempt: g.taxExempt,
      netTerms: g.netTerms,
      priceListCount: g._count.priceLists,
    })),
    pendingApplications,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("_action");

  const shop = await getShopByDomain(session.shop);
  if (!shop) {
    return json({ error: "Shop not found" }, { status: 404 });
  }

  if (actionType === "create") {
    const name = formData.get("name") as string;
    const tag = formData.get("tag") as string;
    const discountType = formData.get("discountType") as "PERCENTAGE" | "FIXED_AMOUNT";
    const discountValue = parseFloat(formData.get("discountValue") as string) || 0;
    const minOrderValue = formData.get("minOrderValue") ? parseFloat(formData.get("minOrderValue") as string) : null;
    const taxExempt = formData.get("taxExempt") === "true";
    const netTerms = formData.get("netTerms") ? parseInt(formData.get("netTerms") as string) : null;

    if (!name || !tag) {
      return json({ error: "Name and tag are required" }, { status: 400 });
    }

    await prisma.customerGroup.create({
      data: {
        shopId: shop.id,
        name,
        tag: tag.toLowerCase().replace(/\s+/g, "-"),
        discountType,
        discountValue,
        minOrderValue,
        taxExempt,
        netTerms,
      },
    });

    return json({ success: true });
  }

  if (actionType === "delete") {
    const groupId = formData.get("groupId") as string;
    await prisma.customerGroup.delete({ where: { id: groupId } });
    return json({ success: true });
  }

  return json({ error: "Unknown action" }, { status: 400 });
};

export default function Wholesale() {
  const { customerGroups, pendingApplications } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();

  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [discountType, setDiscountType] = useState("PERCENTAGE");
  const [discountValue, setDiscountValue] = useState("10");
  const [minOrderValue, setMinOrderValue] = useState("");
  const [taxExempt, setTaxExempt] = useState(false);
  const [netTerms, setNetTerms] = useState("");

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<{ id: string; name: string } | null>(null);

  const isLoading = navigation.state === "submitting";

  const handleCreate = useCallback(() => {
    const formData = new FormData();
    formData.append("_action", "create");
    formData.append("name", name);
    formData.append("tag", tag);
    formData.append("discountType", discountType);
    formData.append("discountValue", discountValue);
    if (minOrderValue) formData.append("minOrderValue", minOrderValue);
    formData.append("taxExempt", taxExempt.toString());
    if (netTerms) formData.append("netTerms", netTerms);

    submit(formData, { method: "POST" });
    setShowModal(false);
    resetForm();
  }, [name, tag, discountType, discountValue, minOrderValue, taxExempt, netTerms, submit]);

  const openDeleteModal = (group: { id: string; name: string }) => {
    setGroupToDelete(group);
    setDeleteModalOpen(true);
  };

  const handleDelete = () => {
    if (groupToDelete) {
      const formData = new FormData();
      formData.append("_action", "delete");
      formData.append("groupId", groupToDelete.id);
      submit(formData, { method: "POST" });
      setDeleteModalOpen(false);
      setGroupToDelete(null);
    }
  };

  const resetForm = () => {
    setName("");
    setTag("");
    setDiscountType("PERCENTAGE");
    setDiscountValue("10");
    setMinOrderValue("");
    setTaxExempt(false);
    setNetTerms("");
  };

  const rowMarkup = customerGroups.map((group, index) => (
    <IndexTable.Row id={group.id} key={group.id} position={index}>
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="semibold" as="span">
          {group.name}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge>{group.tag}</Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {group.discountType === "PERCENTAGE"
          ? `${group.discountValue}% off`
          : `$${group.discountValue} off`}
      </IndexTable.Cell>
      <IndexTable.Cell>
        {group.minOrderValue ? `$${group.minOrderValue}` : "None"}
      </IndexTable.Cell>
      <IndexTable.Cell>
        {group.netTerms ? `Net ${group.netTerms}` : "Standard"}
      </IndexTable.Cell>
      <IndexTable.Cell>
        <InlineStack gap="200">
          {group.taxExempt && <Badge tone="info">Tax Exempt</Badge>}
          {group.priceListCount > 0 && (
            <Badge>{`${group.priceListCount} custom prices`}</Badge>
          )}
        </InlineStack>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <InlineStack gap="200">
          <Button size="slim" url={`/app/wholesale/${group.id}`}>
            Edit
          </Button>
          <Button size="slim" tone="critical" onClick={() => openDeleteModal({ id: group.id, name: group.name })}>
            Delete
          </Button>
        </InlineStack>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title="B2B & Wholesale"
      subtitle="Manage customer groups and wholesale pricing"
      backAction={{ content: "Home", url: "/app" }}
      primaryAction={{
        content: "Create Customer Group",
        icon: PlusIcon,
        onAction: () => setShowModal(true),
      }}
      secondaryActions={[
        {
          content: `Applications (${pendingApplications})`,
          url: "/app/wholesale/applications",
        },
      ]}
    >
      <BlockStack gap="500">
        {pendingApplications > 0 && (
          <Banner
            title={`${pendingApplications} pending wholesale application${pendingApplications > 1 ? "s" : ""}`}
            tone="info"
            action={{
              content: "Review Applications",
              url: "/app/wholesale/applications",
            }}
          >
            <p>New businesses are waiting to join your wholesale program.</p>
          </Banner>
        )}

        <Layout>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3" tone="subdued">
                  Total Customer Groups
                </Text>
                <Text variant="heading2xl" as="p">
                  {customerGroups.length}
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3" tone="subdued">
                  Pending Applications
                </Text>
                <Text variant="heading2xl" as="p">
                  {pendingApplications}
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3" tone="subdued">
                  Custom Price Lists
                </Text>
                <Text variant="heading2xl" as="p">
                  {customerGroups.reduce((sum, g) => sum + g.priceListCount, 0)}
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        <Card padding="0">
          {customerGroups.length === 0 ? (
            <EmptyState
              heading="Create your first customer group"
              action={{
                content: "Create Customer Group",
                onAction: () => setShowModal(true),
              }}
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>
                Customer groups allow you to offer special pricing to wholesale
                buyers, VIP customers, or any segment you define.
              </p>
            </EmptyState>
          ) : (
            <IndexTable
              resourceName={{ singular: "group", plural: "groups" }}
              itemCount={customerGroups.length}
              headings={[
                { title: "Name" },
                { title: "Tag" },
                { title: "Discount" },
                { title: "Min Order" },
                { title: "Payment Terms" },
                { title: "Features" },
                { title: "Actions" },
              ]}
              selectable={false}
            >
              {rowMarkup}
            </IndexTable>
          )}
        </Card>

        {/* Info Cards */}
        <Layout>
          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd" as="h2">
                  How B2B Pricing Works
                </Text>
                <BlockStack gap="200">
                  <Text as="p">
                    1. Create a customer group with a Shopify customer tag
                  </Text>
                  <Text as="p">
                    2. Set the default discount for that group
                  </Text>
                  <Text as="p">
                    3. Optionally add custom prices for specific products
                  </Text>
                  <Text as="p">
                    4. Tag customers in Shopify to add them to the group
                  </Text>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd" as="h2">
                  Wholesale Application Form
                </Text>
                <Text as="p">
                  Let potential wholesale customers apply through a form on your
                  store. Review and approve applications to automatically tag
                  customers.
                </Text>
                <Button url="/app/wholesale/settings">
                  Configure Application Form
                </Button>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>

      {/* Create Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Create Customer Group"
        primaryAction={{
          content: "Create",
          onAction: handleCreate,
          loading: isLoading,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => setShowModal(false),
          },
        ]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField
              label="Group Name"
              value={name}
              onChange={setName}
              placeholder="e.g., Wholesale, VIP, Gold Members"
              autoComplete="off"
            />

            <TextField
              label="Customer Tag"
              value={tag}
              onChange={setTag}
              placeholder="e.g., wholesale"
              helpText="Customers with this tag will receive group pricing"
              autoComplete="off"
            />

            <Select
              label="Discount Type"
              options={[
                { label: "Percentage Off", value: "PERCENTAGE" },
                { label: "Fixed Amount Off", value: "FIXED_AMOUNT" },
              ]}
              value={discountType}
              onChange={setDiscountType}
            />

            <TextField
              type="number"
              label={discountType === "PERCENTAGE" ? "Discount (%)" : "Discount Amount ($)"}
              value={discountValue}
              onChange={setDiscountValue}
              autoComplete="off"
            />

            <TextField
              type="number"
              label="Minimum Order Value ($)"
              value={minOrderValue}
              onChange={setMinOrderValue}
              placeholder="Optional"
              autoComplete="off"
              helpText="Require minimum order value to qualify for group pricing"
            />

            <Select
              label="Payment Terms"
              options={[
                { label: "Standard (Pay Now)", value: "" },
                { label: "Net 15", value: "15" },
                { label: "Net 30", value: "30" },
                { label: "Net 45", value: "45" },
                { label: "Net 60", value: "60" },
              ]}
              value={netTerms}
              onChange={setNetTerms}
            />

            <Checkbox
              label="Tax Exempt"
              checked={taxExempt}
              onChange={setTaxExempt}
              helpText="Orders from this group will be tax exempt"
            />
          </FormLayout>
        </Modal.Section>
      </Modal>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        open={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setGroupToDelete(null);
        }}
        onConfirm={handleDelete}
        itemName={groupToDelete?.name}
        itemType="customer group"
      />
    </Page>
  );
}
