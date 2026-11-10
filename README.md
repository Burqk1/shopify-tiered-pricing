# Tiered Pricing Pro - Shopify App

A Shopify app for quantity-based (tiered/volume) discounts, plus a set of admin tools for related promotions: bundles, countdown timers, BOGO offers, gift-with-purchase, geo rules, B2B customer groups, A/B tests, upsell offers and pricing suggestions.

The core flow is complete end to end: you create a tiered pricing rule in the admin, the rule is stored in PostgreSQL and synced to a Shopify metaobject, an automatic app discount backed by a Shopify Function applies it at checkout, and theme app blocks show the tiers on the product page. Several of the other modules are currently admin-side only (see [Feature status](#feature-status)).

## Feature status

| Module | Admin UI | Applied in storefront / checkout |
|---|---|---|
| Tiered / volume pricing rules | Yes | Yes, via the `tiered-discount` Shopify Function (product and all-products conditions) and the theme blocks |
| Theme app blocks (tier table, badges, sale price, quantity / add-to-cart enhancers, cart progress, free shipping bar, announcement progress) | Configured in the theme editor | Yes |
| POS extension (tier info on product details, savings after purchase) | - | Yes, Shopify POS |
| Analytics (discount usage, product analytics sync, CSV export) | Yes | Data pulled from Shopify orders/products |
| Pricing suggestions ("AI Pricing") | Yes | Optional auto-apply updates variant prices through the Admin API |
| Bundles, countdown timers, BOGO, gift with purchase, geo targeting, cart progress rules | Yes (CRUD, stored in the database) | No checkout logic or storefront rendering in this repo yet |
| B2B / wholesale customer groups | Create / delete groups (tag, discount, min order, tax-exempt flag, net terms) | Not enforced; customer tag conditions are not read by the discount function |
| A/B testing | Create tests, split percentage, pick winner | Variant assignment / event tracking functions exist but nothing on the storefront calls them |
| Post-purchase upsells | Offer management | No post-purchase checkout extension in this repo |
| Import / export | Yes | - |

Known gaps in the tiered pricing path:

- Collection conditions can be selected in the rule editor, but neither the discount function nor the app proxy endpoint match collections yet (both have a comment noting this). Only `PRODUCT` and `ALL_PRODUCTS` conditions take effect.
- The automatic discount created from **Discounts > new** stores a copy of the rule config in the discount's metafield. Editing the rule afterwards re-syncs the metaobject, but there is no code that updates an existing discount's metafield.

## Tech stack

- Remix (Vite) + React 18 + TypeScript
- Shopify Polaris, App Bridge, `@shopify/shopify-app-remix`
- PostgreSQL via Prisma (session storage also in Prisma)
- Shopify Function (JavaScript) for the product discount, theme app extension (Liquid), POS UI extension
- Vitest + Testing Library for tests
- Deployment config for Vercel (`vercel.json`, including a daily cron)

Admin UI translations: English, Turkish, German, French, Spanish, Italian, Portuguese, Dutch, Japanese, Chinese (`app/i18n/translations.ts`). The theme extension ships locales for en, tr, de, es, fr; the POS extension for en and tr.

## Prerequisites

- Node.js 20+
- A PostgreSQL database
- A Shopify Partner account and a development store
- Shopify CLI (installed as a dev dependency, used through `npm run dev`)

## Setup

```bash
git clone https://github.com/Burqk1/shopify-tiered-pricing.git
cd shopify-tiered-pricing

npm install            # also runs `prisma generate`

cp .env.example .env   # then fill in the values below

npm run setup          # prisma generate + prisma migrate deploy
npm run dev            # shopify app dev
```

`shopify.app.toml` contains the original app's `client_id`, production URLs on `tiered-pricing-pro.vercel.app` and a specific `dev_store_url`. Point these at your own app (for example with `shopify app config link`) before running `npm run dev`.

The discount function and POS extension have their own `package.json` files under `extensions/`; install their dependencies as well if you build or test them separately.

### Environment variables

| Variable | Used for |
|---|---|
| `SHOPIFY_API_KEY` | App API key |
| `SHOPIFY_API_SECRET` | App secret, also used to verify app proxy signatures |
| `SHOPIFY_APP_URL` | Public app URL (falls back to `HOST`). Note: `.env.example` calls this `APP_URL`, but the code reads `SHOPIFY_APP_URL`. |
| `SCOPES` | Comma-separated scopes. Defaults in code match `shopify.app.toml`: `write_products,read_products,write_discounts,read_discounts,write_customers,read_customers,read_metaobjects,write_metaobjects` |
| `DATABASE_URL` | PostgreSQL connection string. `db.server.ts` also accepts `DATABASE_POSTGRES_PRISMA_URL`, `DATABASE_POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL` or `DATABASE_URL_UNPOOLED` (Vercel/Neon style names). |
| `CRON_SECRET` | Protects `/api/cron/analytics-sync`. Falls back to a placeholder string if unset, so set it in production. |
| `SHOP_CUSTOM_DOMAIN` | Optional custom shop domain |
| `LOG_LEVEL` | Optional, default `info` |
| `NODE_ENV` | `production` enables app proxy signature checks and real (non-test) billing charges |

## Usage

### Creating a tiered pricing rule

1. Open **Pricing Rules** and create a rule.
2. Pick the condition: specific products or all products (collections are selectable but not yet applied, see above).
3. Add tiers, for example 1-4: no discount, 5-9: 10% off, 10+: 20% off.
4. Save. If you choose to activate the rule right away, active rules are synced to the `tiered_pricing_rules` metaobject (activating or editing a rule later from its page also triggers a sync).
5. Create an automatic discount for the rule under **Discounts** so the Shopify Function applies it at checkout.
6. Add the **Volume Discount Table** (or the other blocks) to the product template in the theme editor.

The free plan is limited to one rule.

### B2B / wholesale groups

Under **B2B/Wholesale** you can create customer groups identified by a Shopify customer tag, with a base discount, minimum order value, tax-exempt flag and net terms in days. These are stored only; nothing currently applies them at checkout. There is a `WholesaleApplication` model and a pending-applications counter, but no signup form or route that creates applications.

### A/B testing

Under **A/B Testing** you can create a test with control and variant pricing and a split percentage, change its status and select a winner. Storefront assignment and tracking are not wired up, so results will stay empty until that integration exists.

## API endpoints

### App proxy: product tiers

The theme blocks call this through the Shopify app proxy (`/apps/tiered-pricing/*` maps to `<app>/api/*`):

```
GET /apps/tiered-pricing/product-tiers?product_id={id}
```

Shopify adds `shop` and `signature` to proxied requests; the signature is checked when `NODE_ENV=production`.

Response:

```json
{
  "tiers": [
    { "min": 1, "max": 4, "valueType": "PERCENTAGE", "value": 0, "message": null },
    { "min": 5, "max": 9, "valueType": "PERCENTAGE", "value": 10, "message": "Save 10%!" }
  ],
  "ruleName": "Summer Sale"
}
```

If no rule matches, the response is `{ "tiers": [] }`.

### Other routes

- `/api/pos-tiers` - tier data for the POS extension
- `/api/analytics-export` - analytics CSV export
- `/api/cron/analytics-sync` - daily analytics sync (scheduled at 02:00 in `vercel.json`), requires `Authorization: Bearer <CRON_SECRET>`
- `/api/health` - health check
- `/webhooks/app/uninstalled` and the three GDPR compliance webhooks (`customers/data_request`, `customers/redact`, `shop/redact`)
- `/privacy` - privacy policy page

### Rate limits

In-memory rate limiting (`app/services/rate-limiter.server.ts`), per server instance:

| Scope | Limit | Window | Applied to |
|---|---|---|---|
| `appProxy` | 120 requests | 1 min | `/api/product-tiers` |
| `api` | 60 requests | 1 min | `/api/pos-tiers` |
| `sync` | 10 requests | 1 min | Metaobject sync |

`webhook` (30/min) and `auth` (10 per 15 min) limits are defined but not currently applied to any route. Because the store is in memory, limits are not shared across serverless instances.

## Plans

Defined in `app/services/billing.server.ts` and billed through the Shopify Billing API (30-day recurring):

| Plan | Price | Notes |
|---|---|---|
| Free | $0 | 1 pricing rule |
| Growth | $39.99/mo | Unlimited rules and the Growth feature set |
| Professional | $89.99/mo | Everything in Growth plus pricing suggestions |

Feature access per plan is enforced in `app/utils/plan-guard.server.ts`.

## Database

The Prisma schema (`prisma/schema.prisma`) includes, among others: `Session`, `Shop`, `PricingRule`, `RuleCondition`, `DiscountTier`, `SyncLog`, `DiscountUsage`, `Bundle`, `CountdownTimer`, `CustomerGroup`, `WholesaleApplication`, `ABTest`, `PostPurchaseOffer`, `PricingInsight`, `CompetitorPrice`, `PriceHistory`, `AutoApplyRule`, `CartProgressBar`, `BogoOffer`, `StackableDiscount`, `GiftWithPurchase`, `GeoRule` and `ImportJob`.

`prisma/seed.ts` is registered as the Prisma seed script.

## Development

```bash
npm test               # vitest
npm run test:coverage
npm run typecheck      # tsc
npm run lint
```

### Project structure

```
app/
  components/        Shared React components (TierBuilder, ConditionSelector, ...)
  i18n/              Admin translations
  models/            Prisma data access per feature
  routes/            Remix routes (admin pages, API, webhooks)
  services/          Sync engine, billing, analytics sync, pricing model, rate limiter
  utils/             Plan guard, country data, decimal helpers
extensions/
  tiered-discount/   Shopify Function (purchase.product-discount.run)
  pricing-table/     Theme app extension blocks
  pos-tiered-pricing/  POS UI extension
prisma/              Schema, migrations, seed
tests/               Unit and route tests
docs/                Feature documentation
backup-blocks/       Liquid blocks not included in the extension (countdown timer, cart upsell, spin wheel)
```

### Production build

```bash
npm run build          # prisma generate + remix vite:build
npm start              # remix-serve ./build/server/index.js
```

## Support

The in-app Help page links to `support@tieredpricing.app`.

## License

No license file is included in this repository.
