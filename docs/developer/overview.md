# Developer Guide

Welcome to the Tiered Pricing Pro developer documentation. This guide covers the technical implementation, APIs, and extension points for developers.

{% hint style="info" %}
**Plan Required:** PROFESSIONAL (for API access)
{% endhint %}

## Architecture Overview

Tiered Pricing Pro is built on modern Shopify app architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                     Shopify Store                           │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Storefront  │  │   Checkout   │  │     POS      │      │
│  │  Extensions  │  │  Extensions  │  │ Integration  │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │               │
│         └────────────┬────┴────────────────┘               │
│                      │                                      │
│         ┌────────────▼────────────┐                        │
│         │   Shopify Functions     │                        │
│         │   (Discount Engine)     │                        │
│         └────────────┬────────────┘                        │
└──────────────────────┼──────────────────────────────────────┘
                       │
         ┌─────────────▼─────────────┐
         │    Tiered Pricing Pro     │
         │    ┌─────────────────┐    │
         │    │    Remix App    │    │
         │    │  (Admin Panel)  │    │
         │    └────────┬────────┘    │
         │             │             │
         │    ┌────────▼────────┐    │
         │    │   PostgreSQL    │    │
         │    │   (Prisma ORM)  │    │
         │    └─────────────────┘    │
         └───────────────────────────┘
```

## Technology Stack

### Backend
- **Remix**: Full-stack React framework
- **Prisma**: Database ORM
- **PostgreSQL**: Primary database
- **TypeScript**: Type-safe development

### Frontend
- **React**: UI library
- **Shopify Polaris**: Design system
- **TailwindCSS**: Utility styling

### Shopify Integration
- **Shopify App Bridge**: Admin embedding
- **Shopify Functions**: Discount calculations
- **Theme App Extensions**: Storefront widgets
- **Shopify GraphQL API**: Data access

## Key Components

### 1. Pricing Rules Engine

The core logic for calculating discounts:

```typescript
// Simplified rule evaluation
interface PricingRule {
  id: string;
  conditions: Condition[];
  tiers: DiscountTier[];
  priority: number;
}

interface DiscountTier {
  minQuantity: number;
  maxQuantity?: number;
  discountType: 'percentage' | 'fixed_amount' | 'fixed_price';
  discountValue: number;
}

function evaluateRule(rule: PricingRule, cart: Cart): Discount | null {
  // Check all conditions
  if (!rule.conditions.every(c => evaluateCondition(c, cart))) {
    return null;
  }

  // Find applicable tier
  const tier = findApplicableTier(rule.tiers, cart.quantity);
  if (!tier) return null;

  // Calculate discount
  return calculateDiscount(tier, cart);
}
```

### 2. Shopify Functions

Discount calculations run in Shopify Functions for performance:

```javascript
// extensions/discount-function/src/index.js
export function run(input) {
  const discounts = [];

  for (const line of input.cart.lines) {
    const discount = calculateLineDiscount(line, input.configuration);
    if (discount) {
      discounts.push(discount);
    }
  }

  return { discounts };
}
```

### 3. Theme Extensions

Storefront widgets via Theme App Extensions:

```liquid
<!-- extensions/pricing-table/blocks/pricing-table.liquid -->
{% schema %}
{
  "name": "Pricing Table",
  "target": "section",
  "settings": [
    {
      "type": "select",
      "id": "style",
      "label": "Table Style",
      "options": [...]
    }
  ]
}
{% endschema %}

<div class="tiered-pricing-table" data-product-id="{{ product.id }}">
  <!-- Table rendered by JavaScript -->
</div>

{% javascript %}
  TieredPricing.renderTable({{ product.id }});
{% endjavascript %}
```

## Database Schema

### Core Models

```prisma
// prisma/schema.prisma

model Shop {
  id        String   @id
  domain    String   @unique
  settings  Json
  plan      Plan     @default(FREE)
  rules     PricingRule[]
  createdAt DateTime @default(now())
}

