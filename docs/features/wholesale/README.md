# B2B & Wholesale Pricing

Create special pricing for wholesale customers, VIP members, and different customer groups. Target discounts based on customer tags, order history, or account status.

{% hint style="info" %}
**Plan Required:** GROWTH or PROFESSIONAL
{% endhint %}

## Overview

B2B/Wholesale pricing allows you to:
- Offer different prices to different customer groups
- Create tiered customer levels (Silver, Gold, Platinum)
- Set minimum order quantities for wholesale
- Hide retail prices from B2B customers
- Require login to see wholesale prices

## How It Works

1. **Tag customers** in Shopify with group identifiers (e.g., "wholesale", "vip")
2. **Create pricing rules** targeting those tags
3. **Customers log in** to see their special prices
4. **Discounts apply** automatically at checkout

```
Retail Customer (logged out):
Product A: $100

Wholesale Customer (logged in, tag: "wholesale"):
Product A: $70 (30% off)
```

## Setting Up Wholesale Pricing

### Step 1: Tag Your Customers

In Shopify Admin:

1. Go to **Customers**
2. Select a customer
3. Add tags in the **Tags** field:
   - `wholesale`
   - `vip`
   - `distributor`
   - Or any custom tag

**Bulk tagging:**
1. Select multiple customers
2. Click **More actions** > **Add tags**
3. Enter tag name

### Step 2: Create Wholesale Rule

1. Go to **Pricing Rules**
2. Click **Create Rule**
3. Name it (e.g., "Wholesale 30% Off")

### Step 3: Configure Conditions

**Customer Condition:**
```
Customer Tags: Contains "wholesale"
```

**Additional Conditions (Optional):**
- Minimum order quantity
- Minimum order value
- Specific products/collections

### Step 4: Set Discount

**Discount Type Options:**

| Type | Example | Best For |
|------|---------|----------|
| Percentage | 30% off | General wholesale |
| Fixed amount per item | $10 off each | High-value items |
| Fixed price | Set to $X | Specific wholesale pricing |
| Tiered | More volume = more discount | Volume incentives |

### Step 5: Activate

1. Review settings
2. Click **Create Rule**
3. Toggle to **Active**

## Customer Tier System

Create multiple customer levels with increasing benefits:

### Example Setup

| Tier | Tag | Discount | Requirements |
|------|-----|----------|--------------|
| Silver | `silver` | 15% off | $1,000+ lifetime |
| Gold | `gold` | 25% off | $5,000+ lifetime |
| Platinum | `platinum` | 35% off | $20,000+ lifetime |
| Distributor | `distributor` | 45% off | Application approved |

### Implementation

Create separate rules for each tier:

**Silver Tier Rule:**
- Condition: Customer tag contains "silver"
- Discount: 15% off
- Priority: 50

**Gold Tier Rule:**
- Condition: Customer tag contains "gold"
- Discount: 25% off
- Priority: 60

**Platinum Tier Rule:**
- Condition: Customer tag contains "platinum"
- Discount: 35% off
- Priority: 70

{% hint style="warning" %}
Higher priority rules override lower ones. Set priority so better discounts win.
{% endhint %}

## Wholesale-Only Products

Create products visible only to wholesale customers:

### Method 1: Collection-Based

1. Create "Wholesale Only" collection
2. Create rule:
   - Products: Wholesale Only collection
   - Condition: Customer tag "wholesale"
   - Discount: Show price (or set wholesale price)
3. Hide collection from navigation for non-wholesale

### Method 2: Price-Based

1. Set retail price very high (effectively hidden)
2. Wholesale rule reduces to actual price
3. Non-wholesale customers see "Contact for pricing"

## Minimum Order Requirements

### Minimum Quantity

Require bulk purchases for wholesale:

```
Condition: Cart quantity >= 10
Customer: Tag contains "wholesale"
Action: Apply 30% discount
```

**Message to customer:**
"Wholesale pricing requires minimum 10 items"

### Minimum Order Value

Require spending threshold:

```
Condition: Cart total >= $500
Customer: Tag contains "wholesale"
Action: Apply wholesale pricing
```

## Displaying Wholesale Prices

### Price Display Options

**Show Both Prices:**
```
Retail: $100
Your Price: $70 (30% off)
```

**Wholesale Only:**
```
$70 (Logged in as Wholesale)
```

**Hide Until Login:**
```
[Login to see wholesale prices]
```

