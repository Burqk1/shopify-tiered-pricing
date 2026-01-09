# Geo Targeting

Display different prices, offers, and content based on your customer's location. Geo targeting allows you to optimize pricing for different markets and comply with regional requirements.

{% hint style="info" %}
**Plan Required:** PROFESSIONAL
{% endhint %}

## What is Geo Targeting?

Geo targeting uses the visitor's IP address to determine their location, then applies location-specific rules:

- Different prices for different countries
- Regional promotions and offers
- Currency-appropriate messaging
- Localized discount thresholds

## Use Cases

### Regional Pricing

Adjust prices based on local purchasing power:

| Region | Price | Reasoning |
|--------|-------|-----------|
| United States | $100 | Base price |
| European Union | €95 | Market rate |
| United Kingdom | £85 | Local competition |
| Australia | $130 AUD | Shipping costs |
| India | ₹4,999 | Purchasing power |

### Market-Specific Promotions

Different campaigns for different regions:
- US: "Memorial Day Sale - 20% off"
- UK: "Bank Holiday Special - 15% off"
- Australia: "End of Financial Year Sale"
- Global: "Summer Sale" (adjusts by hemisphere)

### Compliance

Meet regional requirements:
- EU: Show prices with VAT included
- US: Show prices without tax
- Canada: Bilingual pricing display

## Setting Up Geo Targeting

### Step 1: Enable Geo Targeting

1. Go to **Settings > Geo Targeting**
2. Toggle **Enable Geo Targeting**
3. Review IP detection settings

### Step 2: Create Location Rules

**Method 1: Per-Rule Targeting**

Add location conditions to existing rules:
1. Edit pricing rule
2. Add condition: "Location"
3. Select countries/regions
4. Save rule

**Method 2: Location-Specific Rules**

Create rules that only apply to certain locations:
1. Create new rule
2. Set "Location" as primary condition
3. Configure pricing for that region
4. Create additional rules for other regions

### Step 3: Currency Configuration

For multi-currency stores:
1. Enable Shopify Markets or currency app
2. Configure currency display settings
3. Set whether discounts are % or fixed per currency

## Location Conditions

### Country Targeting

Target specific countries:
```
Condition: Location is United States
Action: Apply 10% discount
```

### Region Targeting

Target areas within countries:
```
Condition: Location is California, New York, Texas
Action: Free shipping threshold $50
```

### Continental Targeting

Target entire continents:
- North America
- Europe
- Asia
- Oceania
- South America
- Africa

### Exclusion Rules

Exclude specific locations:
```
Condition: Location is NOT Russia, China
Action: Apply international shipping offer
```

## Geo-Targeted Features

### Pricing Rules

Location-based discounts:
```
US Customers: 10% off (code: USA10)
EU Customers: 15% off (code: EU15)
UK Customers: 20% off (code: UK20)
```

### Cart Progress

Different thresholds by region:
```
US: Free shipping at $75
EU: Free shipping at €100
UK: Free shipping at £65
```

### Free Gifts

Region-specific gifts:
```
US: Free US-exclusive product
International: Free travel-size version
```

### Countdown Timers

Timezone-aware timers:
- Show local end time
- "Ends at midnight your time"
- Consistent global end moment

### Display Messages

Localized messaging:
```
US: "Free shipping on orders over $75"
UK: "Free delivery on orders over £65"
EU: "Kostenloser Versand ab €100"
```

## Multi-Currency Pricing

### Automatic Conversion

Prices converted at current rates:
- Base: $100 USD
- Converted: €92, £79, $145 AUD
- Updates daily/hourly

### Fixed Regional Prices

Set specific prices per region:
- US: $99.99
- EU: €99.99 (not converted)
- UK: £89.99

### Discount Handling

**Percentage discounts**: Apply same % everywhere
```
10% off = 10% in all currencies
```

**Fixed discounts**: Per-currency amounts
```
US: $10 off
EU: €10 off
UK: £10 off
```

