# Priority & Stacking

When multiple pricing rules could apply to the same product, priority determines which one wins. This guide explains how to manage rule conflicts effectively.

## Understanding Priority

### How Priority Works

Each rule has a priority number (0-100):
- **Higher number = Higher priority**
- When multiple rules match, highest priority wins
- Only ONE pricing rule applies at a time

### Example

```
Rule A: All Products, 10% off 5+ (Priority: 10)
Rule B: Collection "Sale", 20% off 3+ (Priority: 50)

Product in "Sale" collection, customer buys 5:
→ Rule B wins (priority 50 > 10)
→ Customer gets 20% off
```

## Setting Priority

### In the Rule Editor

1. Open the rule editor
2. Find the "Priority" field
3. Enter a number 0-100
4. Higher = more important

### Recommended Priority Scheme

| Range | Use Case |
|-------|----------|
| 0-10 | Default/fallback rules |
| 20-30 | General store-wide rules |
| 40-50 | Category/collection rules |
| 60-70 | Special promotions |
| 80-90 | VIP/Customer-specific |
| 100 | Override everything |

### Example Implementation

```
Priority 5:  "Default Volume Discount" - All products, 5% off 10+
Priority 25: "Summer Sale" - All products, 10% off 5+
Priority 45: "Electronics Bulk" - Electronics collection, 15% off 3+
Priority 65: "Flash Sale" - Tagged "flash-sale", 25% off 2+
Priority 85: "Wholesale Customer" - Customer tag "wholesale", 30% off all
```

## Priority Scenarios

### Scenario 1: General vs Specific

**Setup:**
- Rule A: All products, 10% off 10+ (Priority 10)
- Rule B: "Shirts" collection, 15% off 5+ (Priority 50)

**Customer buys 10 shirts:**
- Both rules match
- Rule B wins (higher priority)
- Gets 15% off

**Customer buys 10 pants:**
- Only Rule A matches
- Gets 10% off

### Scenario 2: Time-Limited Override

**Setup:**
- Rule A: All products, 10% off 5+ (Priority 20)
- Rule B: "Black Friday" tag, 30% off all (Priority 80)

**During Black Friday:**
- Tag products with "Black Friday"
- They get 30% off (Rule B)
- Other products still get Rule A

**After Black Friday:**
- Remove "Black Friday" tags
- Rule A applies to everything again

### Scenario 3: Customer Tiers

**Setup:**
- Rule A: All products, 10% off 5+ (Priority 10)
- Rule B: Customer tag "silver", 15% off all (Priority 50)
- Rule C: Customer tag "gold", 25% off all (Priority 70)
- Rule D: Customer tag "platinum", 35% off all (Priority 90)

**Results:**
- Regular customer → Rule A (10% off 5+)
- Silver customer → Rule B (15% off all)
- Gold customer → Rule C (25% off all)
- Platinum customer → Rule D (35% off all)

## Rule Stacking

### What is Stacking?

Stacking means combining multiple discounts. By default, only ONE pricing rule applies (the highest priority match).

### Pricing Rules vs Shopify Discounts

| Type | Stacking Behavior |
|------|-------------------|
| Multiple Pricing Rules | Only highest priority applies |
| Pricing Rule + Shopify Discount Code | Can stack (configurable) |
| Pricing Rule + Automatic Discount | Can stack (configurable) |

### Configuring Stacking

In rule settings:

**"Allow stacking with discount codes"**
- ✅ Enabled: Pricing rule + discount codes combine
- ❌ Disabled: Only pricing rule applies

**Example with stacking enabled:**
```
Product: $100
Pricing Rule: 20% off (5+) → $80
Discount Code: 10% off → $72 final
```

**Example with stacking disabled:**
```
Product: $100
Pricing Rule: 20% off (5+) → $80 final
(Discount code ignored)
```

## Managing Complex Rule Sets

### Documentation

Keep a spreadsheet of your rules:

| Rule Name | Condition | Discount | Priority | Notes |
|-----------|-----------|----------|----------|-------|
| Default Bulk | All | 10% 10+ | 10 | Fallback |
| Summer Sale | Collection | 15% 5+ | 40 | June-Aug |
| VIP | Customer tag | 25% | 80 | VIP members |

### Naming Conventions

Use consistent naming:
```
[Priority] - [Name] - [Condition]
P10 - Default - All Products
P40 - Summer - Apparel
P80 - VIP - Customer Tag
```

### Regular Audits

Monthly review checklist:
- [ ] Are there conflicting rules?
- [ ] Are priorities still appropriate?
- [ ] Are any rules outdated?
- [ ] Are high-priority rules still needed?

## Troubleshooting Priority Issues

### Wrong Discount Applying

**Symptoms:** Customer sees different discount than expected

**Diagnosis:**
1. List all rules that could match the product
2. Check their priorities
3. Verify conditions are correct
4. Test with customer logged in (for customer tags)

**Solution:** Adjust priorities or conditions

### No Discount Showing

**Symptoms:** Product shows regular price despite having rules

**Diagnosis:**
1. Check rule status (must be Active)
2. Verify condition matches the product
3. Check quantity meets minimum tier
4. Look for higher priority rules with no discount

### Discount Too Low

**Symptoms:** Expected 20% but getting 10%

**Diagnosis:**
1. A lower-discount rule might have higher priority
2. Check all matching rules
3. Verify the intended rule's priority

## Best Practices

### 1. Start Low, Go High

New rules should start with lower priority:
```
New rule → Priority 15
Test it → Works correctly?
Adjust → Raise priority if needed
```

### 2. Leave Gaps

Don't use consecutive numbers:
```
Rule A: Priority 10
Rule B: Priority 20
Rule C: Priority 30
```

This leaves room for inserting rules later.

### 3. Document Everything

Add notes to rules explaining:
- Why this priority was chosen
- What it should override
- When it was last reviewed

### 4. Test Thoroughly

Before activating:
1. Test as regular customer
2. Test as tagged customer
3. Test at different quantities
4. Verify against other rules

## Summary

| Concept | Key Point |
|---------|-----------|
| Priority | Higher number wins |
| Range | 0-100 |
| Stacking | Only one pricing rule applies |
| Best practice | Leave gaps between priorities |
| Maintenance | Regular audits recommended |

## Next Steps

Explore other features:

{% content-ref url="../bogo/" %}
[bogo](../bogo/)
{% endcontent-ref %}
