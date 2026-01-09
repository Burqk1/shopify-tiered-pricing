/**
 * POS Post-Purchase Block
 *
 * Shows volume discount savings after a purchase is completed.
 * Displays on the post-purchase confirmation screen.
 */

import { useState, useEffect } from "react";
import {
  Text,
  Stack,
  Banner,
  POSBlock,
  POSBlockRow,
  useApi,
} from "@shopify/ui-extensions-react/point-of-sale";

export function PostPurchaseBlock() {
  const api = useApi<"pos.purchase.post.block.render">();
  const [totalSavings, setTotalSavings] = useState(0);
  const [loading, setLoading] = useState(true);

  const order = api.order;
  const shop = api.shop;

  useEffect(() => {
    async function fetchOrderDiscounts() {
      if (!order?.id || !shop?.myshopifyDomain) {
        setLoading(false);
        return;
      }

      try {
        // For now, we'll show a simple message about volume discounts
        // In a full implementation, you'd fetch the order details
        // and calculate how much was saved from volume discounts

        // Check if volume discounts were applied by looking at order discounts
        // This is a simplified version - real implementation would query the order
        setTotalSavings(0); // Would be populated from order data
      } catch (err) {
        console.error("Failed to fetch order discounts:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchOrderDiscounts();
  }, [order?.id, shop?.myshopifyDomain]);

  if (loading) {
    return (
      <POSBlock>
        <POSBlockRow>
          <Text color="TextSubdued">Loading...</Text>
        </POSBlockRow>
      </POSBlock>
    );
  }

  // Only show if there were savings
  if (totalSavings <= 0) {
    return null;
  }

  return (
    <POSBlock>
      <Stack direction="vertical">
        <Banner
          title="Volume Discount Applied!"
          variant="confirmation"
          visible
          hideAction
        >
          Customer saved with volume discounts on this order.
        </Banner>
      </Stack>
    </POSBlock>
  );
}

export default PostPurchaseBlock;
