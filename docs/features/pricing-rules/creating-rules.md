# Creating Rules

This guide walks you through creating a pricing rule step by step.

## Accessing the Rule Creator

1. Navigate to **Pricing Rules** in the sidebar
2. Click **Create Rule** or **New Rule** button
3. The rule editor will open

## Step 1: Basic Information

### Rule Name

Enter a descriptive name for internal use:

```
Good: "Summer Sale - T-Shirts 15% off 3+"
Bad: "Rule 1"
```

{% hint style="tip" %}
Use descriptive names that include the product, discount, and condition. You'll thank yourself later!
{% endhint %}

### Priority

Set a number from 0-100:

- **Higher number** = Higher priority
- When multiple rules match the same product, the highest priority wins
- Default is 0

```
Priority 10: General store-wide discount
Priority 50: Category-specific discount
Priority 100: Special VIP customer discount
```

### Status

Choose the initial status:

| Status | Description |
|--------|-------------|
| **Draft** | Not active, for testing |
| **Active** | Live on your store |
| **Paused** | Temporarily disabled |
| **Archived** | Hidden from list, not active |

{% hint style="info" %}
Always start with **Draft** status to test before going live.
{% endhint %}

## Step 2: Set Conditions

Choose which products this rule applies to.

### All Products

Applies to every product in your store.

```
Use case: Store-wide sale, general volume discount
```

### Specific Products

Select individual products:

1. Click **Select Products**
2. Search for products
3. Check the boxes to select
4. Click **Confirm**

```
Use case: Discount on specific SKUs, featured products
```

### Collection

Apply to an entire collection:

1. Select **Collection** condition type
2. Choose a collection from dropdown
3. All products in that collection qualify

```
Use case: Category discounts, seasonal collections
```

### Product Tag

Target products with specific tags:

1. Select **Product Tag** condition type
2. Enter the tag name exactly as it appears
3. All products with that tag qualify

```
Use case: "clearance" tag, "bulk-eligible" tag
```

### Customer Tag (GROWTH+)

Target specific customer groups:

1. Select **Customer Tag** condition type
2. Enter the Shopify customer tag
3. Only customers with that tag see the discount

```
Use case: "wholesale", "vip", "partner" customers
```

## Step 3: Create Discount Tiers

Add the actual discount levels.

### Adding a Tier

Click **Add Tier** and fill in:

| Field | Description | Example |
|-------|-------------|---------|
| Min Quantity | Minimum items needed | 3 |
| Max Quantity | Maximum items (optional) | 9 |
| Discount Type | How to calculate discount | Percentage |
| Discount Value | The discount amount | 15 |
| Message | Shown to customer | "Buy 3+, Save 15%!" |

### Example Tier Setup

**Tier 1:**
- Min: 2, Max: 4
- Type: Percentage, Value: 10
- Message: "Buy 2-4, Get 10% Off!"

**Tier 2:**
- Min: 5, Max: 9
- Type: Percentage, Value: 15
- Message: "Buy 5-9, Get 15% Off!"

**Tier 3:**
- Min: 10, Max: (empty)
- Type: Percentage, Value: 25
- Message: "Buy 10+, Get 25% Off!"

{% hint style="warning" %}
Tiers should not overlap! Make sure max quantity of one tier is less than min quantity of the next.
{% endhint %}

### Discount Types Explained

**Percentage Off:**
```
Original: $20
Discount: 15%
Final: $17 per item
```

**Fixed Amount Off:**
```
Original: $20
Discount: $3 off
Final: $17 per item
```

**Fixed Price:**
```
Original: $20
Fixed Price: $15
Final: $15 per item (regardless of original)
```

## Step 4: Advanced Options

### Schedule (Coming Soon)

Set start and end dates for automatic activation.

### Stacking

Control if this discount can combine with:
- Other pricing rules
- Shopify discount codes
- Automatic discounts

### Display Options

Customize how the pricing table appears:
- Show/hide savings amount
- Show/hide percentage
- Custom CSS (GROWTH+)

## Step 5: Save and Test

### Saving

Click **Save** to save your rule:
- **Save as Draft**: Saves without activating
- **Save and Activate**: Saves and goes live

### Testing

Before activating:

1. Use the **Preview** button
2. Check how the table looks
3. Test different quantities
4. Verify calculations

### Going Live

When ready:

1. Set status to **Active**
2. Click **Save**
3. Visit your storefront to verify

## Common Mistakes to Avoid

❌ **Overlapping tiers**
```
Wrong: Tier 1 (1-5), Tier 2 (5-10)
Right: Tier 1 (1-5), Tier 2 (6-10)
```

❌ **Missing quantity gaps**
```
Wrong: Tier 1 (1-3), Tier 2 (5-10) ← Gap at 4
Right: Tier 1 (1-4), Tier 2 (5-10)
```

❌ **Conflicting rules**
```
Rule A: All products, 10% off 5+
Rule B: T-Shirts, 20% off 3+
→ Check priority settings!
```

## Next Steps

Learn about advanced conditions:

{% content-ref url="conditions.md" %}
[conditions.md](conditions.md)
{% endcontent-ref %}
