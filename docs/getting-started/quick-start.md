# Quick Start Guide

Get your first volume discount running in under 5 minutes.

## Your First Pricing Rule

Let's create a simple "Buy More, Save More" discount.

### Step 1: Navigate to Pricing Rules

1. Open the app from your Shopify admin
2. Click **Pricing Rules** in the left sidebar
3. Click **Create Rule** button

### Step 2: Basic Information

Fill in the basic details:

| Field | Example Value | Description |
|-------|---------------|-------------|
| Rule Name | "Summer Sale Tiers" | Internal name (customers don't see this) |
| Priority | 5 | Higher number = higher priority |
| Status | Draft | Start as draft, activate when ready |

### Step 3: Set Conditions

Choose which products this rule applies to:

**Option A: All Products**
- Select "All Products" to apply to everything

**Option B: Specific Products**
- Select "Specific Products"
- Search and select individual products

**Option C: Collection**
- Select "Collection"
- Choose a collection from your store

**Option D: Product Tag**
- Select "Product Tag"
- Enter a tag (e.g., "bulk-discount")

### Step 4: Create Discount Tiers

Add your volume discount tiers:

| Quantity | Discount | Message |
|----------|----------|---------|
| 2-4 items | 10% off | "Buy 2+, Save 10%!" |
| 5-9 items | 15% off | "Buy 5+, Save 15%!" |
| 10+ items | 25% off | "Buy 10+, Save 25%!" |

Click **Add Tier** for each tier, then fill in:
- **Min Quantity**: Minimum items to qualify
- **Max Quantity**: Maximum items (leave empty for unlimited)
- **Discount Type**: Percentage, Fixed Amount, or Fixed Price
- **Discount Value**: The discount amount
- **Message**: Optional message shown to customers

### Step 5: Save and Activate

1. Click **Save** to save as draft
2. Review your rule in the list
3. Click the **Activate** button when ready

## Testing Your Rule

### Preview Mode

1. Click **Preview** on your rule
2. See how the pricing table will look
3. Check different quantity scenarios

### Live Testing

1. Visit your storefront
2. Go to a product that matches your rule conditions
3. You should see a pricing table showing:
   - Available quantity tiers
   - Discount for each tier
   - Your custom messages

### Cart Testing

1. Add products to cart with different quantities
2. Verify the correct discount is applied
3. Check that the discount appears in checkout

## Common Configurations

### Example 1: Percentage Discount

```
Buy 3-5: 10% off
Buy 6-9: 15% off
Buy 10+: 20% off
```

Best for: General products, fashion, accessories

### Example 2: Fixed Amount Off

```
Buy 2: $5 off
Buy 5: $15 off
Buy 10: $40 off
```

Best for: Higher-priced items, electronics

### Example 3: Fixed Price Per Unit

```
Buy 1: $10.00 each
Buy 5: $8.50 each
Buy 10: $7.00 each
```

Best for: Wholesale, B2B, bulk supplies

## What's Next?

Now that you've created your first rule, explore more features:

- [Advanced Conditions](../features/pricing-rules/conditions.md) - Target specific customers
- [BOGO Offers](../features/bogo/) - Buy One Get One deals
- [Cart Progress Bar](../features/cart-progress/) - Encourage larger orders
- [A/B Testing](../features/ab-testing/) - Find the best pricing strategy

{% hint style="success" %}
**Pro Tip:** Start with one rule and monitor its performance for a week before creating more complex setups.
{% endhint %}
