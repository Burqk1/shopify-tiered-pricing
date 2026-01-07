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
import { getShopByDomain } from "~/models/shop.server";
import { getTimersByShop, updateTimerStatus, deleteTimer } from "~/models/timer.server";
import type { RuleStatus } from "@prisma/client";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const shop = await getShopByDomain(session.shop);
  if (!shop) {
    throw new Response("Shop not found", { status: 404 });
  }

  const timers = await getTimersByShop(shop.id);

  return json({
    timers: timers.map((t) => ({
      id: t.id,
      name: t.name,
      status: t.status,
      endTime: t.endTime.toISOString(),
      title: t.title,
      style: t.style,
      showOn: t.showOn,
      isExpired: new Date(t.endTime) < new Date(),
    })),
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
  const { timers } = useLoaderData<typeof loader>();
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
      return <Badge tone="critical">Expired</Badge>;
    }
    const config: Record<string, { tone: "info" | "success" | "warning" | "critical"; label: string }> = {
      DRAFT: { tone: "info", label: "Draft" },
      ACTIVE: { tone: "success", label: "Active" },
      PAUSED: { tone: "warning", label: "Paused" },
      ARCHIVED: { tone: "critical", label: "Archived" },
    };
    const c = config[status] || config.DRAFT;
    return <Badge tone={c.tone}>{c.label}</Badge>;
  };

  const formatTimeRemaining = (endTime: string) => {
    const end = new Date(endTime);
    const now = new Date();
    const diff = end.getTime() - now.getTime();

    if (diff <= 0) return "Expired";

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days}d ${hours}h remaining`;
    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    return `${minutes}m remaining`;
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
            Edit
          </Button>
          {timer.status === "DRAFT" && !timer.isExpired && (
            <Button
              size="slim"
              tone="success"
              onClick={() => handleStatusChange(timer.id, "ACTIVE")}
            >
              Activate
            </Button>
          )}
          {timer.status === "ACTIVE" && (
            <Button size="slim" onClick={() => handleStatusChange(timer.id, "PAUSED")}>
              Pause
            </Button>
          )}
          <Button size="slim" tone="critical" onClick={() => openDeleteModal({ id: timer.id, name: timer.name })}>
            Delete
          </Button>
        </InlineStack>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title="Countdown Timers"
      subtitle="Create urgency with time-limited discount timers"
      backAction={{ content: "Home", url: "/app" }}
      primaryAction={{
        content: "Create Timer",
        icon: PlusIcon,
        onAction: () => navigate("/app/timers/new"),
      }}
    >
      <Card padding="0">
        {timers.length === 0 ? (
          <EmptyState
            heading="Create your first countdown timer"
            action={{
              content: "Create Timer",
              onAction: () => navigate("/app/timers/new"),
            }}
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            <p>
              Add urgency to your sales with countdown timers. Display "Sale
              ends in X hours" to boost conversions.
            </p>
          </EmptyState>
        ) : (
          <IndexTable
            resourceName={{ singular: "timer", plural: "timers" }}
            itemCount={timers.length}
            headings={[
              { title: "Name" },
              { title: "Status" },
              { title: "Display Title" },
              { title: "Time Left" },
              { title: "Show On" },
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
          setTimerToDelete(null);
        }}
        onConfirm={handleDelete}
        itemName={timerToDelete?.name}
        itemType="timer"
      />
    </Page>
  );
}
