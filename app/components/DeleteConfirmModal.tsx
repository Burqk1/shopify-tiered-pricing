/**
 * DeleteConfirmModal Component
 *
 * Reusable confirmation modal for delete operations.
 * Replaces browser confirm() dialogs with Polaris-styled modals.
 */

import { Modal, Text, BlockStack } from "@shopify/polaris";

interface DeleteConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  itemName?: string;
  itemType?: string;
  loading?: boolean;
  destructive?: boolean;
  confirmText?: string;
  cancelText?: string;
}

export function DeleteConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  itemName,
  itemType = "item",
  loading = false,
  destructive = true,
  confirmText = "Delete",
  cancelText = "Cancel",
}: DeleteConfirmModalProps) {
  const modalTitle = title || `Delete ${itemType}?`;
  const modalMessage = message || (itemName
    ? `Are you sure you want to delete "${itemName}"? This action cannot be undone.`
    : `Are you sure you want to delete this ${itemType}? This action cannot be undone.`
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={modalTitle}
      primaryAction={{
        content: confirmText,
        onAction: onConfirm,
        destructive,
        loading,
      }}
      secondaryActions={[
        {
          content: cancelText,
          onAction: onClose,
          disabled: loading,
        },
      ]}
    >
      <Modal.Section>
        <BlockStack gap="200">
          <Text as="p" variant="bodyMd">
            {modalMessage}
          </Text>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}

interface ArchiveConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  itemName?: string;
  itemType?: string;
  loading?: boolean;
}

export function ArchiveConfirmModal({
  open,
  onClose,
  onConfirm,
  itemName,
  itemType = "item",
  loading = false,
}: ArchiveConfirmModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Archive ${itemType}?`}
      primaryAction={{
        content: "Archive",
        onAction: onConfirm,
        loading,
      }}
      secondaryActions={[
        {
          content: "Cancel",
          onAction: onClose,
          disabled: loading,
        },
      ]}
    >
      <Modal.Section>
        <BlockStack gap="200">
          <Text as="p" variant="bodyMd">
            {itemName
              ? `Are you sure you want to archive "${itemName}"? You can restore it later from the archived items.`
              : `Are you sure you want to archive this ${itemType}? You can restore it later from the archived items.`
            }
          </Text>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
