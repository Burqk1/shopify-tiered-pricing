# General Settings

Configure the core settings for Tiered Pricing Pro to customize how the app works with your store.

## Accessing Settings

1. Open Tiered Pricing Pro app
2. Click **Settings** in the sidebar
3. Select **General** tab

## Display Settings

### Currency Display

Configure how prices and discounts appear:

**Currency Symbol Position:**
- Before amount: $100
- After amount: 100$

**Decimal Places:**
- 0 decimals: $100
- 2 decimals: $100.00

**Thousand Separator:**
- Comma: $1,000
- Period: $1.000
- Space: $1 000

### Price Display

**Show Original Price:**
- ON: Shows crossed-out original price
- OFF: Shows only discounted price

```
ON:  $̶1̶0̶0̶  $80
OFF: $80
```

**Show Savings:**
- Amount: "Save $20"
- Percentage: "Save 20%"
- Both: "Save $20 (20%)"
- None: Don't show savings

**Pricing Table Style:**
- Table format
- List format
- Compact badges
- Custom (CSS)

### Language

**App Language:**
Select your preferred language:
- English
- Türkçe
- Español
- Français
- Deutsch
- Português
- Italiano
- Nederlands
- 日本語
- 한국어

**Translate Customer-Facing Text:**
Customize all text shown to customers in their language.

## Discount Settings

### Calculation Method

**Based on:**
- Original price (before other discounts)
- Current price (after other discounts)

**Example:**
```
Product: $100
Other discount: 10% off ($90)
Tiered discount: 20%

Original price based: $100 × 20% = $20 off → $70
Current price based: $90 × 20% = $18 off → $72
```

### Rounding Rules

**Round to:**
- Nearest cent (default)
- Nearest 5 cents
- Nearest 10 cents
- Whole number

**Rounding Direction:**
- Nearest (default)
- Always up
- Always down

**Example (Nearest 10, Down):**
```
Calculated: $87.34
Rounded: $87.30
```

### Stacking with Discount Codes

**Global Setting:**
- Allow stacking (both discounts apply)
- Best price only (whichever saves more)
- Tiered pricing only (ignore codes)
- Discount codes only (ignore tiered)

{% hint style="info" %}
This can be overridden per rule.
{% endhint %}

## Cart & Checkout

### Cart Behavior

**Update Cart Automatically:**
- ON: Discounts update as quantities change
- OFF: Customer must refresh/update

**Show Discount Line Item:**
- Combined: One "Volume Discount" line
- Per product: Separate line per discounted item
- Hidden: Discount applied but not shown separately

### Checkout Integration

**Discount Application:**
- Shopify Functions (recommended)
- Draft order (legacy)
- Discount code generation

**Show Discount in Checkout:**
- As line item discount
- As order discount
- As automatic discount code

## Product Page

### Pricing Table

**Show Pricing Table:**
- ON: Display tier table on product pages
- OFF: Hide table, discounts still apply

**Table Position:**
- Below product title
- Below price
- Above add to cart
- Below add to cart
- Custom (selector)

**Table Format:**
| Setting | Example |
|---------|---------|
| Show quantity | "Buy 2+" |
| Show discount | "10% off" |
| Show price | "$45.00 each" |
| Show savings | "Save $10" |

### Stock Visibility

**Show Stock for Tiers:**
- ON: "Only 5 left at this tier"
- OFF: Don't show stock warnings

## Notifications

### Email Notifications

**Send notifications for:**
- [ ] Large discount applications
- [ ] Rule errors/issues
- [ ] Low inventory on discounted items
- [ ] Weekly performance summary

**Email Address:**
[your-email@example.com]

### In-App Notifications

**Show alerts for:**
- Rule conflicts
- Performance milestones
- Feature suggestions
- System updates

## Performance

### Caching

**Cache Duration:**
- 5 minutes (most accurate)
- 15 minutes (balanced)
- 1 hour (best performance)
- Manual clear only

**Clear Cache:**
[Clear Now] - Force refresh all pricing calculations

### Lazy Loading

**Load pricing tables:**
- Immediately (slower page load)
- On scroll (when visible)
- On interaction (on hover/click)

## Data & Privacy

### Data Retention

**Keep analytics data for:**
- 30 days
- 90 days
- 1 year
- Forever

### Customer Data

**Store customer data:**
- Minimal (orders only)
- Standard (orders + behavior)
- Full (all interactions)

**Data Deletion:**
[Request Data Deletion] - Remove all stored data

## Advanced Settings

### Debug Mode

**Enable Debug Mode:**
- ON: Detailed logging for troubleshooting
- OFF: Normal operation

{% hint style="warning" %}
Debug mode may slow down your store. Only enable when troubleshooting.
{% endhint %}

### API Access

**Enable API:**
- ON: Allow external API access
- OFF: Disable API endpoints

**API Key:**
[Generate New Key]

### Custom CSS

Add custom styling to pricing elements:
```css
.tiered-pricing-table {
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.tiered-pricing-badge {
  background-color: #ff6b6b;
  color: white;
}
```

### Custom JavaScript

Add custom behavior (advanced):
```javascript
window.TieredPricing.on('tierApplied', function(data) {
  console.log('Tier applied:', data);
  // Custom tracking, etc.
});
```

## Saving Settings

1. Make your changes
2. Click **Save Settings**
3. Changes apply immediately

{% hint style="info" %}
Some settings (like checkout integration) may require a few minutes to propagate.
{% endhint %}

## Reset to Defaults

To reset all settings:
1. Scroll to bottom of settings page
2. Click **Reset to Defaults**
3. Confirm the action

{% hint style="warning" %}
This will reset ALL settings to their original values. This cannot be undone.
{% endhint %}

---

{% content-ref url="language.md" %}
[language.md](language.md)
{% endcontent-ref %}

{% content-ref url="billing.md" %}
[billing.md](billing.md)
{% endcontent-ref %}
