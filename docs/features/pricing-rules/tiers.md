# Discount Tiers

Discount tiers are the heart of your pricing rules. They define exactly how much customers save at each quantity level.

## Understanding Tiers

A tier consists of:

| Component | Description |
|-----------|-------------|
| **Min Quantity** | Minimum items to qualify |
| **Max Quantity** | Maximum items (optional) |
| **Discount Type** | How discount is calculated |
| **Discount Value** | The actual discount amount |
| **Message** | Text shown to customers |

## Discount Types

### Percentage Discount

Most common type. Reduces price by a percentage.

**How it works:**
```
Original Price: $50.00
Discount: 20%
Final Price: $40.00 per item
```

**Best for:**
- General sales
- Easy-to-understand offers
- Works at any price point

**Example Setup:**
| Qty | Discount | Customer Sees |
|-----|----------|---------------|
| 2-4 | 10% | $45.00 each |
| 5-9 | 15% | $42.50 each |
| 10+ | 20% | $40.00 each |

### Fixed Amount Off

Reduces price by a fixed dollar amount per item.

**How it works:**
```
Original Price: $50.00
Discount: $10 off
Final Price: $40.00 per item
```

**Best for:**
- Higher-priced items
- Clear savings communication
- Consistent discount amounts

**Example Setup:**
| Qty | Discount | Customer Sees |
|-----|----------|---------------|
| 2-4 | $5 off | $45.00 each |
| 5-9 | $10 off | $40.00 each |
| 10+ | $15 off | $35.00 each |

{% hint style="warning" %}
Ensure fixed discount doesn't exceed product price, or it will result in $0 (not negative).
{% endhint %}

### Fixed Price

Sets a specific price per item, regardless of original price.

**How it works:**
```
Original Price: $50.00
Fixed Price: $35.00
Final Price: $35.00 per item
```

**Best for:**
- Wholesale pricing
- "Bulk price" offers
- Inventory clearance

**Example Setup:**
| Qty | Fixed Price | Savings |
|-----|-------------|---------|
| 1 | $50.00 | - |
| 5+ | $45.00 | $5/item |
| 10+ | $40.00 | $10/item |
| 25+ | $35.00 | $15/item |

## Creating Effective Tier Structures

### The "Sweet Spot" Strategy

Create tiers that encourage buying just a bit more:

```
Tier 1: 2-4 items → 10% off
Tier 2: 5-9 items → 18% off (big jump!)
Tier 3: 10+ items → 25% off
```

The jump from Tier 1 to Tier 2 is significant, encouraging customers to buy 5 instead of 4.

### The "Wholesale" Strategy

Gradual increases for B2B customers:

```
Tier 1: 10-24 items → 15% off
Tier 2: 25-49 items → 20% off
Tier 3: 50-99 items → 25% off
Tier 4: 100+ items → 30% off
```

### The "Pair" Strategy

For products commonly bought in pairs:

```
Tier 1: 2 items → 10% off
Tier 2: 4 items → 15% off
Tier 3: 6 items → 20% off
```

## Tier Messages

Custom messages appear in the pricing table and help customers understand the value.

### Writing Effective Messages

**Good Messages:**
- "Buy 2+, Save 10%!"
- "Best Value - 25% Off!"
- "Team Pack Special"
- "Wholesale Price"

**Avoid:**
- Technical jargon
- Too much detail
- Confusing calculations

### Message Variables

You can use variables in messages:

| Variable | Shows |
|----------|-------|
| `{qty}` | Tier quantity |
| `{discount}` | Discount amount |
| `{price}` | Final price |
| `{savings}` | Savings amount |

**Example:**
```
"Buy {qty}+ and save {discount}!"
→ "Buy 5+ and save 15%!"
```

## Common Tier Configurations

### Standard Volume Discount

```
2-4: 10% off - "Buy More, Save More"
5-9: 15% off - "Better Value"
10+: 20% off - "Best Deal!"
```

### Wholesale Tiers

```
10-24: 25% off - "Retail Partner"
25-49: 30% off - "Distributor"
50+: 35% off - "Wholesale"
```

### Simple BOGO-style

```
2+: 50% off - "Buy One Get One Half Off"
```

### Aggressive Clearance

```
3+: 30% off - "Clearance Special"
5+: 40% off - "Super Clearance"
10+: 50% off - "Everything Must Go!"
```

## Tier Rules and Validation

### No Overlapping Quantities

❌ **Wrong:**
```
Tier 1: 1-5
Tier 2: 5-10  ← Overlap at 5!
```

✅ **Correct:**
```
Tier 1: 1-5
Tier 2: 6-10
```

### No Gaps

❌ **Wrong:**
```
Tier 1: 1-3
Tier 2: 5-10  ← Gap at quantity 4!
```

✅ **Correct:**
```
Tier 1: 1-4
Tier 2: 5-10
```

### Increasing Discounts

Generally, higher quantities should have better discounts:

❌ **Confusing:**
```
Tier 1: 2+ → 20% off
Tier 2: 5+ → 15% off  ← Less discount for more?
```

✅ **Logical:**
```
Tier 1: 2+ → 10% off
Tier 2: 5+ → 15% off
Tier 3: 10+ → 20% off
```

## Testing Tiers

### Before Activating

1. **Preview the rule** - Check the pricing table appearance
2. **Calculate manually** - Verify the math is correct
3. **Test edge cases** - Try quantities at tier boundaries

### Edge Cases to Test

| Test | Expected Result |
|------|-----------------|
| Qty = 0 | No discount |
| Qty = 1 (if tier starts at 2) | No discount |
| Qty = exactly min | Tier discount applies |
| Qty = exactly max | Tier discount applies |
| Qty = max + 1 | Next tier applies |
| Very high qty | Highest tier applies |

## Performance Tips

### Limit Tier Count

- Recommended: 3-5 tiers
- Maximum practical: 7-8 tiers
- More tiers = more confusing for customers

### Clear Differentiation

Make each tier meaningfully different:

❌ **Too Similar:**
```
5+: 10% off
6+: 11% off
7+: 12% off
```

✅ **Meaningful:**
```
5+: 10% off
10+: 18% off
20+: 25% off
```

## Next Steps

Learn about rule priority and stacking:

{% content-ref url="priority.md" %}
[priority.md](priority.md)
{% endcontent-ref %}
