# Tiered Pricing Pro - Shopify App

**All-in-One Volume Discount & Dynamic Pricing Solution for Shopify**

Transform your Shopify store with intelligent tiered pricing, bundle discounts, B2B wholesale features, A/B testing, and AI-powered pricing suggestions - all in one powerful app.

## Features

### Core Features

- **Tiered/Volume Pricing** - Create quantity-based discounts (Buy 5+, get 10% off)
- **Bundle Discounts** - Combine products for special pricing
- **Countdown Timers** - Create urgency with time-limited offers
- **B2B/Wholesale** - Customer group pricing, Net terms, Tax exempt
- **A/B Testing** - Test different pricing strategies
- **AI Pricing** - Get intelligent pricing recommendations
- **Post-Purchase Upsells** - Increase AOV with targeted offers
- **Analytics Dashboard** - Track discount performance

### Technical Highlights

- Built with Remix + React + TypeScript
- Shopify Polaris UI components
- PostgreSQL database with Prisma ORM
- Metaobject sync for fast storefront access
- Rate limiting for API protection
- Multi-language support (EN, TR, DE, ES, FR)

## Installation

### Prerequisites

- Node.js 20+
- PostgreSQL database
- Shopify Partner account

### Setup

```bash
# Clone the repository
git clone https://github.com/your-repo/shopify-tiered-pricing.git
cd shopify-tiered-pricing

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your credentials

# Setup database
npm run setup

# Start development server
npm run dev
```

### Environment Variables

```env
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
DATABASE_URL=postgresql://user:password@host:5432/database
SCOPES=write_products,read_products,write_discounts,read_discounts,write_customers,read_customers,read_metaobjects,write_metaobjects
```

## Usage

### Creating a Pricing Rule

1. Go to **Pricing Rules** in the app
2. Click **Create Rule**
3. Set conditions (products, collections, or all products)
4. Add discount tiers:
   - Quantity 1-4: No discount
   - Quantity 5-9: 10% off
   - Quantity 10+: 20% off
5. Save and sync to Shopify

### Setting Up B2B/Wholesale

1. Navigate to **B2B/Wholesale** section
2. Create customer groups (e.g., "Gold Members", "Wholesale")
3. Assign discounts to groups
4. Set Net payment terms (Net 15, Net 30)
5. Enable wholesale signup form

### Creating Bundle Discounts

1. Go to **Bundles**
2. Click **Create Bundle**
3. Select products to include
4. Set discount type and value
5. Choose if all products are required

### A/B Testing Prices

1. Navigate to **A/B Testing**
2. Create a new test
3. Select control vs. variant pricing
4. Set traffic split percentage
5. Monitor results in real-time

## API Reference

### App Proxy Endpoint

```
GET /apps/tiered-pricing/api/product-tiers?product_id={id}&shop={domain}
```

**Response:**
```json
{
  "tiers": [
    {
      "min": 1,
      "max": 4,
      "valueType": "PERCENTAGE",
      "value": 0,
      "message": null
    },
    {
      "min": 5,
      "max": 9,
      "valueType": "PERCENTAGE",
      "value": 10,
      "message": "Save 10%!"
    }
  ],
  "ruleName": "Summer Sale"
}
```

### Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| App Proxy | 120 req | 1 min |
| Sync | 10 req | 1 min |
| Webhooks | 30 req | 1 min |
| Auth | 10 req | 15 min |

## Database Schema

### Main Models

- **Shop** - Store information and plan
- **PricingRule** - Discount rules with conditions and tiers
- **Bundle** - Product bundle configurations
- **CountdownTimer** - Time-limited promotions
- **CustomerGroup** - B2B customer segments
- **ABTest** - Price testing configurations
- **PostPurchaseOffer** - Upsell configurations
- **DiscountUsage** - Analytics tracking
- **PricingInsight** - AI recommendations

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Type checking
npm run typecheck
```

### Project Structure

```
app/
  components/       # React components
  models/          # Data access layer
  routes/          # Remix routes
  services/        # Business logic
extensions/
  pricing-table/   # Storefront UI extension
prisma/
  schema.prisma    # Database schema
tests/             # Unit tests
```

### Building for Production

```bash
npm run build
npm start
```

## Pricing Plans

| Plan | Price | Features |
|------|-------|----------|
| **Free** | $0/mo | 1 rule, basic features |
| **Growth** | $19/mo | Unlimited rules, B2B, bundles |
| **Professional** | $49/mo | All features, AI pricing, priority support |

## Support

- Documentation: [docs.tieredpricing.app](https://docs.tieredpricing.app)
- Email: support@tieredpricing.app
- Discord: [Join Community](https://discord.gg/tieredpricing)

## Changelog

### v1.0.0 (2026-01-07)
- Initial release
- Tiered pricing rules
- Bundle discounts
- B2B/Wholesale features
- A/B Testing
- AI Pricing suggestions
- Analytics dashboard

## License

Proprietary - All rights reserved.

---

Built with love for Shopify merchants worldwide.
