# Import & Export

Backup your pricing configurations, migrate between stores, or bulk-manage rules using import and export functionality.

{% hint style="info" %}
**Plan Required:** PROFESSIONAL
{% endhint %}

## Overview

Import/Export allows you to:
- Backup all pricing rules and settings
- Migrate configurations between stores
- Bulk create/update rules via CSV
- Share configurations with team members
- Version control your pricing strategies

## Export Features

### What Can Be Exported

| Data Type | Included |
|-----------|----------|
| Pricing Rules | Name, conditions, tiers, settings |
| BOGO Offers | Configuration, products, discounts |
| Bundles | Products, pricing, display settings |
| Cart Progress | Goals, thresholds, rewards |
| Free Gifts | Triggers, gift products, conditions |
| Timers | Type, duration, display settings |
| Wholesale Rules | Customer tags, pricing tiers |
| A/B Tests | Variants, results (completed tests) |
| Settings | App settings, display preferences |

### Export Formats

**JSON (Full Backup)**
- Complete configuration
- Best for backup/restore
- Preserves all settings

**CSV (Rules Only)**
- Pricing rules in spreadsheet format
- Best for bulk editing
- Easy to modify in Excel

### How to Export

1. Go to **Settings > Import/Export**
2. Click **Export**
3. Select what to export:
   - All data
   - Specific feature (e.g., only pricing rules)
4. Choose format (JSON or CSV)
5. Click **Download**

### Export File Structure

**JSON Format:**
```json
{
  "version": "1.0",
  "exportDate": "2026-01-15T10:30:00Z",
  "shop": "your-store.myshopify.com",
  "data": {
    "pricingRules": [...],
    "bogoOffers": [...],
    "bundles": [...],
    "settings": {...}
  }
}
```

**CSV Format:**
```csv
rule_name,status,discount_type,discount_value,min_qty,max_qty,products,collections
"Buy More Save More",active,percentage,10,2,5,"prod_123,prod_456",""
"Wholesale 20%",active,percentage,20,1,,"","wholesale-collection"
```

## Import Features

### Import Process

1. Go to **Settings > Import/Export**
2. Click **Import**
3. Upload file (JSON or CSV)
4. Preview changes
5. Choose conflict resolution
6. Confirm import

### Preview Before Import

Before applying, you'll see:
```
┌─────────────────────────────────────────────────────────────┐
│  Import Preview                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📥 To be created: 5 rules                                 │
│  ✏️ To be updated: 3 rules                                 │
│  ⚠️ Conflicts: 2 rules                                     │
│  🗑️ Not in import: 1 rule (keep or delete?)               │
│                                                             │
│  Conflict Resolution:                                       │
│  ○ Skip conflicts (keep existing)                          │
│  ● Overwrite conflicts (use imported)                      │
│  ○ Create duplicates (import as new)                       │
│                                                             │
│  [Cancel]                    [Apply Import]                │
└─────────────────────────────────────────────────────────────┘
```

### Conflict Resolution

When imported rules match existing rules:

| Option | Behavior |
|--------|----------|
| Skip | Keep existing, ignore imported |
| Overwrite | Replace existing with imported |
| Duplicate | Create new rule alongside existing |
| Manual | Review each conflict individually |

### Validation

Import validates:
- File format correctness
- Required fields present
- Product/collection IDs exist
- Discount values are valid
- No circular references

**Validation Errors:**
```
⚠️ Import Validation Issues:

Line 3: Product "prod_999" not found in store
Line 7: Discount value "150%" exceeds 100%
Line 12: Missing required field "discount_type"

Fix these issues and try again, or import with warnings (skip invalid rows).
```

## CSV Bulk Editing

### CSV Template

Download template with all columns:
1. Go to Import/Export
2. Click **Download Template**
3. Open in Excel/Sheets

### CSV Columns

| Column | Required | Description |
|--------|----------|-------------|
| rule_id | No | Existing rule ID (for updates) |
| rule_name | Yes | Display name |
| status | Yes | active, inactive, draft |
| discount_type | Yes | percentage, fixed_amount, fixed_price |
| discount_value | Yes | Number (10 for 10% or $10) |
| min_quantity | No | Minimum quantity for discount |
| max_quantity | No | Maximum quantity (empty = unlimited) |
| products | No | Product IDs (comma-separated) |
| collections | No | Collection handles |
| customer_tags | No | Required customer tags |
| start_date | No | ISO date format |
| end_date | No | ISO date format |
| priority | No | Number (higher = more important) |