## IP Detection

### How It Works

1. Visitor loads your store
2. IP address detected
3. IP geolocated to country/region
4. Appropriate rules applied
5. Content personalized

### Accuracy

- Country-level: 99%+ accuracy
- City-level: 80-90% accuracy
- VPN users may see wrong location

### VPN & Proxy Handling

Options for VPN users:
- Best guess (default)
- Ask user to confirm location
- Default to base pricing

## Compliance Considerations

### GDPR (Europe)

- Disclose location detection
- Allow users to change location
- Include in privacy policy

### Price Transparency

Some regions require:
- Showing original price
- Clear discount communication
- VAT inclusion

### Anti-Discrimination

Be careful with:
- Dramatic price differences
- Excluding regions entirely
- Different quality offerings

## Best Practices

### 1. Start with Major Markets

Focus on your top 5-10 countries first before expanding.

### 2. Research Local Pricing

Understand local:
- Competitor prices
- Purchasing power
- Currency stability

### 3. Consider Shipping Costs

Factor in actual costs:
- International shipping
- Import duties
- Returns handling

### 4. Test Before Full Rollout

A/B test regional pricing:
- Does lower price increase volume?
- Does local pricing improve conversion?

### 5. Monitor Currency Fluctuations

For converted prices:
- Update rates regularly
- Set max/min boundaries
- Alert on significant changes

### 6. Communicate Clearly

Tell customers:
- Why prices differ
- What currency they're seeing
- How to change location

## Location Override

Let customers change their detected location:

```
┌─────────────────────────────────────┐
│  📍 Showing prices for: USA 🇺🇸     │
│                                     │
│  [Change Location]                  │
└─────────────────────────────────────┘
```

When clicked:
```
┌─────────────────────────────────────┐
│  Select Your Location               │
│                                     │
│  [🇺🇸 United States]                │
│  [🇬🇧 United Kingdom]               │
│  [🇪🇺 European Union]               │
│  [🇦🇺 Australia]                    │
│  [🇨🇦 Canada]                       │
│  [Other...]                         │
└─────────────────────────────────────┘
```

## Analytics by Location

Track geo performance:

```
┌─────────────────────────────────────────────────────────────┐
│  Revenue by Location                       Last 30 days    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Country         Revenue     Orders    Conv%    AOV        │
│  ─────────────────────────────────────────────────────     │
│  🇺🇸 USA         $45,678    456       2.5%    $100.17     │
│  🇬🇧 UK          £12,345    234       2.8%    £52.75      │
│  🇩🇪 Germany     €8,901     145       2.2%    €61.39      │
│  🇦🇺 Australia   $5,678     67        1.9%    $84.75      │
│  🇨🇦 Canada      $4,567     89        2.1%    $51.31      │
│                                                             │
│  Insights:                                                  │
│  • UK conversion 12% above average                         │
│  • Germany AOV opportunity - test bundle offers            │
│  • Australia needs shipping cost review                    │
└─────────────────────────────────────────────────────────────┘
```

## Troubleshooting

### Wrong location detected

1. User on VPN/proxy
2. IP database outdated
3. Mobile carrier IP routing
4. Corporate network

**Solution**: Allow manual override

### Prices not changing

1. Check rule priority
2. Verify location condition
3. Clear cache (browser + app)
4. Test in incognito

### Currency mismatch

1. Check Shopify Markets settings
2. Verify currency configuration
3. Review conversion settings
4. Check customer account currency

### Location rules conflicting

1. Review rule priorities
2. Check for overlapping conditions
3. Use specific rules over broad ones
4. Test each region separately

---

{% content-ref url="../pricing-rules/conditions.md" %}
[pricing-rules/conditions.md](../pricing-rules/conditions.md)
{% endcontent-ref %}

{% content-ref url="../analytics/README.md" %}
[analytics/README.md](../analytics/README.md)
{% endcontent-ref %}
