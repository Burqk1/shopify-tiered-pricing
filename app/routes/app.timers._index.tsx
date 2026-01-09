/**
 * Countdown Timers List Route
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
} from "@shopify/polaris";
import { useState } from "react";
import { PlusIcon } from "@shopify/polaris-icons";

import { authenticate } from "~/shopify.server";
import { DeleteConfirmModal } from "~/components/DeleteConfirmModal";
import { getShopByDomain, getLocaleSettings } from "~/models/shop.server";
import { getTimersByShop, updateTimerStatus, deleteTimer } from "~/models/timer.server";
import { getTranslations } from "~/i18n";
import { requireFeatureAccess } from "~/utils/plan-guard.server";
import type { RuleStatus } from "@prisma/client";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  // Check if user has access (GROWTH+ plan required for CSS customization features)
  await requireFeatureAccess(session.shop, "cssEditor");

  const shop = await getShopByDomain(session.shop);
  if (!shop) {
    throw new Response("Shop not found", { status: 404 });
  }

  const timers = await getTimersByShop(shop.id);

  const localeSettings = await getLocaleSettings(session.shop);
  const locale = localeSettings?.locale || "en";
  const t = getTranslations(locale);

  return json({
    timers: timers.map((timer) => ({
      id: timer.id,
      name: timer.name,
      status: timer.status,
      endTime: timer.endTime.toISOString(),
      title: timer.title,
      style: timer.style,
      showOn: timer.showOn,
      isExpired: new Date(timer.endTime) < new Date(),
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
      const timerId = formData.get("timerId") as string;
      const status = formData.get("status") as RuleStatus;
      await updateTimerStatus(timerId, status);
      return json({ success: true });
    }
    case "delete": {
      const timerId = formData.get("timerId") as string;
      await deleteTimer(timerId);
      return json({ success: true });
    }
    default:
      return json({ error: "Unknown action" }, { status: 400 });
  }
};

export default function TimersList() {
  const { timers, t } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const submit = useSubmit();

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [timerToDelete, setTimerToDelete] = useState<{ id: string; name: string } | null>(null);

  const handleStatusChange = (timerId: string, status: RuleStatus) => {
    submit({ action: "updateStatus", timerId, status }, { method: "POST" });
  };

  const openDeleteModal = (timer: { id: string; name: string }) => {
    setTimerToDelete(timer);
    setDeleteModalOpen(true);
  };

  const handleDelete = () => {
    if (timerToDelete) {
      submit({ action: "delete", timerId: timerToDelete.id }, { method: "POST" });
      setDeleteModalOpen(false);
      setTimerToDelete(null);
    }
  };

  const getStatusBadge = (status: string, isExpired: boolean) => {
    if (isExpired) {
      return <Badge tone="critical">{t.timersPage.expired}</Badge>;
    }
    const config: Record<string, { tone: "info" | "success" | "warning" | "critical"; label: string }> = {
      DRAFT: { tone: "info", label: t.timersPage.statusDraft },
      ACTIVE: { tone: "success", label: t.timersPage.statusActive },
      PAUSED: { tone: "warning", label: t.timersPage.statusPaused },
      ARCHIVED: { tone: "critical", label: t.timersPage.statusArchived },
    };
    const c = config[status] || config.DRAFT;
    return <Badge tone={c.tone}>{c.label}</Badge>;
  };

  const formatTimeRemaining = (endTime: string) => {
    const end = new Date(endTime);
    const now = new Date();
    const diff = end.getTime() - now.getTime();

    if (diff <= 0) return t.timersPage.expired;

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days}${t.timersPage.daysRemaining} ${hours}${t.timersPage.hoursRemaining} ${t.timersPage.remaining}`;
    if (hours > 0) return `${hours}${t.timersPage.hoursRemaining} ${minutes}${t.timersPage.minutesRemaining} ${t.timersPage.remaining}`;
    return `${minutes}${t.timersPage.minutesRemaining} ${t.timersPage.remaining}`;
  };

  const rowMarkup = timers.map((timer, index) => (
    <IndexTable.Row id={timer.id} key={timer.id} position={index}>
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="semibold" as="span">
          {timer.name}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>{getStatusBadge(timer.status, timer.isExpired)}</IndexTable.Cell>
      <IndexTable.Cell>{timer.title}</IndexTable.Cell>
      <IndexTable.Cell>{formatTimeRemaining(timer.endTime)}</IndexTable.Cell>
      <IndexTable.Cell>{timer.showOn.replace(/_/g, " ")}</IndexTable.Cell>
      <IndexTable.Cell>
        <InlineStack gap="200">
          <Button size="slim" onClick={() => navigate(`/app/timers/${timer.id}`)}>
            {t.timersPage.edit}
          </Button>
          {timer.status === "DRAFT" && !timer.isExpired && (
            <Button
              size="slim"
              tone="success"
              onClick={() => handleStatusChange(timer.id, "ACTIVE")}
            >
              {t.timersPage.activate}
            </Button>
          )}
          {timer.status === "ACTIVE" && (
            <Button size="slim" onClick={() => handleStatusChange(timer.id, "PAUSED")}>
              {t.timersPage.pause}
            </Button>
          )}
          <Button size="slim" tone="critical" onClick={() => openDeleteModal({ id: timer.id, name: timer.name })}>
            {t.timersPage.delete}
          </Button>
        </InlineStack>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title={t.timersPage.title}
      subtitle={t.timersPage.subtitle}
      backAction={{ content: t.timersPage.home, url: "/app" }}
      primaryAction={{
        content: t.timersPage.createTimer,
        icon: PlusIcon,
        onAction: () => navigate("/app/timers/new"),
      }}
    >
      <Card padding="0">
        {timers.length === 0 ? (
          <EmptyState
            heading={t.timersPage.createFirstTimer}
            action={{
              content: t.timersPage.createTimer,
              onAction: () => navigate("/app/timers/new"),
            }}
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            <p>
              {t.timersPage.emptyStateDesc}
            </p>
          </EmptyState>
        ) : (
          <IndexTable
            resourceName={{ singular: t.timersPage.timer, plural: t.timersPage.timers }}
            itemCount={timers.length}
            headings={[
              { title: t.timersPage.name },
              { title: t.timersPage.status },
              { title: t.timersPage.displayTitle },
              { title: t.timersPage.timeLeft },
              { title: t.timersPage.showOn },
              { title: t.timersPage.actions },
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
          setTimerToDelete(null);
        }}
        onConfirm={handleDelete}
        itemName={timerToDelete?.name}
        itemType="timer"
      />
    </Page>
  );
}
