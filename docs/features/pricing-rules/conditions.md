# Conditions

Conditions determine which products your pricing rule applies to. This page covers all available condition types and how to use them effectively.

## Condition Types Overview

| Type | Description | Plan |
|------|-------------|------|
| All Products | Applies to everything | All |
| Specific Products | Selected products only | All |
| Collection | Products in a collection | All |
| Product Tag | Products with specific tag | All |
| Customer Tag | Customers with specific tag | GROWTH+ |
| Product Vendor | Products by vendor | GROWTH+ |
| Product Type | Products of specific type | GROWTH+ |

## All Products

The simplest condition - applies to every product in your store.

### When to Use

- Store-wide sales
- Universal volume discounts
- Clearance events

### Example

```
Condition: All Products
Tiers: Buy 5+ get 10% off
Result: Every product gets 10% off when 5+ purchased
```

{% hint style="warning" %}
Be careful with "All Products" combined with other rules. Use priority settings to control which rule wins.
{% endhint %}

## Specific Products

Target individual products by selecting them.

### How to Set Up

1. Select "Specific Products" as condition type
2. Click "Select Products"
3. Use search to find products
4. Check the boxes to select
5. Confirm selection

### When to Use

- Featured product promotions
- SKU-specific discounts
- Bundling specific items

### Tips

- You can select multiple products
- Products can be added/removed later
- Works with product variants

## Collection

Apply rules to all products in a Shopify collection.

### How to Set Up

1. Select "Collection" as condition type
2. Choose collection from dropdown
3. All products in that collection qualify

### When to Use

- Category-wide discounts
- Seasonal collections
- Brand-specific deals

### Example

```
Condition: Collection = "Summer Wear"
Tiers: Buy 3+ get 15% off
Result: Any product in Summer Wear collection
```

{% hint style="info" %}
Products added to the collection later will automatically get the discount.
{% endhint %}

## Product Tag

Target products that have a specific tag in Shopify.

### How to Set Up

1. Select "Product Tag" as condition type
2. Enter the exact tag name
3. Tag matching is case-sensitive

### When to Use

- Cross-collection discounts
- Flexible product grouping
- "Bulk eligible" product marking

### Example

```
Condition: Product Tag = "bulk-discount"
Tiers: Buy 10+ get 20% off
Result: Any product tagged "bulk-discount"
```

### Managing Tags

In Shopify Admin:
1. Go to Products
2. Select a product
3. Add tag in the Tags section
4. Save

## Customer Tag (GROWTH+)

Apply discounts only to customers with specific tags.

### How to Set Up

1. Select "Customer Tag" as condition type
2. Enter the Shopify customer tag
3. Only logged-in customers with that tag see the discount

### When to Use

- Wholesale/B2B pricing
- VIP customer discounts
- Membership pricing
- Partner discounts

### Example

```
Condition: Customer Tag = "wholesale"
Tiers: All quantities 30% off
Result: Only wholesale-tagged customers see discount
```

### How Customers Get Tags

1. **Manual**: Edit customer in Shopify Admin
2. **Apps**: Customer tagging apps
3. **Shopify Flow**: Automated tagging

{% hint style="warning" %}
Customers must be logged in for customer tags to work. Guest checkout won't see these discounts.
{% endhint %}

## Combining Conditions

You can combine multiple conditions for precise targeting.

### AND Logic

Product must match ALL conditions:

```
Condition 1: Collection = "T-Shirts"
Condition 2: Product Tag = "sale"
Result: Only T-Shirts that also have "sale" tag
```

### Creating Combined Conditions

1. Add first condition
2. Click "Add Condition"
3. Select "AND" or "OR"
4. Add second condition

## Condition Priority Examples

### Scenario 1: General + Specific

```
Rule A: All Products, 10% off 5+ (Priority: 10)
Rule B: T-Shirts, 20% off 3+ (Priority: 50)

Customer buys 5 T-Shirts:
→ Rule B wins (higher priority)
→ Gets 20% off
```

### Scenario 2: Multiple Tags

```
Rule A: Tag "bulk" - 15% off 10+ (Priority: 20)
Rule B: Tag "vip-bulk" - 25% off 5+ (Priority: 30)

Product has both tags, customer buys 10:
→ Rule B wins (higher priority)
→ Gets 25% off
```

### Scenario 3: Customer + Product

```
Rule A: All Products - 10% off 5+ (Priority: 10)
Rule B: Customer Tag "wholesale" - 30% off all (Priority: 50)

Wholesale customer buys any 5:
→ Rule B wins (higher priority)
→ Gets 30% off
```

## Best Practices

### 1. Be Specific

More specific conditions = more control

```
Instead of: All Products
Better: Collection = "Eligible for Discount"
```

### 2. Use Tags for Flexibility

Tags are easier to manage than specific product selections:

```
Instead of: Select 50 products manually
Better: Tag them "promo-2024" and use tag condition
```

### 3. Plan Priority Carefully

Document your priority scheme:

```
0-10: Store-wide defaults
20-40: Category rules
50-70: Special promotions
80-100: VIP/Customer specific
```

### 4. Test Overlapping Rules

When rules could overlap:

1. Create test orders
2. Verify the right discount applies
3. Adjust priorities if needed

## Troubleshooting

### Discount Not Showing

1. Check if product matches conditions
2. Verify rule status is Active
3. Check for higher priority rules
4. Clear browser cache

### Wrong Discount Amount

1. Check tier configuration
2. Verify quantity ranges
3. Check priority against other rules

### Customer Tag Not Working

1. Ensure customer is logged in
2. Verify tag spelling exactly matches
3. Check customer actually has the tag in Shopify

## Next Steps

Learn about discount tiers:

{% content-ref url="tiers.md" %}
[tiers.md](tiers.md)
{% endcontent-ref %}
