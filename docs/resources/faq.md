# Frequently Asked Questions

Find answers to common questions about Tiered Pricing Pro.

## General Questions

### What is Tiered Pricing Pro?

Tiered Pricing Pro is a Shopify app that helps you create volume-based discounts, BOGO offers, product bundles, and many other pricing strategies to increase your average order value and sales.

### Which Shopify plans does it work with?

The app works with all Shopify plans: Basic, Shopify, Advanced, and Plus.

### Does it work with Shopify POS?

Yes! Tiered pricing works with Shopify POS. Your staff will see tiered prices and can apply volume discounts at the point of sale.

### Is there a free trial?

Yes, new users get a 7-day free trial of GROWTH features. No credit card required during the trial.

### How does billing work?

All charges go through Shopify's billing system. You'll see the charge on your regular Shopify invoice, and you can cancel anytime.

---

## Pricing Rules

### How many rules can I create?

- **FREE plan**: 1 rule
- **GROWTH plan**: Unlimited
- **PROFESSIONAL plan**: Unlimited

### Can I have multiple rules on the same product?

Yes, but only one rule applies at a time. The rule with the highest priority wins. See [Priority & Stacking](../features/pricing-rules/priority.md).

### Do discounts apply automatically?

Yes, once a rule is active, discounts apply automatically in the cart when conditions are met. Customers see a pricing table on product pages.

### Can customers combine volume discounts with discount codes?

This is configurable per rule. You can enable or disable "stacking" with Shopify discount codes.

### Why isn't my rule showing on the product page?

Check:
1. Rule status is "Active"
2. Product matches the rule conditions
3. Theme app extension is enabled
4. Clear browser cache

---

## BOGO & Bundles

### What's the difference between BOGO and Bundles?

- **BOGO**: Buy X items, get Y items free/discounted (same or different products)
- **Bundles**: Pre-defined product groups sold together at a discount

### Can BOGO work across different products?

Yes! You can set up "Buy 2 Shirts, Get 1 Free" where any shirt counts toward the buy quantity.

### How is the free item determined in BOGO?

The lowest-priced item is typically made free/discounted to protect your margins.

---

## B2B / Wholesale

### How do I identify wholesale customers?

Use Shopify customer tags. Tag customers with "wholesale", "vip", or any custom tag, then create rules targeting that tag.

### Do wholesale customers need to log in?

Yes, customer tag rules only work when the customer is logged into their account.

### Can I have multiple customer tiers?

Yes! Create separate rules with different priorities:
- "silver" customers: 15% off (priority 50)
- "gold" customers: 25% off (priority 60)
- "platinum" customers: 35% off (priority 70)

---

## AI Pricing (Professional)

### How does AI Pricing work?

The AI analyzes your sales data, inventory levels, and market signals to generate pricing recommendations. Each suggestion includes a confidence score and reasoning.

### Will AI change my prices automatically?

Only if you enable auto-apply. By default, all recommendations require manual review and approval.

### How accurate are the AI recommendations?

Our AI averages 75-85% accuracy. We recommend starting with manual review, then gradually enabling auto-apply for high-confidence suggestions.

### What data does the AI use?

- Sales history
- Inventory levels
- Page views
- Conversion rates
- Price history
- Seasonality patterns

---

## Technical Questions

### Does the app slow down my store?

No. The app uses efficient caching and only loads necessary resources. Most calculations happen server-side.

### Does it work with headless/custom storefronts?

The app is optimized for standard Shopify themes. For headless setups, contact support about API access (Professional plan).

### What happens to my rules if I uninstall?

All rules and data are deleted when you uninstall. We recommend exporting your rules before uninstalling.

### Is my data secure?

Yes. We follow Shopify's security requirements, use encrypted connections, and never share your data with third parties.

---

## Troubleshooting

### Discount not appearing in cart

1. Verify rule is "Active"
2. Check product matches conditions
3. Ensure quantity meets minimum tier
4. Clear browser cache
5. Check for conflicting rules

### Pricing table not showing on product page

1. Go to Shopify Admin > Online Store > Themes
2. Click "Customize" on your active theme
3. Look for "App embeds" or "Theme extensions"
4. Enable "Tiered Pricing" extension
5. Save and refresh

### Wrong discount amount

1. Check tier configuration
2. Verify discount type (% vs $)
3. Check rule priority against other rules
4. Ensure correct quantity range

### Customer tag rule not working

1. Confirm customer is logged in
2. Verify tag spelling (case-sensitive)
3. Check customer has the tag in Shopify Admin
4. Clear cache and retry

---

## Account & Billing

### How do I upgrade my plan?

1. Go to Settings > Billing & Plans
2. Click "Upgrade" on your desired plan
3. Approve the charge in Shopify

### How do I cancel?

1. Go to Settings > Billing & Plans
2. Click "Cancel Subscription"
3. Access continues until billing period ends
4. Downgrades to FREE plan

### Will I lose my rules if I downgrade?

No, rules are preserved but paused if they exceed your plan limit. Upgrade again to reactivate them.

### Can I get a refund?

Contact Shopify support for billing issues. Refunds are handled through Shopify's billing system.

---

## Still Have Questions?

- **Email**: contact@novamentstudios.com
- **In-app Chat**: Available during business hours
- **Documentation**: You're already here!

{% content-ref url="troubleshooting.md" %}
[troubleshooting.md](troubleshooting.md)
{% endcontent-ref %}

{% content-ref url="support.md" %}
[support.md](support.md)
{% endcontent-ref %}