### Bulk Edit Workflow

1. **Export** current rules to CSV
2. **Edit** in Excel/Google Sheets
3. **Import** modified CSV
4. **Preview** changes
5. **Apply** updates

### CSV Examples

**Simple percentage discount:**
```csv
rule_name,status,discount_type,discount_value,min_quantity
"10% off 2+",active,percentage,10,2
"15% off 5+",active,percentage,15,5
"20% off 10+",active,percentage,20,10
```

**Product-specific rules:**
```csv
rule_name,status,discount_type,discount_value,products
"Widget A Promo",active,percentage,25,"gid://shopify/Product/123456"
"Widget B Promo",active,fixed_amount,10,"gid://shopify/Product/789012"
```

**Wholesale pricing:**
```csv
rule_name,status,discount_type,discount_value,customer_tags,priority
"Silver Tier",active,percentage,15,silver,50
"Gold Tier",active,percentage,25,gold,60
"Platinum Tier",active,percentage,35,platinum,70
```

## Migration Between Stores

### From Development to Production

1. Set up rules in development store
2. Test thoroughly
3. Export from development
4. Import to production
5. Update product/collection IDs if different
6. Verify and activate

### ID Mapping

If product IDs differ between stores:

**Option 1: SKU Matching**
- Export with SKUs
- Import matches by SKU
- Automatic ID resolution

**Option 2: Manual Mapping**
1. Export from source
2. Create mapping file (old ID → new ID)
3. Apply mapping to export file
4. Import with corrected IDs

**Option 3: Handle-Based**
- Use product/collection handles
- Handles often same across stores
- More portable than IDs

## Backup Strategy

### Regular Backups

Schedule regular exports:
- Weekly full backup
- Before major changes
- After significant updates

### Backup Naming Convention

```
tiered-pricing-backup-2026-01-15-full.json
tiered-pricing-backup-2026-01-15-rules-only.csv
```

### Restore from Backup

1. Upload backup file
2. Choose "Full Restore" mode
3. Confirm replacement of current config
4. All current rules replaced with backup

{% hint style="warning" %}
Full restore replaces ALL current configurations. Export current state first as safety backup.
{% endhint %}

## API Access (Professional)

### Export via API

```bash
curl -X GET \
  https://api.tieredpricing.app/v1/export \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json"
```

### Import via API

```bash
curl -X POST \
  https://api.tieredpricing.app/v1/import \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d @backup.json
```

### Webhook on Changes

Get notified when configurations change:
```json
{
  "webhook_url": "https://your-server.com/pricing-webhook",
  "events": ["rule.created", "rule.updated", "rule.deleted"]
}
```

## Best Practices

### 1. Export Before Major Changes

Always backup before:
- Bulk updates
- Seasonal changes
- Testing new strategies

### 2. Use Descriptive Names

Good naming helps identify backups:
```
✅ black-friday-2026-rules.json
✅ pre-holiday-season-full-backup.json
❌ backup.json
❌ rules.csv
```

### 3. Version Control

Consider storing backups in version control:
- Track changes over time
- Easy rollback
- Team visibility

### 4. Test Imports in Development

Before importing to production:
1. Create development store
2. Test import there
3. Verify everything works
4. Then import to production

### 5. Document Your Exports

Keep a log:
- Export date/time
- What was exported
- Reason for export
- Who performed it

## Troubleshooting

### Import failing

1. Check file format (JSON/CSV)
2. Validate file structure
3. Review error messages
4. Check for special characters
5. Ensure file encoding (UTF-8)

### Product IDs not matching

1. Export with SKUs/handles
2. Use mapping file
3. Update IDs before import
4. Use "skip invalid" option

### Large file timeout

For large exports:
1. Export in chunks (by feature)
2. Use API for large imports
3. Contact support for assistance

### Partial import

If import partially failed:
1. Note which items succeeded
2. Check error log for failures
3. Fix issues in source file
4. Re-import only failed items

---

{% content-ref url="../../settings/general.md" %}
[settings/general.md](../../settings/general.md)
{% endcontent-ref %}

{% content-ref url="../pricing-rules/README.md" %}
[pricing-rules/README.md](../pricing-rules/README.md)
{% endcontent-ref %}
