# Language Settings

Customize all customer-facing text and support multiple languages for your international customers.

## App Language

### Changing App Language

1. Go to **Settings > Language**
2. Select your preferred language from the dropdown
3. Click **Save**

**Supported Languages:**
- 🇺🇸 English (default)
- 🇹🇷 Türkçe
- 🇪🇸 Español
- 🇫🇷 Français
- 🇩🇪 Deutsch
- 🇵🇹 Português
- 🇮🇹 Italiano
- 🇳🇱 Nederlands
- 🇯🇵 日本語
- 🇰🇷 한국어

This changes the admin interface language.

## Customer-Facing Translations

### Translation Editor

Customize text shown to your customers:

1. Go to **Settings > Language**
2. Scroll to **Customer Translations**
3. Select the language to edit
4. Modify any text field
5. Click **Save Translations**

### Available Text Fields

#### Pricing Table

| Key | Default (English) | Purpose |
|-----|-------------------|---------|
| `table.title` | "Volume Pricing" | Table header |
| `table.quantity` | "Quantity" | Qty column header |
| `table.price` | "Price" | Price column header |
| `table.savings` | "Savings" | Savings column header |
| `table.each` | "each" | Per-item suffix |
| `table.orMore` | "or more" | Quantity suffix |

#### Discount Display

| Key | Default (English) | Purpose |
|-----|-------------------|---------|
| `discount.save` | "Save" | Before savings amount |
| `discount.off` | "off" | After discount percent |
| `discount.was` | "Was" | Before original price |
| `discount.now` | "Now" | Before discounted price |
| `discount.free` | "FREE" | Free item label |

#### Cart Messages

| Key | Default (English) | Purpose |
|-----|-------------------|---------|
| `cart.discountApplied` | "Volume discount applied" | Confirmation message |
| `cart.addMore` | "Add {qty} more for {discount}" | Upsell message |
| `cart.unlocked` | "You've unlocked {discount}!" | Achievement message |

#### BOGO

| Key | Default (English) | Purpose |
|-----|-------------------|---------|
| `bogo.buy` | "Buy" | Buy X prefix |
| `bogo.get` | "Get" | Get Y prefix |
| `bogo.free` | "FREE" | Free item label |
| `bogo.halfOff` | "50% off" | Half price label |

#### Cart Progress

| Key | Default (English) | Purpose |
|-----|-------------------|---------|
| `progress.spend` | "Spend {amount} more" | Amount remaining |
| `progress.unlock` | "to unlock {reward}" | Reward description |
| `progress.unlocked` | "You've unlocked {reward}!" | Success message |
| `progress.freeShipping` | "FREE SHIPPING" | Shipping reward |

#### Free Gifts

| Key | Default (English) | Purpose |
|-----|-------------------|---------|
| `gift.unlocked` | "FREE GIFT unlocked!" | Gift earned |
| `gift.addedToCart` | "Gift added to your cart" | Confirmation |
| `gift.spendMore` | "Spend {amount} more for a FREE GIFT" | Progress |
| `gift.value` | "Value: {amount}" | Gift value display |

#### Timers

| Key | Default (English) | Purpose |
|-----|-------------------|---------|
| `timer.endsIn` | "Ends in" | Timer prefix |
| `timer.days` | "days" | Days label |
| `timer.hours` | "hours" | Hours label |
| `timer.minutes` | "min" | Minutes label |
| `timer.seconds` | "sec" | Seconds label |
| `timer.expired` | "Offer expired" | Expiration message |

#### Bundles

| Key | Default (English) | Purpose |
|-----|-------------------|---------|
| `bundle.title` | "Frequently Bought Together" | Section title |
| `bundle.total` | "Bundle Price" | Total label |
| `bundle.save` | "Save {amount}" | Savings display |
| `bundle.addAll` | "Add All to Cart" | Button text |

### Variable Placeholders

Use these placeholders in your translations:

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{amount}` | Money amount | $25.00 |
| `{qty}` | Quantity | 3 |
| `{discount}` | Discount text | 10% off |
| `{reward}` | Reward name | Free Shipping |
| `{product}` | Product name | Widget A |

**Example:**
```
"Add {qty} more to save {amount}!"
→ "Add 2 more to save $10.00!"
```

## Multi-Language Stores

### Automatic Language Detection

The app automatically detects customer language from:
1. Shopify store locale
2. Browser language settings
3. Customer account preferences

### Setting Up Multiple Languages

1. Go to **Settings > Language**
2. Click **Add Language**
3. Select language from dropdown
4. Translate all text fields
5. Click **Save**

### Language Fallback

If a translation is missing:
1. Check for regional variant (es-MX → es)
2. Fall back to English
3. Use translation key as last resort

### Right-to-Left (RTL) Support

For RTL languages (Arabic, Hebrew):
- Layout automatically mirrors
- Text alignment adjusts
- Tables reverse direction

## Translation Tips

### 1. Keep It Concise

Space is limited, especially on mobile:
- ✅ "Save $10"
- ❌ "You will save ten dollars on this purchase"

### 2. Consider Context

Same word may need different translations:
- "Free" (adjective): "Gratuit" (French)
- "Free" (verb): "Libérer" (French)

### 3. Test on Device

Always preview translations:
- On desktop
- On mobile
- In cart
- At checkout

### 4. Handle Plurals

Some languages need plural forms:
```
English:
  1 item, 2 items

Russian:
  1 товар, 2 товара, 5 товаров
```

Contact support for plural support.

### 5. Use Native Speakers

For best results:
- Have native speakers review
- Test with real customers
- Get feedback

## Import/Export Translations

### Export Translations

Download all translations as JSON:
1. Go to **Settings > Language**
2. Click **Export Translations**
3. Save the JSON file

### Import Translations

Upload translations file:
1. Go to **Settings > Language**
2. Click **Import Translations**
3. Select JSON file
4. Review and confirm

### Translation File Format

```json
{
  "en": {
    "table.title": "Volume Pricing",
    "table.quantity": "Quantity",
    "discount.save": "Save",
    ...
  },
  "es": {
    "table.title": "Precios por Volumen",
    "table.quantity": "Cantidad",
    "discount.save": "Ahorra",
    ...
  }
}
```

## Reset Translations

To reset to defaults:
1. Go to **Settings > Language**
2. Select language to reset
3. Click **Reset to Defaults**
4. Confirm action

This resets only customer-facing text for that language.

---

{% content-ref url="general.md" %}
[general.md](general.md)
{% endcontent-ref %}

{% content-ref url="billing.md" %}
[billing.md](billing.md)
{% endcontent-ref %}
