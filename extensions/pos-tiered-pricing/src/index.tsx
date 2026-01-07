/**
 * POS UI Extension Entry Point
 *
 * Registers the extension blocks for Shopify POS.
 */

import { reactExtension } from "@shopify/ui-extensions-react/point-of-sale";
import { ProductBlock } from "./ProductBlock";
import { PostPurchaseBlock } from "./PostPurchaseBlock";

// Register Product Details Block - shows tier info when viewing a product
export const productDetailsBlock = reactExtension(
  "pos.product-details.block.render",
  () => <ProductBlock />
);

// Register Post-Purchase Block - shows savings after checkout
export const postPurchaseBlock = reactExtension(
  "pos.purchase.post.block.render",
  () => <PostPurchaseBlock />
);
