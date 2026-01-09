# AI Pricing

**Plan Required:** PROFESSIONAL

AI Pricing uses machine learning to analyze your store data and provide intelligent pricing recommendations.

## Overview

The AI Pricing system:

1. **Analyzes** your sales data, inventory, and market signals
2. **Generates** price adjustment recommendations
3. **Explains** the reasoning behind each suggestion
4. **Tracks** performance of applied changes

## How It Works

### Data Sources

The AI analyzes multiple signals:

| Signal | What It Measures |
|--------|------------------|
| **Sales Velocity** | How fast products are selling |
| **Inventory Level** | Stock quantity vs. typical demand |
| **Page Views** | Product interest/demand |
| **Conversion Rate** | Views to purchases ratio |
| **Price History** | Past price changes and their effects |
| **Seasonality** | Time-based demand patterns |
| **Competitor Prices** | Market positioning (if available) |

### The Algorithm

```
1. Collect data points
2. Normalize and weight each signal
3. Calculate confidence score
4. Generate price recommendation
5. Estimate revenue impact
```

### Confidence Score

Each recommendation includes a confidence score (0-100%):

| Score | Meaning | Recommended Action |
|-------|---------|-------------------|
| 90-100% | Very confident | Safe to auto-apply |
| 70-89% | Confident | Review before applying |
| 50-69% | Moderate | Careful consideration |
| <50% | Low | Manual decision needed |

## Insight Types

### Price Increase

**When Generated:**
- High demand, low inventory
- Strong sales velocity
- Low price elasticity

**Example:**
```
Product: Premium Widget
Current Price: $49.99
Suggested Price: $54.99 (+10%)
Confidence: 85%
Reason: High demand with low inventory.
        Sales velocity 3x average.
```

### Price Decrease

**When Generated:**
- Low demand, high inventory
- Slow sales velocity
- Competitive pressure

**Example:**
```
Product: Basic Widget
Current Price: $29.99
Suggested Price: $24.99 (-17%)
Confidence: 78%
Reason: Inventory above target, sales
        declining. Competitor at $22.99.
```

### Slow Mover Alert

**When Generated:**
- No sales in 30+ days
- High inventory
- No page views

**Example:**
```
Product: Seasonal Item
Current Price: $39.99
Suggested Price: $19.99 (-50%)
Confidence: 72%
Reason: No sales in 45 days, 200 units
        in stock. Consider clearance.
```

### Competitor Alert

**When Generated:**
- Your price significantly above/below market
- Competitor price change detected

**Example:**
```
Product: Popular Gadget
Current Price: $99.99
Market Average: $89.99
Suggested Price: $94.99 (-5%)
Confidence: 65%
Reason: Priced 11% above market average.
```

## Using AI Pricing

### Dashboard

The AI Pricing dashboard shows:

1. **Summary Stats**
   - Total insights generated
   - Pending review
   - Applied this month
   - Revenue impact

2. **Insights List**
   - Sortable by confidence, impact, date
   - Filter by type
   - Bulk actions available

3. **Performance Tracking**
   - Applied insights performance
   - A/B test results
   - Accuracy metrics

### Reviewing Insights

For each insight, you can:

- **Apply**: Accept the recommendation
- **Dismiss**: Reject (won't show again)
- **A/B Test**: Test the price change
- **Adjust**: Modify and apply

### Applying Recommendations

**Single Apply:**
1. Click on an insight
2. Review the details
3. Click "Apply"
4. Price updates in Shopify

**Bulk Apply:**
1. Select multiple insights
2. Click "Apply Selected"
3. Confirm the changes
4. All prices update

## Auto-Apply Rules

Set up automatic price adjustments for high-confidence insights.

### Configuration

1. Go to AI Pricing > Settings
2. Enable "Auto-Apply"
3. Set parameters:

| Setting | Description |
|---------|-------------|
| Min Confidence | Only apply above this score (e.g., 90%) |
| Max Price Change | Limit price movement (e.g., ±15%) |
| Min Margin | Protect profit margin (e.g., 20%) |
| Excluded Categories | Skip certain product types |
| Require Review | For changes above threshold |

### Safety Rails

Auto-apply includes safeguards:

- **Margin Protection**: Won't drop below minimum margin
- **Change Limits**: Maximum price change per period
- **Rollback**: Automatic reversal if performance drops
- **Audit Log**: All changes tracked

## A/B Testing Integration

Test AI recommendations before full rollout:

### How It Works

1. AI generates recommendation
2. Click "A/B Test" instead of "Apply"
3. System splits traffic:
   - 50% see current price
   - 50% see suggested price
4. After test period, see which performs better
5. Apply winner to all traffic

### Test Metrics

| Metric | Description |
|--------|-------------|
| Conversion Rate | Which price converts better |
| Revenue | Total revenue per variant |
| Profit | Accounting for margins |
| AOV | Impact on average order |

## Settings & Configuration

### AI Sensitivity

Adjust how aggressive recommendations are:

| Level | Behavior |
|-------|----------|
| Conservative | Smaller, safer changes |
| Balanced | Moderate recommendations |
| Aggressive | Larger potential changes |

### Signal Weights

Customize which signals matter most:

```
Demand Score: 25%
Inventory Level: 20%
Competitor Position: 20%
Conversion Rate: 15%
Margin Protection: 10%
Seasonality: 10%
```

### Exclusions

Exclude products from AI analysis:

- By collection
- By tag
- By price range
- By vendor

## Best Practices

### 1. Start Slow

Begin with manual review:
```
Week 1-2: Review and manually apply
Week 3-4: Enable auto-apply with high threshold (95%)
Month 2+: Gradually lower threshold
```

### 2. Protect Margins

Always set minimum margin:
```
Cost: $10
Min Margin: 30%
Min Price: $14.29
```

### 3. Monitor Performance

Weekly review:
- Check applied insight performance
- Review any price rollbacks
- Adjust settings as needed

### 4. Use A/B Tests

For high-impact products:
```
Revenue > $1000/month
Price change > 15%
→ Always A/B test first
```

## Analytics

### Performance Dashboard

Track AI effectiveness:

- **Accuracy Rate**: How often AI was right
- **Revenue Impact**: $ change from applied insights
- **Margin Impact**: Profit change
- **Insights Applied**: Total adoptions

### Individual Insight Tracking

Each applied insight shows:

- Before/after price
- Sales before/after
- Revenue change
- Margin change
- Days since applied

## Troubleshooting

### Few Insights Generated

**Causes:**
- Not enough sales data
- Products recently added
- Small product catalog

**Solutions:**
- Wait for more data (30+ days)
- Ensure analytics tracking works
- Check product is not excluded

### Low Confidence Scores

**Causes:**
- Inconsistent sales patterns
- Limited data points
- High price elasticity

**Solutions:**
- These may still be worth reviewing
- Use A/B testing for validation
- Consider manual analysis

### Incorrect Recommendations

**If AI suggests wrong price:**

1. Dismiss the insight
2. Check exclusion settings
3. Review signal weights
4. Contact support if persistent

## In This Section

{% content-ref url="how-it-works.md" %}
[how-it-works.md](how-it-works.md)
{% endcontent-ref %}

{% content-ref url="insights.md" %}
[insights.md](insights.md)
{% endcontent-ref %}

{% content-ref url="auto-apply.md" %}
[auto-apply.md](auto-apply.md)
{% endcontent-ref %}

{% content-ref url="confidence.md" %}
[confidence.md](confidence.md)
{% endcontent-ref %}
