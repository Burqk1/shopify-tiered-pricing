# Tiered Pricing Pro - Complete Documentation

## Table of Contents

1. [Getting Started](#getting-started)
2. [Pricing Rules](#pricing-rules)
3. [Bundle Discounts](#bundle-discounts)
4. [Countdown Timers](#countdown-timers)
5. [B2B/Wholesale](#b2bwholesale)
6. [A/B Testing](#ab-testing)
7. [AI Pricing](#ai-pricing)
8. [Post-Purchase Upsells](#post-purchase-upsells)
9. [Analytics](#analytics)
10. [POS Integration](#pos-integration)
11. [API Reference](#api-reference)
12. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Installation

1. Install the app from Shopify App Store
2. Grant requested permissions
3. Complete the setup wizard
4. Add the theme extension to your store

### First Steps

1. **Create your first pricing rule** - Set up quantity-based discounts
2. **Add theme block** - Display pricing table on product pages
3. **Test on a product** - Verify discounts work correctly
4. **Go live** - Activate rules for customers

---

## Pricing Rules

### What are Pricing Rules?

Pricing rules define how discounts are applied based on quantity purchased. Each rule can have multiple tiers with different discount levels.

### Creating a Rule

1. Navigate to **Pricing Rules** > **Create Rule**
2. Enter a descriptive name
3. Set priority (higher number = higher priority)
4. Choose status (Draft, Active, Paused)

### Conditions

Rules can apply to:

| Condition Type | Description | Example |
|---------------|-------------|---------|
| All Products | Applies to entire store | Store-wide sale |
| Specific Products | Selected products only | "Summer T-Shirts" |
| Collections | All products in collection | "Sale Collection" |
| Customer Tags | Only tagged customers | "wholesale", "vip" |

### Discount Tiers

Each tier defines:

- **Min Quantity**: Minimum items to qualify
- **Max Quantity**: Maximum items (optional)
- **Discount Type**: Percentage or Fixed Amount
- **Value**: Discount amount
- **Message**: Custom message shown to customer

**Example Tiers:**

| Quantity | Discount | Message |
|----------|----------|---------|
| 1-4 | 0% | - |
| 5-9 | 10% | "You save 10%!" |
| 10-19 | 15% | "You save 15%!" |
| 20+ | 25% | "Best value! Save 25%!" |

### Scheduling

On Professional plan:

- Set **Start Date** for future activation
- Set **End Date** for automatic expiration
- Perfect for seasonal promotions

### Priority System

When multiple rules match:

1. Higher priority number wins
2. Customer tag rules typically get higher priority
3. Use priority 1-100 range for flexibility

---

## Bundle Discounts

### What are Bundles?

Bundles let you offer discounts when customers buy specific product combinations.

### Bundle Types

1. **Fixed Bundle** - Must buy all products
2. **Mix & Match** - Choose X from selected products
3. **Tiered Bundle** - Discount increases with more products

### Creating a Bundle

1. Go to **Bundles** > **Create Bundle**
2. Name your bundle
3. Select products to include
4. Set discount type and value
5. Configure requirements:
   - Require all products: Yes/No
   - Minimum products: Number required
6. Save and activate

### Example Bundles

**"Complete Outfit Bundle"**
- T-Shirt + Jeans + Belt
- Require all: Yes
- Discount: 20% off total

**"Mix & Match 3"**
- Any 3 from Accessory Collection
- Require all: No
- Min products: 3
- Discount: $10 off

---

## Countdown Timers

### Purpose

Create urgency with visible countdown timers for limited-time offers.

### Timer Settings

| Setting | Options | Description |
|---------|---------|-------------|
| End Time | Date/Time | When timer expires |
| Style | Default, Minimal, Banner | Visual appearance |
| Show On | All pages, Product pages, Specific | Where to display |
| Linked Rule | Pricing Rule | Auto-disable rule on expiry |

### Display Locations

- **All Pages**: Site-wide banner
- **Product Pages**: Above add-to-cart
- **Cart Page**: Create checkout urgency
- **Specific Products**: Targeted promotions

### Linking to Rules

Link a timer to a pricing rule:
- Timer expiry automatically pauses the rule
- Great for flash sales

---

## B2B/Wholesale

### Customer Groups

Create segments for different customer types:

| Field | Description |
|-------|-------------|
| Name | Group name (e.g., "Gold Members") |
| Tag | Shopify customer tag |
| Discount | Default discount for group |
| Min Order | Minimum order value |
| Tax Exempt | Remove tax for group |
| Net Terms | Payment terms (Net 15, 30, etc.) |

### Group Pricing

Override prices per product per group:

1. Go to group settings
2. Click "Add Product Price"
3. Select product
4. Choose price type:
   - Fixed Price ($50.00)
   - Discount Percent (20% off)
   - Discount Amount ($10 off)

### Wholesale Application Form

Enable signup form for wholesale inquiries:

1. Enable in B2B settings
2. Customize required fields
3. Set auto-assign group on approval
4. Review applications in dashboard

### Net Payment Terms

Offer payment terms to trusted customers:

- Net 15 (pay within 15 days)
- Net 30 (pay within 30 days)
- Net 60 (pay within 60 days)
- Custom terms

---

## A/B Testing

### Why A/B Test Pricing?

Discover which prices maximize:
- Conversion rate
- Average order value
- Total revenue

### Creating a Test

1. Go to **A/B Testing** > **Create Test**
2. Select test type:
   - Price testing
   - Discount testing
   - Shipping testing
   - Bundle testing
3. Configure variants:
   - Control (original)
   - Variant (new price/discount)
4. Set traffic split (default 50/50)
5. Choose target audience

### Test Types

**Price Testing**
- Test $29.99 vs $34.99
- See which converts better

**Discount Testing**
- Test 10% off vs $5 off
- Find optimal discount framing

**Shipping Testing**
- Free shipping threshold testing
- $50 free shipping vs $75 free shipping

### Analyzing Results

Monitor in real-time:

| Metric | Description |
|--------|-------------|
| Views | Product page views |
| Add to Cart | Items added to cart |
| Purchases | Completed orders |
| Conversion Rate | Purchases / Views |
| Revenue | Total revenue per variant |

Statistical significance indicator shows when results are reliable.

### Ending Tests

1. Review results
2. Click "End Test"
3. Select winning variant
4. Winner automatically applies to all customers

---

## AI Pricing

### How It Works

AI analyzes your data to suggest optimal prices:

1. **Sales data** - Historical performance
2. **Competitor prices** - Market positioning
3. **Margin analysis** - Profitability
4. **Conversion rates** - Price sensitivity

### Viewing Suggestions

Go to **AI Pricing** to see recommendations:

| Field | Description |
|-------|-------------|
| Current Price | Your current price |
| Suggested Price | AI recommendation |
| Confidence | How sure AI is (0-100%) |
| Expected Impact | Projected revenue change |

### Applying Suggestions

1. Review AI suggestion
2. Click "Apply" to accept
3. Or "Dismiss" to ignore
4. Applied prices update automatically

### Factors Considered

- Views last 7/30 days
- Sales velocity
- Cart abandonment
- Competitor pricing
- Seasonality
- Inventory levels

---

## Post-Purchase Upsells

### What are Post-Purchase Offers?

Show targeted offers after checkout, before thank-you page.

### Creating an Offer

1. Go to **Post-Purchase** > **Create Offer**
2. Select trigger:
   - All orders
   - Specific products purchased
   - Minimum order value
   - First-time buyers
3. Choose upsell product
4. Set discount (optional)
5. Customize appearance

### Customization Options

| Setting | Options |
|---------|---------|
| Headline | Custom text |
| Primary Color | Button color |
| Show Timer | Yes/No |
| Timer Duration | Seconds |
| CTA Text | Button text |

### Best Practices

- Offer complementary products
- Use urgency (timer)
- Keep discount reasonable (10-20%)
- Test different products

---

## Analytics

### Dashboard Overview

Track discount performance:

| Metric | Description |
|--------|-------------|
| Total Orders | Orders using discounts |
| Total Revenue | Revenue from discounted orders |
| Total Discount | Amount given as discount |
| Avg Discount % | Average discount percentage |

### Reports

**By Rule**
- See which rules drive most revenue
- Identify underperforming rules

**By Product**
- Best-selling discounted products
- Products with highest discount uptake

**Time Series**
- Daily/weekly/monthly trends
- Identify seasonal patterns

### Exporting Data

Export analytics for external analysis:
- CSV format
- Date range selection
- Filter by rule/product

---

## POS Integration

### Overview

Tiered Pricing Pro works with Shopify POS for in-store sales.

### Setup

1. Ensure Shopify POS is installed
2. In Tiered Pricing settings, enable **POS Sync**
3. Rules automatically sync to POS

### How It Works

- Volume discounts apply at POS checkout
- Customer tags work for B2B pricing
- Staff can see tier information

### POS-Specific Settings

| Setting | Description |
|---------|-------------|
| POS Enabled | Turn POS sync on/off |
| Show Tier Info | Display tiers on POS |
| Staff Override | Allow staff to modify |

### Limitations

- Countdown timers not visible in POS
- Some theme customizations don't apply
- A/B tests run on online store only

---

## API Reference

### Authentication

All API requests require App Proxy authentication via HMAC signature.

### Endpoints

#### Get Product Tiers

```
GET /apps/tiered-pricing/product-tiers
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| product_id | string | Yes | Shopify product GID |
| shop | string | Yes | Shop domain |
| signature | string | Yes | HMAC signature |

**Response:**

```json
{
  "tiers": [
    {
      "min": 1,
      "max": 4,
      "valueType": "PERCENTAGE",
      "value": 0,
      "message": null
    },
    {
      "min": 5,
      "max": 9,
      "valueType": "PERCENTAGE",
      "value": 10,
      "message": "Save 10%!"
    },
    {
      "min": 10,
      "max": null,
      "valueType": "PERCENTAGE",
      "value": 20,
      "message": "Best price!"
    }
  ],
  "ruleName": "Volume Discount"
}
```

### Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| /api/product-tiers | 120 requests | 1 minute |
| Sync operations | 10 requests | 1 minute |
| Webhooks | 30 requests | 1 minute |

**Rate Limit Headers:**

```
X-RateLimit-Limit: 120
X-RateLimit-Remaining: 115
X-RateLimit-Reset: 1704672000
```

### Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Missing parameters |
| 401 | Unauthorized - Invalid signature |
| 429 | Too Many Requests - Rate limited |
| 500 | Server Error |

---

## Troubleshooting

### Discount Not Showing on Product Page

1. **Check rule status** - Must be "Active"
2. **Check conditions** - Product must match
3. **Check theme block** - Must be added and visible
4. **Clear cache** - Refresh or incognito window

### Discount Not Applying at Checkout

1. **Create Shopify discount** - Go to Discounts section
2. **Check discount status** - Must be active in Shopify
3. **Check quantity** - Must meet minimum tier
4. **Check other discounts** - May be conflicts

### Theme Block Not Appearing

1. Go to Online Store > Themes > Customize
2. Navigate to Products > Default product
3. Look for "Apps" section
4. Add "Volume Discount Table" block
5. Save changes

### Sync Errors

If sync fails:

1. Check internet connection
2. Verify Shopify permissions
3. Try manual sync from dashboard
4. Check rate limits (max 10/min)
5. Contact support if persists

### Customer Tag Discounts Not Working

1. Verify customer is logged in
2. Check tag spelling (case-sensitive)
3. Ensure tag exists in Shopify admin
4. Clear customer session cache

### B2B Prices Not Showing

1. Customer must be logged in
2. Customer must have correct tag
3. Group must be active
4. Check product-specific overrides

---

## Contact Support

- **Email**: support@tieredpricing.app
- **Live Chat**: Available in app (Growth+ plans)
- **Response Time**:
  - Free: 48 hours
  - Growth: 24 hours
  - Professional: 4 hours

---

## Changelog

### Version 1.0.0 (January 2026)

**Features:**
- Tiered pricing rules
- Bundle discounts
- Countdown timers
- B2B/Wholesale
- A/B Testing
- AI Pricing suggestions
- Post-purchase upsells
- Analytics dashboard
- POS integration
- Multi-language support (EN, TR, DE, ES, FR)

**Technical:**
- Rate limiting
- Metaobject sync
- HMAC authentication
- Exponential backoff retry
