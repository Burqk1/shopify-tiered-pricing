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
import { getShopByDomain, getLocaleSettings } from "~/models/shop.server";
import { getTranslations } from "~/i18n";
import { requireFeatureAccess } from "~/utils/plan-guard.server";
import prisma from "~/db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  // Check if user has access (GROWTH+ plan required)
  await requireFeatureAccess(session.shop, "customerTags");

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

  const localeSettings = await getLocaleSettings(session.shop);
  const locale = localeSettings?.locale || "en";
  const t = getTranslations(locale);

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
    t,
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
  const { customerGroups, pendingApplications, t } = useLoaderData<typeof loader>();
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
          ? `${group.discountValue}% ${t.wholesalePage.off}`
          : `$${group.discountValue} ${t.wholesalePage.off}`}
      </IndexTable.Cell>
      <IndexTable.Cell>
        {group.minOrderValue ? `$${group.minOrderValue}` : t.wholesalePage.none}
      </IndexTable.Cell>
      <IndexTable.Cell>
        {group.netTerms ? `${t.wholesalePage.net} ${group.netTerms}` : t.wholesalePage.standard}
      </IndexTable.Cell>
      <IndexTable.Cell>
        <InlineStack gap="200">
          {group.taxExempt && <Badge tone="info">{t.wholesalePage.taxExempt}</Badge>}
          {group.priceListCount > 0 && (
            <Badge>{`${group.priceListCount} ${t.wholesalePage.customPrices}`}</Badge>
          )}
        </InlineStack>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <InlineStack gap="200">
          <Button size="slim" url={`/app/wholesale/${group.id}`}>
            {t.wholesalePage.edit}
          </Button>
          <Button size="slim" tone="critical" onClick={() => openDeleteModal({ id: group.id, name: group.name })}>
            {t.wholesalePage.delete}
          </Button>
        </InlineStack>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title={t.wholesalePage.title}
      subtitle={t.wholesalePage.subtitle}
      backAction={{ content: t.wholesalePage.home, url: "/app" }}
      primaryAction={{
        content: t.wholesalePage.createCustomerGroup,
        icon: PlusIcon,
        onAction: () => setShowModal(true),
      }}
      secondaryActions={[
        {
          content: `${t.wholesalePage.applications} (${pendingApplications})`,
          url: "/app/wholesale/applications",
        },
      ]}
    >
      <BlockStack gap="500">
        {pendingApplications > 0 && (
          <Banner
            title={`${pendingApplications} ${pendingApplications > 1 ? t.wholesalePage.pendingApplications : t.wholesalePage.pendingApplication}`}
            tone="info"
            action={{
              content: t.wholesalePage.reviewApplications,
              url: "/app/wholesale/applications",
            }}
          >
            <p>{t.wholesalePage.newBusinessesWaiting}</p>
          </Banner>
        )}

        <Layout>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3" tone="subdued">
                  {t.wholesalePage.totalCustomerGroups}
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
                  {t.wholesalePage.pendingApplicationsCount}
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
                  {t.wholesalePage.customPriceLists}
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
              heading={t.wholesalePage.createFirstGroup}
              action={{
                content: t.wholesalePage.createCustomerGroup,
                onAction: () => setShowModal(true),
              }}
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>
                {t.wholesalePage.emptyStateDesc}
              </p>
            </EmptyState>
          ) : (
            <IndexTable
              resourceName={{ singular: t.wholesalePage.group, plural: t.wholesalePage.groups }}
              itemCount={customerGroups.length}
              headings={[
                { title: t.wholesalePage.name },
                { title: t.wholesalePage.tag },
                { title: t.wholesalePage.discount },
                { title: t.wholesalePage.minOrder },
                { title: t.wholesalePage.paymentTerms },
                { title: t.wholesalePage.features },
                { title: t.wholesalePage.actions },
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
                  {t.wholesalePage.howB2BWorks}
                </Text>
                <BlockStack gap="200">
                  <Text as="p">
                    1. {t.wholesalePage.step1}
                  </Text>
                  <Text as="p">
                    2. {t.wholesalePage.step2}
                  </Text>
                  <Text as="p">
                    3. {t.wholesalePage.step3}
                  </Text>
                  <Text as="p">
                    4. {t.wholesalePage.step4}
                  </Text>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd" as="h2">
                  {t.wholesalePage.wholesaleAppForm}
                </Text>
                <Text as="p">
                  {t.wholesalePage.wholesaleAppFormDesc}
                </Text>
                <Button url="/app/wholesale/settings">
                  {t.wholesalePage.configureAppForm}
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
        title={t.wholesalePage.modalTitle}
        primaryAction={{
          content: t.wholesalePage.create,
          onAction: handleCreate,
          loading: isLoading,
        }}
        secondaryActions={[
          {
            content: t.wholesalePage.cancel,
            onAction: () => setShowModal(false),
          },
        ]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField
              label={t.wholesalePage.groupName}
              value={name}
              onChange={setName}
              placeholder={t.wholesalePage.groupNamePlaceholder}
              autoComplete="off"
            />

            <TextField
              label={t.wholesalePage.customerTag}
              value={tag}
              onChange={setTag}
              placeholder={t.wholesalePage.customerTagPlaceholder}
              helpText={t.wholesalePage.customerTagHelp}
              autoComplete="off"
            />

            <Select
              label={t.wholesalePage.discountType}
              options={[
                { label: t.wholesalePage.percentageOff, value: "PERCENTAGE" },
                { label: t.wholesalePage.fixedAmountOff, value: "FIXED_AMOUNT" },
              ]}
              value={discountType}
              onChange={setDiscountType}
            />

            <TextField
              type="number"
              label={discountType === "PERCENTAGE" ? t.wholesalePage.discountPercent : t.wholesalePage.discountAmount}
              value={discountValue}
              onChange={setDiscountValue}
              autoComplete="off"
            />

            <TextField
              type="number"
              label={t.wholesalePage.minOrderValue}
              value={minOrderValue}
              onChange={setMinOrderValue}
              placeholder={t.wholesalePage.optional}
              autoComplete="off"
              helpText={t.wholesalePage.minOrderHelp}
            />

            <Select
              label={t.wholesalePage.paymentTermsLabel}
              options={[
                { label: t.wholesalePage.standardPayNow, value: "" },
                { label: t.wholesalePage.net15, value: "15" },
                { label: t.wholesalePage.net30, value: "30" },
                { label: t.wholesalePage.net45, value: "45" },
                { label: t.wholesalePage.net60, value: "60" },
              ]}
              value={netTerms}
              onChange={setNetTerms}
            />

            <Checkbox
              label={t.wholesalePage.taxExemptLabel}
              checked={taxExempt}
              onChange={setTaxExempt}
              helpText={t.wholesalePage.taxExemptHelp}
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