model PricingRule {
  id          String   @id @default(uuid())
  shopId      String
  shop        Shop     @relation(fields: [shopId])
  name        String
  status      Status   @default(DRAFT)
  priority    Int      @default(0)
  conditions  Json
  tiers       Json
  settings    Json
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Analytics {
  id        String   @id @default(uuid())
  shopId    String
  ruleId    String?
  event     String
  data      Json
  timestamp DateTime @default(now())
}

enum Plan {
  FREE
  GROWTH
  PROFESSIONAL
}

enum Status {
  DRAFT
  ACTIVE
  PAUSED
  ARCHIVED
}
```

## API Reference

### REST API Endpoints

#### Rules

```
GET    /api/rules           - List all rules
POST   /api/rules           - Create rule
GET    /api/rules/:id       - Get rule
PUT    /api/rules/:id       - Update rule
DELETE /api/rules/:id       - Delete rule
POST   /api/rules/:id/clone - Clone rule
```

#### Analytics

```
GET    /api/analytics/overview     - Dashboard stats
GET    /api/analytics/rules/:id    - Rule performance
GET    /api/analytics/export       - Export data
```

#### Settings

```
GET    /api/settings        - Get shop settings
PUT    /api/settings        - Update settings
```

### Authentication

API requests require authentication:

```bash
curl -X GET https://api.tieredpricing.app/v1/rules \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json"
```

### Response Format

```json
{
  "success": true,
  "data": {
    "rules": [...]
  },
  "meta": {
    "total": 25,
    "page": 1,
    "pageSize": 10
  }
}
```

### Error Handling

```json
{
  "success": false,
  "error": {
    "code": "RULE_NOT_FOUND",
    "message": "Rule with ID abc123 not found",
    "details": {}
  }
}
```

## Webhooks

Subscribe to events:

### Available Events

| Event | Description |
|-------|-------------|
| `rule.created` | New rule created |
| `rule.updated` | Rule modified |
| `rule.deleted` | Rule removed |
| `rule.activated` | Rule status → active |
| `discount.applied` | Discount used in order |
| `test.completed` | A/B test finished |

### Webhook Payload

```json
{
  "event": "rule.created",
  "timestamp": "2026-01-15T10:30:00Z",
  "shop": "your-store.myshopify.com",
  "data": {
    "rule": {
      "id": "abc123",
      "name": "Volume Discount",
      ...
    }
  }
}
```

### Registering Webhooks

```bash
curl -X POST https://api.tieredpricing.app/v1/webhooks \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "url": "https://your-server.com/webhook",
    "events": ["rule.created", "rule.updated"]
  }'
```

## JavaScript SDK

### Installation

```html
<script src="https://cdn.tieredpricing.app/sdk.js"></script>
```

### Usage

```javascript
// Initialize
TieredPricing.init({
  shop: 'your-store.myshopify.com'
});

// Get pricing for product
const pricing = await TieredPricing.getPricing(productId);
console.log(pricing.tiers);

// Listen for cart changes
TieredPricing.on('cartUpdated', (cart) => {
  console.log('Cart discount:', cart.discount);
});

// Render pricing table
TieredPricing.renderTable('#pricing-table', {
  productId: 123,
  style: 'modern'
});
```

### SDK Methods

| Method | Description |
|--------|-------------|
| `init(config)` | Initialize SDK |
| `getPricing(productId)` | Get pricing tiers |
| `calculateDiscount(cart)` | Calculate cart discount |
| `renderTable(selector, options)` | Render pricing table |
| `on(event, callback)` | Subscribe to events |
| `off(event, callback)` | Unsubscribe from events |

## Customization

### Custom CSS

Override default styles:

```css
/* Target the pricing table */
.tiered-pricing-table {
  --tp-primary-color: #007bff;
  --tp-border-radius: 8px;
  --tp-font-family: 'Your Font', sans-serif;
}

.tiered-pricing-table .tier-row {
  padding: 12px 16px;
}

.tiered-pricing-table .tier-row.active {
  background-color: var(--tp-primary-color);
  color: white;
}
```

### Custom JavaScript Hooks

```javascript
// Before discount calculation
TieredPricing.hooks.beforeCalculate = (cart) => {
  // Modify cart data if needed
  return cart;
};

// After discount applied
TieredPricing.hooks.afterApply = (discount) => {
  // Custom tracking, analytics, etc.
  gtag('event', 'discount_applied', {
    value: discount.amount
  });
};

// Custom tier rendering
TieredPricing.hooks.renderTier = (tier) => {
  return `<div class="my-custom-tier">${tier.label}</div>`;
};
```

### Theme Integration

For theme developers:

```liquid
{% comment %} Check if product has tiered pricing {% endcomment %}
{% if product.metafields.tiered_pricing.enabled %}
  <div id="tiered-pricing-{{ product.id }}"></div>
  <script>
    TieredPricing.renderTable('#tiered-pricing-{{ product.id }}', {
      productId: {{ product.id }}
    });
  </script>
{% endif %}
```

## Testing

### Test Mode

Enable test mode in settings:
- Discounts calculated but not applied
- Test orders tagged
- Separate analytics

### API Testing

```bash
# Test endpoint (doesn't save)
curl -X POST https://api.tieredpricing.app/v1/rules/test \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "rule": {...},
    "cart": {...}
  }'
```

### Staging Environment

Request staging access:
- Separate environment
- Safe for testing
- No effect on production

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| API calls | 100/minute |
| Webhooks | 50/minute |
| Bulk operations | 10/minute |

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642248600
```

## Support

### Developer Resources

- **API Docs**: https://docs.tieredpricing.app/api
- **SDK Reference**: https://docs.tieredpricing.app/sdk
- **GitHub Examples**: https://github.com/tieredpricing/examples

### Getting Help

- Email: contact@novamentstudios.com
- Community Forum: https://community.tieredpricing.app
- Stack Overflow: tag `tiered-pricing-pro`

---

{% content-ref url="api-reference.md" %}
[api-reference.md](api-reference.md)
{% endcontent-ref %}

{% content-ref url="architecture.md" %}
[architecture.md](architecture.md)
{% endcontent-ref %}
