# POS Integration

Use Tiered Pricing Pro with Shopify Point of Sale (POS) to apply volume discounts in your physical retail locations.

## Overview

Tiered Pricing Pro works seamlessly with Shopify POS:
- Volume discounts apply at the register
- Staff see tiered pricing information
- Same rules online and in-store
- Unified reporting

## Requirements

- Shopify POS app (iOS or Android)
- Shopify plan that includes POS
- Tiered Pricing Pro installed

## How It Works

1. **Customer adds items** to POS cart
2. **Quantity thresholds** are checked
3. **Discounts apply** automatically
4. **Staff sees** applied discounts
5. **Receipt shows** savings

```
┌─────────────────────────────────────────────────────────────┐
│  POS Cart                                                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Widget A × 5                                               │
│  Regular: $10.00 each                                       │
│  Volume Discount: -10% (Buy 5+ save 10%)                   │
│  Price: $9.00 each                                          │
│  Subtotal: $45.00                                           │
│                                                             │
│  ─────────────────────────────────────────────────          │
│  Volume Savings: -$5.00                                     │
│  Total: $45.00                                              │
└─────────────────────────────────────────────────────────────┘
```

## Enabling POS Integration

### Step 1: Access Settings

1. Go to **Settings > POS Integration**
2. Toggle **Enable POS Discounts**

### Step 2: Configure Sync

**Sync Options:**
- Real-time sync (recommended)
- Every 5 minutes
- Every 15 minutes
- Manual sync only

### Step 3: Select Rules for POS

Choose which rules apply in-store:
- [ ] All rules (default)
- [ ] Selected rules only
- [ ] Exclude specific rules

## POS-Specific Settings

### Staff Visibility

**Show pricing table to staff:**
- ON: Staff can view available tiers
- OFF: Only applied discounts visible

**Show customer savings:**
- ON: Staff can communicate savings
- OFF: Internal discount only

### Receipt Configuration

**Show on receipt:**
- Original price per item
- Discount applied
- Customer savings
- Tier achieved

**Sample receipt:**
```
═══════════════════════════════════
        YOUR STORE NAME
═══════════════════════════════════

Widget A (x5)           $50.00
  Volume Discount (10%) -$5.00
                        -------
                        $45.00

───────────────────────────────────
SUBTOTAL                $45.00
TAX                      $3.60
───────────────────────────────────
TOTAL                   $48.60

YOU SAVED: $5.00 with Volume Pricing!
═══════════════════════════════════
```

### Discount Stacking

**POS discount codes + tiered pricing:**
- Allow both
- Best price only
- Tiered pricing only
- Staff override available

## Staff Training

### Explaining to Customers

Train staff to explain:
1. "The more you buy, the more you save"
2. "You're currently at the 10% tier"
3. "Add 2 more to reach the 15% tier"
4. "You've saved $X with volume pricing"

### Manual Override

Staff with permission can:
- Apply discounts manually
- Override automatic discounts
- Adjust quantities
- Remove discounts

### Quick Reference

Create a POS cheat sheet:
```
VOLUME PRICING QUICK REFERENCE

Widget A:
  2-4 items: 10% off
  5-9 items: 15% off
  10+ items: 20% off

Widget B:
  Buy 3, Get 1 Free

Tell customers about savings!
```

## Rules for POS

### Supported Rule Types

| Rule Type | POS Support |
|-----------|-------------|
| Volume Discounts | ✅ Full |
| Percentage Off | ✅ Full |
| Fixed Amount Off | ✅ Full |
| BOGO | ✅ Full |
| Customer Tags | ✅ With login |
| Time-Based | ✅ Full |
| Bundles | ⚠️ Manual add |
| Cart Progress | ❌ Not applicable |
| Free Gifts | ✅ Auto-add |

### POS-Only Rules

Create rules that only apply in-store:

1. Create new rule
2. Under "Channels":
   - Uncheck "Online Store"
   - Check "Point of Sale"
3. Save rule

**Use cases:**
- In-store exclusive offers
- Clearance section pricing
- Local event promotions

### Online-Only Rules

Exclude rules from POS:

1. Edit existing rule
2. Under "Channels":
   - Uncheck "Point of Sale"
   - Keep "Online Store" checked
3. Save rule

## Customer Identification

### For Customer-Tag Rules

Customer tags require identification:

**Method 1: Customer Search**
1. Search customer in POS
2. Add to sale
3. Tags detected automatically
4. Wholesale/VIP pricing applies

**Method 2: Loyalty Card**
1. Customer presents card
2. Scan or enter number
3. Account linked
4. Pricing applies

**Method 3: Phone/Email**
1. Ask for phone or email
2. Look up customer
3. Link to sale

### Guest Customers

When customer not identified:
- Default pricing applies
- Standard volume discounts work
- Customer-specific rules don't apply

## Inventory Considerations

### Stock Levels

POS syncs inventory:
- Real-time stock updates
- Out-of-stock prevents sale
- Low stock warnings

### Multiple Locations

For multi-location stores:
- Rules can be location-specific
- Inventory tracked per location
- Transfers don't affect pricing

## Analytics

### POS-Specific Reports

Track in-store performance:
- POS orders with discounts
- Average discount per transaction
- Popular tiers in-store
- Staff discount usage

### Comparing Channels

Compare online vs POS:
```
┌─────────────────────────────────────────────────────────────┐
│  Channel Comparison                      Last 30 days      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Metric              Online          POS                    │
│  ─────────────────────────────────────────────────          │
│  Orders              1,234           456                    │
│  With Discount       45%             62%                    │
│  Avg Discount        12%             15%                    │
│  Avg Order Value     $67             $89                    │
│                                                             │
│  Insight: POS customers buy more at higher tiers           │
└─────────────────────────────────────────────────────────────┘
```

## Troubleshooting

### Discounts not appearing in POS

1. Verify POS integration is enabled
2. Check rule includes POS channel
3. Ensure POS app is updated
4. Force sync from settings
5. Restart POS app

### Wrong discount amount

1. Check quantity in cart
2. Verify correct rule is active
3. Look for rule conflicts
4. Check customer identification

### Sync issues

1. Check internet connection
2. Verify Shopify connection
3. Force manual sync
4. Check for app updates
5. Contact support if persistent

### Customer tags not working

1. Ensure customer is identified
2. Verify customer has tag in Shopify
3. Check tag spelling (case-sensitive)
4. Sync customer data

## Best Practices

### 1. Train All Staff

- Everyone should understand tiered pricing
- Regular refresher training
- Quick reference materials available

### 2. Promote In-Store

- Signage showing volume discounts
- Staff verbally mention savings
- Receipts highlight savings

### 3. Consistent Pricing

- Same rules online and in-store
- Or clearly communicate differences
- Avoid customer confusion

### 4. Monitor Performance

- Regular review of POS analytics
- Compare to online performance
- Adjust rules based on data

### 5. Test Thoroughly

- Test all scenarios before launch
- Try edge cases
- Verify receipts are correct

---

{% content-ref url="general.md" %}
[general.md](general.md)
{% endcontent-ref %}

{% content-ref url="../features/wholesale/README.md" %}
[features/wholesale/README.md](../features/wholesale/README.md)
{% endcontent-ref %}
