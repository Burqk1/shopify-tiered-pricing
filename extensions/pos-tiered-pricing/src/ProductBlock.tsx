/**
 * POS Product Details Block
 *
 * Shows tiered pricing information when viewing product in POS.
 * Staff can see available discounts before adding to cart.
 */

import { useState, useEffect } from "react";
import {
  Text,
  Stack,
  List,
  Banner,
  POSBlock,
  POSBlockRow,
  useApi,
} from "@shopify/ui-extensions-react/point-of-sale";
import type { ListRow } from "@shopify/ui-extensions/point-of-sale";

interface Tier {
  min: number;
  max: number | null;
  valueType: "PERCENTAGE" | "FIXED_AMOUNT";
  value: number;
  message: string | null;
}

interface ProductTiersResponse {
  posEnabled: boolean;
  showTierInfo: boolean;
  products: Record<
    string,
    {
      productId: string;
      ruleName: string | null;
      tiers: Tier[];
    }
  >;
}

export function ProductBlock() {
  const api = useApi<"pos.product-details.block.render">();
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [ruleName, setRuleName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const product = api.product;
  const shop = api.shop;

  useEffect(() => {
    async function fetchTiers() {
      if (!product?.id || !shop?.myshopifyDomain) {
        setLoading(false);
        return;
      }

      try {
        const productGid = `gid://shopify/Product/${product.id}`;
        // App Proxy: /apps/tiered-pricing/* -> /api/*
        const url = `https://${shop.myshopifyDomain}/apps/tiered-pricing/pos-tiers?shop=${shop.myshopifyDomain}&product_id=${encodeURIComponent(productGid)}`;

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data: ProductTiersResponse = await response.json();

        if (!data.posEnabled || !data.showTierInfo) {
          setTiers([]);
          setLoading(false);
          return;
        }

        const productData = data.products[productGid];
        if (productData) {
          setTiers(productData.tiers);
          setRuleName(productData.ruleName);
        }
      } catch (err) {
        console.error("Failed to fetch tiers:", err);
        setError("Failed to load discounts");
      } finally {
        setLoading(false);
      }
    }

    fetchTiers();
  }, [product?.id, shop?.myshopifyDomain]);

  if (loading) {
    return (
      <POSBlock>
        <POSBlockRow>
          <Text color="TextSubdued">Loading discounts...</Text>
        </POSBlockRow>
      </POSBlock>
    );
  }

  if (error) {
    return (
      <POSBlock>
        <Banner title="Error" variant="error" visible hideAction>
          {error}
        </Banner>
      </POSBlock>
    );
  }

  if (tiers.length === 0) {
    return null; // Don't show anything if no tiers
  }

  // Build list data
  const listData: ListRow[] = tiers.map((tier, index) => {
    const quantityText = tier.max
      ? `${tier.min} - ${tier.max} items`
      : `${tier.min}+ items`;

    const discountText =
      tier.valueType === "PERCENTAGE"
        ? `${tier.value}% OFF`
        : `$${tier.value.toFixed(2)} OFF`;

    const isLastTier = index === tiers.length - 1;

    return {
      id: `tier-${index}`,
      leftSide: {
        label: quantityText,
        subtitle: tier.message ? [tier.message] : undefined,
        badges: [
          {
            text: discountText,
            variant: isLastTier ? "success" : "highlight",
          },
        ],
      },
    };
  });

  return (
    <POSBlock>
      <Stack direction="vertical">
        <Banner
          title={ruleName || "Buy More, Save More!"}
          variant="information"
          visible
          hideAction
        >
          Volume discounts available for this product
        </Banner>

        <Text variant="headingSmall">Discount Tiers</Text>

        <List data={listData} imageDisplayStrategy="never" />

        <Text variant="captionRegular" color="TextSubdued">
          Discount applies automatically at checkout
        </Text>
      </Stack>
    </POSBlock>
  );
}

export default ProductBlock;
