/**
 * Shopify API Type Definitions
 *
 * Type definitions for Shopify Admin API GraphQL responses
 */

// GraphQL Edge/Node pattern
export interface GraphQLEdge<T> {
  node: T;
  cursor?: string;
}

export interface GraphQLConnection<T> {
  edges: GraphQLEdge<T>[];
  pageInfo?: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor?: string;
    endCursor?: string;
  };
}

// Product types
export interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;
  status: "ACTIVE" | "ARCHIVED" | "DRAFT";
  totalInventory?: number;
  priceRangeV2?: {
    minVariantPrice: {
      amount: string;
      currencyCode: string;
    };
    maxVariantPrice: {
      amount: string;
      currencyCode: string;
    };
  };
  featuredImage?: {
    url: string;
    altText?: string;
  };
  variants?: GraphQLConnection<ShopifyVariant>;
}

export interface ShopifyVariant {
  id: string;
  title: string;
  price: string;
  sku?: string;
  inventoryQuantity?: number;
  image?: {
    url: string;
    altText?: string;
  };
}

// Collection types
export interface ShopifyCollection {
  id: string;
  title: string;
  handle: string;
  productsCount?: number;
  image?: {
    url: string;
    altText?: string;
  };
}

// Customer types
export interface ShopifyCustomer {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  displayName: string;
  tags: string[];
  ordersCount?: number;
  totalSpent?: {
    amount: string;
    currencyCode: string;
  };
}

// Order types
export interface ShopifyOrder {
  id: string;
  name: string;
  email?: string;
  createdAt: string;
  totalPriceSet: {
    shopMoney: {
      amount: string;
      currencyCode: string;
    };
  };
  lineItems: GraphQLConnection<ShopifyLineItem>;
  customer?: ShopifyCustomer;
}

export interface ShopifyLineItem {
  id: string;
  title: string;
  quantity: number;
  variant?: ShopifyVariant;
  product?: ShopifyProduct;
  originalTotalSet: {
    shopMoney: {
      amount: string;
      currencyCode: string;
    };
  };
  discountedTotalSet: {
    shopMoney: {
      amount: string;
      currencyCode: string;
    };
  };
}

// Discount types
export interface ShopifyDiscountNode {
  id: string;
  title: string;
  status: "ACTIVE" | "EXPIRED" | "SCHEDULED";
  startsAt: string;
  endsAt?: string;
}

export interface ShopifyDiscountAutomaticApp {
  title?: string;
  status?: "ACTIVE" | "EXPIRED" | "SCHEDULED";
}

export interface ShopifyDiscountNodeWithApp {
  id: string;
  discount?: ShopifyDiscountAutomaticApp;
}

// Metaobject types
export interface ShopifyMetaobject {
  id: string;
  handle: string;
  type: string;
  fields: {
    key: string;
    value: string;
  }[];
}

// API Response wrappers
export interface ProductsQueryResponse {
  data?: {
    products: GraphQLConnection<ShopifyProduct>;
  };
  errors?: GraphQLError[];
}

export interface CollectionsQueryResponse {
  data?: {
    collections: GraphQLConnection<ShopifyCollection>;
  };
  errors?: GraphQLError[];
}

export interface GraphQLError {
  message: string;
  locations?: { line: number; column: number }[];
  path?: string[];
  extensions?: Record<string, unknown>;
}

// Helper type for tier values
export type TierValueType = string | number | boolean | null | undefined;