### Theme Customization

Configure display in app settings:
- Show/hide retail price
- Show/hide savings amount
- Custom "Wholesale" badge
- Login prompt messaging

## B2B Account Features

### Wholesale Registration

Options for new wholesale customers:

1. **Application Form**
   - Custom fields (business name, tax ID)
   - Manual approval required
   - Auto-tag upon approval

2. **Automatic Qualification**
   - Based on order history
   - Spend threshold auto-upgrades
   - Tag added automatically

3. **Access Code**
   - Share code with approved buyers
   - Code unlocks wholesale tagging
   - Easy but controlled access

### Account Dashboard

Wholesale customers see:
- Current tier level
- Discount percentage
- Order history
- Progress to next tier
- Exclusive products

## Order Forms for B2B

Streamline wholesale ordering:

### Quick Order Form

Spreadsheet-style ordering:
```
┌──────────────┬─────────┬──────────┬─────────┐
│ Product      │ SKU     │ Price    │ Qty     │
├──────────────┼─────────┼──────────┼─────────┤
│ Widget A     │ WGT-001 │ $7.00    │ [100]   │
│ Widget B     │ WGT-002 │ $9.00    │ [50]    │
│ Widget C     │ WGT-003 │ $12.00   │ [25]    │
└──────────────┴─────────┴──────────┴─────────┘
                    Subtotal: $1,775.00
```

### Reorder Feature

- Save previous orders
- One-click reorder
- Modify quantities before adding

### CSV Upload

Accept spreadsheet orders:
1. Customer downloads template
2. Fills in SKUs and quantities
3. Uploads to add all items to cart

## Payment Terms

### Net Terms for Wholesale

B2B often requires payment terms:
- Net 30 (payment due in 30 days)
- Net 60
- Payment on delivery

{% hint style="info" %}
Payment terms require integration with Shopify B2B features or third-party apps.
{% endhint %}

### Credit Limits

Set spending limits per customer:
- Review credit before large orders
- Block orders exceeding limit
- Manual approval workflow

## Best Practices

### 1. Clear Tier Structure

Document and communicate:
- How to qualify for each tier
- Benefits at each level
- How to upgrade

### 2. Protect Your Margins

- Calculate wholesale prices carefully
- Account for volume commitments
- Set minimum order requirements

### 3. Verify B2B Customers

- Require business documentation
- Tax exemption certificates
- Manual approval process

### 4. Differentiate Experience

B2B customers need:
- Simpler product pages
- Quick reordering
- Bulk actions
- Different checkout

### 5. Use Priority Correctly

```
Platinum (highest discount): Priority 70
Gold: Priority 60
Silver: Priority 50
Default retail: Priority 10
```

Higher priority = rule wins when multiple apply

## Analytics

Track wholesale performance:

| Metric | Description |
|--------|-------------|
| B2B Customers | Total tagged wholesale customers |
| B2B Orders | Orders from tagged customers |
| B2B Revenue | Revenue from wholesale |
| Avg B2B Order | Average wholesale order value |
| B2B % of Total | Wholesale share of business |
| Tier Distribution | Customers in each tier |

## Integration with Other Features

### With Volume Discounts

Combine wholesale base + volume bonus:
- Base wholesale: 30% off
- 10+ units: Additional 5% off
- 50+ units: Additional 10% off

### With BOGO

Wholesale customers can also access BOGO:
- "Buy 10 cases, get 1 free"
- Stacks with wholesale pricing

### With Cart Progress

Different goals for B2B:
- "$1,000 for free freight"
- Higher thresholds, better rewards

## Troubleshooting

### Customer not seeing wholesale prices

1. Verify customer is logged in
2. Check customer has correct tag (case-sensitive)
3. Confirm rule is active
4. Clear browser cache

### Wrong discount applying

1. Check rule priority settings
2. Verify no conflicting rules
3. Ensure correct tag is targeted
4. Review condition logic

### Price showing on product but not in cart

1. Check checkout discount settings
2. Verify Shopify Functions are enabled
3. Review stacking rules

---

{% content-ref url="../pricing-rules/README.md" %}
[pricing-rules/README.md](../pricing-rules/README.md)
{% endcontent-ref %}

{% content-ref url="../pricing-rules/conditions.md" %}
[pricing-rules/conditions.md](../pricing-rules/conditions.md)
{% endcontent-ref %}
