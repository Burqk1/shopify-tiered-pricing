# A/B Testing

Test different pricing strategies scientifically to find what maximizes your revenue. A/B testing removes guesswork by showing different prices to different customer segments and measuring results.

{% hint style="info" %}
**Plan Required:** GROWTH or PROFESSIONAL
{% endhint %}

## What is A/B Testing?

A/B testing (split testing) divides your traffic into groups that see different prices. After enough data, you can see which price performs better.

```
Group A (50% of visitors): Product at $29.99
Group B (50% of visitors): Product at $34.99

Results after 1000 visitors:
- Group A: 50 sales = $1,499.50 revenue
- Group B: 38 sales = $1,329.62 revenue
- Winner: Group A (12.8% more revenue)
```

## Why Test Prices?

- **Remove guesswork** - Data beats intuition
- **Optimize revenue** - Find the profit-maximizing price
- **Understand elasticity** - Learn how price affects demand
- **Test promotions** - See if discounts increase profit
- **Segment insights** - Different prices for different customers

## Creating an A/B Test

### Step 1: Navigate to A/B Testing

1. Go to **A/B Testing** in the sidebar
2. Click **Create Test**

### Step 2: Test Configuration

**Test Name**: Descriptive name (e.g., "Winter Jacket Pricing Test")

**Test Type**:
- Single product
- Collection/category
- Site-wide

### Step 3: Define Variants

**Control (A)**: Current price or strategy
**Variant (B)**: New price or strategy

**Example:**
```
Control A: $49.99 (current price)
Variant B: $44.99 (10% lower)
```

**Multiple Variants (A/B/C/n):**
```
A: $39.99
B: $44.99
C: $49.99
D: $54.99
```

### Step 4: Traffic Split

**Even Split** (recommended):
- 50/50 for two variants
- 33/33/34 for three variants

**Weighted Split**:
- 80/20 to limit exposure to new price
- Use when testing risky changes

### Step 5: Success Metrics

**Primary Metric** (pick one):
- Revenue per visitor
- Conversion rate
- Average order value
- Units sold

**Secondary Metrics** (track these too):
- Add-to-cart rate
- Cart abandonment
- Return rate

### Step 6: Test Duration

**Minimum Duration**: 7 days (recommended)

**Sample Size Calculator:**
- Current conversion rate
- Minimum detectable effect
- Statistical significance level

```
With 2% conversion and 10% minimum effect:
Need ~15,000 visitors per variant
```

### Step 7: Launch Test

1. Review all settings
2. Click **Start Test**
3. Monitor results in dashboard

## Reading Test Results

### Dashboard View

