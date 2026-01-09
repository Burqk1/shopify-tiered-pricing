# API Reference

Complete API documentation for Tiered Pricing Pro.

{% hint style="info" %}
**Plan Required:** PROFESSIONAL
{% endhint %}

## Authentication

All API requests require an API key:

```bash
Authorization: Bearer YOUR_API_KEY
```

### Getting Your API Key

1. Go to **Settings > Developer**
2. Click **Generate API Key**
3. Copy and store securely

{% hint style="warning" %}
Keep your API key secret. Regenerate if compromised.
{% endhint %}

## Base URL

```
https://api.tieredpricing.app/v1
```

## Request Format

```bash
curl -X METHOD https://api.tieredpricing.app/v1/endpoint \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"key": "value"}'
```

## Response Format

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2026-01-15T10:30:00Z"
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": { ... }
  },
  "meta": {
    "requestId": "req_abc123"
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Invalid or missing API key |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `RATE_LIMITED` | 429 | Too many requests |
| `SERVER_ERROR` | 500 | Internal server error |

---

## Pricing Rules

### List Rules

Get all pricing rules.

```
GET /rules
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status (active, paused, draft) |
| `page` | integer | Page number (default: 1) |
| `limit` | integer | Results per page (default: 20, max: 100) |
| `sort` | string | Sort field (created, updated, priority) |
| `order` | string | Sort order (asc, desc) |

**Response:**

```json
{
  "success": true,
  "data": {
    "rules": [
      {
        "id": "rule_abc123",
        "name": "Buy More Save More",
        "status": "active",
        "priority": 10,
        "conditions": [...],
        "tiers": [...],
        "createdAt": "2026-01-01T00:00:00Z",
        "updatedAt": "2026-01-15T10:30:00Z"
      }
    ]
  },
  "meta": {
    "total": 25,
    "page": 1,
    "pageSize": 20,
    "totalPages": 2
  }
}
```

### Get Rule

Get a single pricing rule.

```
GET /rules/:id
```

**Response:**

```json
{
  "success": true,
  "data": {
    "rule": {
      "id": "rule_abc123",
      "name": "Buy More Save More",
      "status": "active",
      "priority": 10,
      "conditions": [
        {
          "type": "product",
          "operator": "in",
          "value": ["prod_123", "prod_456"]
        }
      ],
      "tiers": [
        {
          "minQuantity": 2,
          "maxQuantity": 4,
          "discountType": "percentage",
          "discountValue": 10
        },
        {
          "minQuantity": 5,
          "maxQuantity": 9,
          "discountType": "percentage",
          "discountValue": 15
        },
        {
          "minQuantity": 10,
          "discountType": "percentage",
          "discountValue": 20
        }
      ],
      "settings": {
        "stackWithCodes": false,
        "showOnProductPage": true,
        "channels": ["online", "pos"]
      },
      "analytics": {
        "views": 1234,
        "applications": 567,
        "revenue": 12345.67
      },
      "createdAt": "2026-01-01T00:00:00Z",
      "updatedAt": "2026-01-15T10:30:00Z"
    }
  }
}
```

### Create Rule

Create a new pricing rule.

```
POST /rules
```

**Request Body:**

```json
{
  "name": "Summer Sale",
  "status": "draft",
  "priority": 20,
  "conditions": [
    {
      "type": "collection",
      "operator": "in",
      "value": ["summer-collection"]
    }
  ],
  "tiers": [
    {
      "minQuantity": 2,
      "discountType": "percentage",
      "discountValue": 15
    }
  ],
  "settings": {
    "stackWithCodes": true,
    "startDate": "2026-06-01T00:00:00Z",
    "endDate": "2026-08-31T23:59:59Z"
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "rule": {
      "id": "rule_xyz789",
      ...
    }
  }
}
```

### Update Rule

Update an existing rule.

```
PUT /rules/:id
```

**Request Body:**

```json
{
  "name": "Updated Name",
  "status": "active",
  "tiers": [...]
}
```

### Delete Rule

Delete a pricing rule.

```
DELETE /rules/:id
```

**Response:**

```json
{
  "success": true,
  "data": {
    "deleted": true
  }
}
```

### Clone Rule

Create a copy of an existing rule.

```
POST /rules/:id/clone
```

**Request Body:**

```json
{
  "name": "Copy of Summer Sale"
}
```

### Activate/Pause Rule

Change rule status.

```
POST /rules/:id/activate
POST /rules/:id/pause
```

---

## BOGO Offers

### List BOGO Offers

```
GET /bogo
```

### Create BOGO Offer

```
POST /bogo
```

**Request Body:**

```json
{
  "name": "Buy 2 Get 1 Free",
  "type": "buy_x_get_y",
  "buyQuantity": 2,
  "getQuantity": 1,
  "getDiscount": 100,
  "products": ["prod_123"],
  "status": "active"
}
```

### Update BOGO Offer

```
PUT /bogo/:id
```

### Delete BOGO Offer

```
DELETE /bogo/:id
```

---

## Bundles

### List Bundles

```
GET /bundles
```

### Create Bundle

```
POST /bundles
```

**Request Body:**

```json
{
  "name": "Starter Kit",
  "products": [
    {"productId": "prod_123", "quantity": 1},
    {"productId": "prod_456", "quantity": 2}
  ],
  "discountType": "percentage",
  "discountValue": 20,
  "status": "active"
}
```

---

## Analytics

### Overview

Get dashboard analytics.

```
GET /analytics/overview
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `startDate` | string | Start date (ISO 8601) |
| `endDate` | string | End date (ISO 8601) |
| `granularity` | string | day, week, month |

**Response:**

```json
{
  "success": true,
  "data": {
    "summary": {
      "totalRevenue": 124567.89,
      "totalOrders": 1234,
      "avgOrderValue": 101.02,
      "totalSavings": 18234.56
    },
    "trends": [
      {
        "date": "2026-01-01",
        "revenue": 4234.56,
        "orders": 42
      }
    ],
    "topRules": [
      {
        "ruleId": "rule_abc123",
        "name": "Buy More Save More",
        "revenue": 45678.90,
        "applications": 567
      }
    ]
  }
}
```

### Rule Analytics

Get analytics for specific rule.

```
GET /analytics/rules/:ruleId
```

**Response:**

```json
{
  "success": true,
  "data": {
    "rule": {
      "id": "rule_abc123",
      "name": "Buy More Save More"
    },
    "metrics": {
      "views": 15234,
      "applications": 847,
      "conversionRate": 5.56,
      "revenue": 42350.00,
      "avgDiscount": 12.5
    },
    "tierBreakdown": [
      {"tier": 1, "applications": 456, "percentage": 54},
      {"tier": 2, "applications": 289, "percentage": 34},
      {"tier": 3, "applications": 102, "percentage": 12}
    ],
    "timeline": [...]
  }
}
```

### Export Analytics

Export analytics data.

```
GET /analytics/export
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `format` | string | csv, json, xlsx |
| `startDate` | string | Start date |
| `endDate` | string | End date |
| `type` | string | overview, rules, orders |

---

## Settings

### Get Settings

```
GET /settings
```

**Response:**

```json
{
  "success": true,
  "data": {
    "settings": {
      "currency": "USD",
      "locale": "en-US",
      "roundingMode": "nearest",
      "stackingBehavior": "best_price",
      "showPricingTable": true,
      "tablePosition": "below_price",
      "notifications": {
        "email": true,
        "weeklyReport": true
      }
    }
  }
}
```

### Update Settings

```
PUT /settings
```

**Request Body:**

```json
{
  "stackingBehavior": "allow_both",
  "showPricingTable": false
}
```

---

## Webhooks

### List Webhooks

```
GET /webhooks
```

### Create Webhook

```
POST /webhooks
```

**Request Body:**

```json
{
  "url": "https://your-server.com/webhook",
  "events": ["rule.created", "rule.updated", "discount.applied"],
  "secret": "your_webhook_secret"
}
```

### Update Webhook

```
PUT /webhooks/:id
```

### Delete Webhook

```
DELETE /webhooks/:id
```

### Test Webhook

Send a test event to webhook.

```
POST /webhooks/:id/test
```

---

## Import/Export

### Export Data

Export all configuration.

```
GET /export
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `format` | string | json, csv |
| `include` | string | rules, bogo, bundles, settings, all |

### Import Data

Import configuration.

```
POST /import
```

**Request Body:**

```json
{
  "data": { ... },
  "options": {
    "conflictResolution": "overwrite",
    "validateOnly": false
  }
}
```

---

## Calculate Discount

Test discount calculation without saving.

```
POST /calculate
```

**Request Body:**

```json
{
  "cart": {
    "lines": [
      {
        "productId": "prod_123",
        "variantId": "var_456",
        "quantity": 5,
        "price": 2999
      }
    ],
    "customer": {
      "tags": ["wholesale"]
    }
  },
  "ruleId": "rule_abc123"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "discount": {
      "applicable": true,
      "rule": {
        "id": "rule_abc123",
        "name": "Wholesale Discount"
      },
      "tier": {
        "minQuantity": 5,
        "discountType": "percentage",
        "discountValue": 20
      },
      "lineDiscounts": [
        {
          "lineId": "line_1",
          "originalPrice": 14995,
          "discountedPrice": 11996,
          "savings": 2999
        }
      ],
      "totalSavings": 2999
    }
  }
}
```

---

## Rate Limits

| Endpoint Category | Limit |
|-------------------|-------|
| Read operations | 100/minute |
| Write operations | 30/minute |
| Analytics | 20/minute |
| Import/Export | 5/minute |

### Rate Limit Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642248600
```

### Handling Rate Limits

When rate limited:
- Response status: 429
- Wait until `X-RateLimit-Reset`
- Implement exponential backoff

---

## Pagination

List endpoints support pagination:

```
GET /rules?page=2&limit=50
```

Response includes meta:
```json
{
  "meta": {
    "total": 125,
    "page": 2,
    "pageSize": 50,
    "totalPages": 3
  }
}
```

---

## Filtering

Use query parameters to filter:

```
GET /rules?status=active&sort=priority&order=desc
```

---

## SDK Libraries

Official SDKs:

- **JavaScript/Node.js**: `npm install @tieredpricing/sdk`
- **PHP**: `composer require tieredpricing/sdk`
- **Python**: `pip install tieredpricing`

### JavaScript Example

```javascript
import TieredPricing from '@tieredpricing/sdk';

const client = new TieredPricing({
  apiKey: 'YOUR_API_KEY'
});

// List rules
const rules = await client.rules.list({ status: 'active' });

// Create rule
const newRule = await client.rules.create({
  name: 'New Rule',
  tiers: [...]
});

// Calculate discount
const discount = await client.calculate({
  cart: {...}
});
```

---

{% content-ref url="overview.md" %}
[overview.md](overview.md)
{% endcontent-ref %}

{% content-ref url="webhooks.md" %}
[webhooks.md](webhooks.md)
{% endcontent-ref %}
