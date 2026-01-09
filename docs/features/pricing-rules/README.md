# Pricing Rules

Pricing Rules are the core feature of Tiered Pricing Pro. They allow you to create volume-based discounts that encourage customers to buy more.

## What are Pricing Rules?

A pricing rule defines:
- **Which products** get discounted
- **How much discount** at each quantity level
- **When** the discount applies

## How It Works

```
Customer adds 1 item → Regular price
Customer adds 3 items → 10% off each
Customer adds 5 items → 15% off each
Customer adds 10 items → 25% off each
```

The pricing table displays on product pages, showing customers exactly what they'll save at each quantity level.

## Example Pricing Table

| Quantity | Unit Price | Savings |
|----------|------------|---------|
| 1 | $20.00 | - |
| 2-4 | $18.00 | 10% |
| 5-9 | $17.00 | 15% |
| 10+ | $15.00 | 25% |

## Rule Components

### 1. Basic Information
- **Name**: Internal identifier
- **Priority**: Which rule wins if multiple match
- **Status**: Draft, Active, Paused, or Archived

### 2. Conditions
Define which products the rule applies to:
- All products
- Specific products
- Collections
- Product tags
- Customer tags (GROWTH+)

### 3. Discount Tiers
The actual discount levels:
- Minimum quantity
- Maximum quantity (optional)
- Discount type and value
- Custom message

## Discount Types

| Type | Description | Example |
|------|-------------|---------|
| **Percentage** | % off regular price | 15% off |
| **Fixed Amount** | $ off per item | $3 off each |
| **Fixed Price** | Set price per item | $7.99 each |

## Plan Limits

| Plan | Rules Allowed |
|------|---------------|
| FREE | 1 rule |
| GROWTH | Unlimited |
| PROFESSIONAL | Unlimited |

## Use Cases

### Retail / Consumer
- Buy more, save more promotions
- Seasonal sales with volume incentives
- Clear excess inventory

### Wholesale / B2B
- Tiered wholesale pricing
- Distributor discounts
- Quantity break pricing

### Subscription Boxes
- Multi-pack discounts
- Bundle savings

## Best Practices

1. **Start Simple**: Begin with 3-4 tiers maximum
2. **Clear Messaging**: Use simple, clear tier messages
3. **Test First**: Use draft mode before activating
4. **Monitor Performance**: Check analytics regularly
5. **Avoid Overlap**: Be careful with rule priority

## In This Section

{% content-ref url="creating-rules.md" %}
[creating-rules.md](creating-rules.md)
{% endcontent-ref %}

{% content-ref url="conditions.md" %}
[conditions.md](conditions.md)
{% endcontent-ref %}

{% content-ref url="tiers.md" %}
[tiers.md](tiers.md)
{% endcontent-ref %}

{% content-ref url="priority.md" %}
[priority.md](priority.md)
{% endcontent-ref %}