```
┌─────────────────────────────────────────────────────────┐
│  Winter Jacket Pricing Test                             │
│  Status: Running (Day 5 of 14)                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Variant A ($49.99)          Variant B ($44.99)         │
│  ─────────────────           ─────────────────          │
│  Visitors: 2,340             Visitors: 2,356            │
│  Conversions: 47 (2.0%)      Conversions: 59 (2.5%)     │
│  Revenue: $2,349.53          Revenue: $2,654.41         │
│  RPV: $1.00                  RPV: $1.13 (+12.5%)        │
│                                                         │
│  Statistical Significance: 89%                          │
│  ⚠️ Need more data for conclusive results              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Key Metrics Explained

| Metric | Definition | Why It Matters |
|--------|------------|----------------|
| Visitors | People who saw variant | Sample size |
| Conversions | Purchases made | Demand signal |
| Conversion Rate | Conversions / Visitors | Price sensitivity |
| Revenue | Total sales | Primary goal |
| RPV | Revenue / Visitors | Best overall metric |
| AOV | Revenue / Conversions | Basket size impact |

### Statistical Significance

- **< 90%**: Not enough data, keep running
- **90-95%**: Likely winner, but consider continuing
- **> 95%**: Confident result, can end test
- **> 99%**: Very confident, implement winner

{% hint style="warning" %}
Ending tests too early leads to false conclusions. Wait for statistical significance.
{% endhint %}

## Test Ideas

### Price Point Testing

Find optimal price:
```
Test: Product currently $50
A: $45 (-10%)
B: $50 (control)
C: $55 (+10%)
```

### Discount Depth Testing

How much discount is optimal?
```
Test: Volume discount depth
A: Buy 2, get 10% off
B: Buy 2, get 15% off
C: Buy 2, get 20% off
```

### Threshold Testing

Optimal tier breakpoints:
```
Test: When does discount kick in?
A: Buy 3+ for discount
B: Buy 5+ for discount
C: Buy 10+ for discount
```

### Free Shipping Threshold

Where to set free shipping:
```
Test: Free shipping threshold
A: Free shipping at $50
B: Free shipping at $75
C: Free shipping at $100
```

### Display Format Testing

How to show the discount:
```
Test: Price presentation
A: "20% off"
B: "Save $10"
C: "$40 (was $50)"
```

## Best Practices

### 1. Test One Variable

Change only one thing per test:
- ✅ $29.99 vs $34.99 (price only)
- ❌ $29.99 with badge vs $34.99 without badge (two variables)

### 2. Run Tests Long Enough

Minimum guidelines:
- 7 days minimum (capture weekly patterns)
- 100+ conversions per variant
- 95% statistical significance

### 3. Avoid Peeking Too Often

- Don't make decisions on early data
- Set end date and stick to it
- Check weekly, not hourly

### 4. Consider Seasonality

- Don't start tests during sales events
- Account for weekly patterns
- Compare similar time periods

### 5. Document Everything

For each test, record:
- Hypothesis
- Start/end dates
- Traffic conditions
- Winner and confidence
- Implementation decision

### 6. Implement Winners Quickly

Once test concludes:
1. Stop test immediately
2. Implement winning variant
3. Monitor post-implementation
4. Plan next test

## Advanced Testing

### Multi-Variant Testing (A/B/n)

Test more than two options:
- Requires more traffic
- Finds global optimum
- Takes longer to reach significance

### Segment Testing

Different tests for different audiences:
```
New Customers:
  A: $39.99 (acquisition focus)
  B: $49.99

Returning Customers:
  A: $49.99 (loyalty pricing)
  B: $54.99
```

### Sequential Testing

Build on previous results:
```
Test 1: $40 vs $50 → Winner: $50
Test 2: $50 vs $55 → Winner: $50
Test 3: $48 vs $50 vs $52 → Winner: $50
Conclusion: Optimal price ≈ $50
```

### Bandit Algorithms

Auto-optimize during test:
- Automatically shifts traffic to winner
- Reduces "regret" (lost revenue)
- Faster to find winner

{% hint style="info" %}
Bandit testing available on PROFESSIONAL plan.
{% endhint %}

## Integration with AI Pricing

Connect A/B testing to AI insights:

### Test AI Recommendations

1. AI suggests price change
2. Instead of applying, create A/B test
3. Test validates or refutes AI
4. AI learns from results

### Automatic Testing

With PROFESSIONAL plan:
- AI creates tests automatically
- High-confidence suggestions tested
- Results improve AI accuracy

## Analytics & Reporting

### Test History

View all past tests:
- Completed tests
- Winners implemented
- Revenue impact
- Learnings captured

### Revenue Attribution

Calculate test impact:
```
Test Winner: Variant B
Lift: +12% revenue per visitor
Monthly visitors: 50,000
Projected monthly gain: $6,000
Annual impact: $72,000
```

### Export Data

Download raw data for:
- Further analysis
- Presentation to stakeholders
- Historical records

## Troubleshooting

### Results seem wrong

1. Check tracking is correct
2. Verify traffic split is working
3. Look for bot/fraud traffic
4. Ensure variants are actually different

### Test won't reach significance

1. Need more traffic
2. Effect size too small to detect
3. Consider ending as "no significant difference"
4. Run longer or increase traffic

### Variant showing to wrong visitors

1. Check targeting conditions
2. Clear browser cookies
3. Verify customer segmentation
4. Review variant assignment logic

### Revenue tracking issues

1. Ensure orders attribute to correct variant
2. Check for refunds/chargebacks
3. Verify currency conversion
4. Review order tagging

---

{% content-ref url="../ai-pricing/README.md" %}
[ai-pricing/README.md](../ai-pricing/README.md)
{% endcontent-ref %}

{% content-ref url="../pricing-rules/README.md" %}
[pricing-rules/README.md](../pricing-rules/README.md)
{% endcontent-ref %}
