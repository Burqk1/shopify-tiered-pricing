# Product Bundles

Product bundles let you group multiple products together and sell them at a discounted price. This encourages customers to buy complementary items and increases your average order value.

{% hint style="info" %}
**Plan Required:** GROWTH or PROFESSIONAL
{% endhint %}

## What Are Product Bundles?

A bundle is a pre-defined set of products sold together at a special price. Unlike BOGO offers (which are automatic), bundles are curated product combinations that you create.

**Examples:**
- "Complete Skincare Set" - Cleanser + Toner + Moisturizer (20% off)
- "Gaming Bundle" - Console + Controller + Game (Save $50)
- "Starter Kit" - All essentials for beginners at one price

## Bundle Types

### Fixed Price Bundle

Set one price for the entire bundle, regardless of individual product prices.

| Products | Individual Total | Bundle Price | Savings |
|----------|-----------------|--------------|---------|
| Product A ($30) + Product B ($25) + Product C ($20) | $75 | $59.99 | $15.01 |

**Best for:** Creating perceived value with a single attractive price point.

### Percentage Discount Bundle

Apply a percentage discount when all bundle products are purchased together.

| Products | Individual Total | Discount | Bundle Price |
|----------|-----------------|----------|--------------|
| Product A + B + C | $75 | 20% off | $60 |

**Best for:** Flexible bundles where product prices may change.

### Fixed Amount Discount Bundle

Save a specific dollar amount when buying the bundle.

| Products | Individual Total | Discount | Bundle Price |
|----------|-----------------|----------|--------------|
| Product A + B + C | $75 | $15 off | $60 |

**Best for:** Clear savings messaging ("Save $15!").

## Creating a Bundle

### Step 1: Navigate to Bundles

1. Go to **Bundles** in the sidebar
2. Click **Create Bundle**

### Step 2: Bundle Details

1. **Bundle Name**: Internal name (e.g., "Summer Skincare Set")
2. **Display Title**: What customers see (e.g., "Complete Summer Glow Kit")
3. **Description**: Explain the value proposition

### Step 3: Select Products

1. Click **Add Products**
2. Search or browse your catalog
3. Select 2 or more products
4. Set quantities for each product (optional)

### Step 4: Set Pricing

Choose your bundle type and configure:

**For Fixed Price:**
- Enter the bundle price
- System calculates and shows savings

**For Percentage Discount:**
- Enter discount percentage (e.g., 20%)
- Preview shows calculated price

**For Fixed Amount:**
- Enter discount amount (e.g., $15)
- Preview shows final price

### Step 5: Additional Options

- **Bundle Image**: Upload a custom image or use auto-generated collage
- **Inventory Tracking**: Bundle availability based on product stock
- **Display Location**: Where to show the bundle offer

### Step 6: Activate

1. Review your bundle configuration
2. Click **Create Bundle**
3. Toggle status to **Active**

## Bundle Display Options

### Product Page Widget

Show bundle offers on individual product pages:

```
┌─────────────────────────────────────┐
│  🎁 Frequently Bought Together      │
│                                     │
│  [Product A] + [Product B] + [This] │
│                                     │
│  Total: $75  →  Bundle: $60         │
│  You save: $15 (20%)                │
│                                     │
│  [Add Bundle to Cart]               │
└─────────────────────────────────────┘
```

### Dedicated Bundle Page

Create a landing page showcasing all your bundles:

- Auto-generated at `/pages/bundles`
- Customizable layout
- Filter by category or price

### Cart Recommendations

Suggest completing a bundle when partial products are in cart:

```
┌─────────────────────────────────────┐
│  Complete Your Bundle & Save!       │
│                                     │
│  You have: Product A               │
│  Add: Product B + Product C         │
│                                     │
│  [Complete Bundle - Save $15]       │
└─────────────────────────────────────┘
```

## Bundle Settings

### Inventory Behavior

**Option 1: All Required (Default)**
- Bundle only available when ALL products are in stock
- Prevents overselling

**Option 2: Partial Fulfillment**
- Bundle available if any product is in stock
- Customer notified of partial availability

### Variant Selection

When bundle products have variants (size, color):

- **Customer Selects**: Let customers choose their variants
- **Pre-defined**: Lock specific variants in the bundle

### Stacking Rules

- **Allow with discount codes**: Bundle + code both apply
- **Exclusive**: Bundle discount only, no codes
- **Best price**: System applies whichever saves more

## Bundle Analytics

Track bundle performance:

| Metric | Description |
|--------|-------------|
| Views | How many times bundle was displayed |
| Add to Cart | Bundle added to cart |
| Purchases | Completed bundle purchases |
| Revenue | Total revenue from bundles |
| Conversion Rate | Views → Purchases |
| Avg Savings | Average customer savings |

## Best Practices

### 1. Create Logical Groupings

Bundle products that naturally go together:
- ✅ Shampoo + Conditioner + Hair Mask
- ✅ Phone Case + Screen Protector + Charger
- ❌ Random unrelated products

### 2. Offer Real Value

Bundles should provide genuine savings:
- Minimum 10-15% discount recommended
- Show the savings prominently
- Compare to individual purchase total

### 3. Limit Bundle Size

Optimal bundle size: 2-4 products
- Too few: Not compelling
- Too many: Overwhelming and expensive

### 4. Use Compelling Names

- ❌ "Bundle #1"
- ✅ "Complete Starter Kit"
- ✅ "Everything You Need Bundle"

### 5. Feature on Product Pages

Enable "Frequently Bought Together" widgets to capture impulse purchases.

### 6. Create Seasonal Bundles

- Holiday gift sets
- Back-to-school bundles
- Summer essentials

## Examples by Industry

### Beauty & Skincare
- "Morning Routine Set" - Cleanser, Serum, Moisturizer, SPF
- "Anti-Aging Bundle" - Eye cream, Night cream, Retinol serum

### Electronics
- "Work From Home Kit" - Webcam, Headset, Ring light
- "Gaming Setup" - Mouse, Keyboard, Mousepad

### Food & Beverage
- "Coffee Lover's Bundle" - Beans, Grinder, French press
- "Snack Pack" - Mix of popular items

### Fashion
- "Complete Outfit" - Top, Bottom, Accessories
- "Activewear Set" - Leggings, Sports bra, Jacket

### Home & Garden
- "Plant Parent Starter Kit" - Pot, Soil, Seeds, Tools
- "Bathroom Refresh" - Towels, Mat, Accessories

## Troubleshooting

### Bundle not showing on product page

1. Check bundle status is "Active"
2. Verify all products are published and in stock
3. Enable bundle widget in theme settings
4. Clear cache and refresh

### Discount not applying in cart

1. Ensure all bundle products are in cart
2. Check quantities match bundle requirements
3. Verify no conflicting discount codes (if stacking disabled)

### Inventory issues

1. Check individual product stock levels
2. Review inventory behavior settings
3. Ensure variants have stock if applicable

---

{% content-ref url="../pricing-rules/README.md" %}
[pricing-rules/README.md](../pricing-rules/README.md)
{% endcontent-ref %}

{% content-ref url="../bogo/README.md" %}
[bogo/README.md](../bogo/README.md)
{% endcontent-ref %}
