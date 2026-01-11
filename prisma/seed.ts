import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const shopDomain = process.argv[2] || "novamentstudios-2.myshopify.com";

  console.log(`Seeding mock data for shop: ${shopDomain}`);

  // Find or create shop
  let shop = await prisma.shop.findUnique({
    where: { shopDomain },
  });

  if (!shop) {
    shop = await prisma.shop.create({
      data: {
        shopDomain,
        shopName: "Demo Store",
        plan: "GROWTH",
        ruleLimit: -1,
        currency: "USD",
        currencySymbol: "$",
      },
    });
    console.log("Created shop:", shop.id);
  } else {
    // Update to GROWTH plan for demo
    shop = await prisma.shop.update({
      where: { id: shop.id },
      data: { plan: "GROWTH", ruleLimit: -1 },
    });
    console.log("Updated shop:", shop.id);
  }

  // Delete existing rules for clean slate
  await prisma.pricingRule.deleteMany({
    where: { shopId: shop.id },
  });

  // Create realistic mock rules
  const rules = [
    {
      name: "Summer T-Shirt Volume Discount",
      description: "Buy more t-shirts, save more!",
      priority: 10,
      status: "ACTIVE" as const,
      syncedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      conditions: [
        { type: "COLLECTION", value: "gid://shopify/Collection/12345", label: "Summer Collection" },
      ],
      tiers: [
        { minQty: 2, maxQty: 4, valueType: "PERCENTAGE", value: 10 },
        { minQty: 5, maxQty: 9, valueType: "PERCENTAGE", value: 15 },
        { minQty: 10, maxQty: null, valueType: "PERCENTAGE", value: 20 },
      ],
    },
    {
      name: "Wholesale Electronics Pricing",
      description: "B2B pricing for electronics",
      priority: 8,
      status: "ACTIVE" as const,
      syncedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      conditions: [
        { type: "CUSTOMER_TAG", value: "wholesale", label: "Wholesale Customers" },
      ],
      tiers: [
        { minQty: 5, maxQty: 19, valueType: "PERCENTAGE", value: 12 },
        { minQty: 20, maxQty: 49, valueType: "PERCENTAGE", value: 18 },
        { minQty: 50, maxQty: null, valueType: "PERCENTAGE", value: 25 },
      ],
    },
    {
      name: "Accessories Bundle Deal",
      description: "Mix and match accessories",
      priority: 5,
      status: "ACTIVE" as const,
      syncedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      conditions: [
        { type: "COLLECTION", value: "gid://shopify/Collection/67890", label: "Accessories" },
      ],
      tiers: [
        { minQty: 3, maxQty: 5, valueType: "FIXED_AMOUNT", value: 5 },
        { minQty: 6, maxQty: null, valueType: "FIXED_AMOUNT", value: 15 },
      ],
    },
    {
      name: "New Customer Welcome Discount",
      description: "First order volume discount",
      priority: 3,
      status: "DRAFT" as const,
      syncedAt: null,
      conditions: [
        { type: "CUSTOMER_TAG", value: "new-customer", label: "New Customers" },
      ],
      tiers: [
        { minQty: 2, maxQty: null, valueType: "PERCENTAGE", value: 8 },
      ],
    },
    {
      name: "Holiday Season Special",
      description: "Limited time holiday pricing",
      priority: 15,
      status: "PAUSED" as const,
      syncedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
      conditions: [
        { type: "COLLECTION", value: "gid://shopify/Collection/99999", label: "Holiday Items" },
      ],
      tiers: [
        { minQty: 2, maxQty: 4, valueType: "PERCENTAGE", value: 15 },
        { minQty: 5, maxQty: null, valueType: "PERCENTAGE", value: 25 },
      ],
    },
  ];

  for (const ruleData of rules) {
    const rule = await prisma.pricingRule.create({
      data: {
        shopId: shop.id,
        name: ruleData.name,
        description: ruleData.description,
        priority: ruleData.priority,
        status: ruleData.status,
        syncedAt: ruleData.syncedAt,
        conditions: {
          create: ruleData.conditions.map((c) => ({
            type: c.type as any,
            value: c.value,
            label: c.label,
          })),
        },
        tiers: {
          create: ruleData.tiers.map((t) => ({
            minQuantity: t.minQty,
            maxQuantity: t.maxQty,
            valueType: t.valueType as any,
            value: t.value,
          })),
        },
      },
    });
    console.log(`Created rule: ${rule.name}`);
  }

  // Create some sync logs for realistic stats
  const syncLogs = [
    { status: "SUCCESS", rulesCount: 5, daysAgo: 0, duration: 1250 },
    { status: "SUCCESS", rulesCount: 4, daysAgo: 1, duration: 980 },
    { status: "SUCCESS", rulesCount: 5, daysAgo: 2, duration: 1100 },
    { status: "PARTIAL", rulesCount: 5, daysAgo: 3, duration: 2300, error: "1 rule failed to sync" },
    { status: "SUCCESS", rulesCount: 3, daysAgo: 5, duration: 750 },
    { status: "SUCCESS", rulesCount: 4, daysAgo: 7, duration: 890 },
  ];

  for (const log of syncLogs) {
    await prisma.syncLog.create({
      data: {
        shopId: shop.id,
        status: log.status as any,
        rulesCount: log.rulesCount,
        duration: log.duration,
        error: log.error || null,
        createdAt: new Date(Date.now() - log.daysAgo * 24 * 60 * 60 * 1000),
      },
    });
  }
  console.log("Created sync logs");

  // Clean existing data for other models
  await prisma.bundle.deleteMany({ where: { shopId: shop.id } });
  await prisma.bogoOffer.deleteMany({ where: { shopId: shop.id } });
  await prisma.cartProgressBar.deleteMany({ where: { shopId: shop.id } });
  await prisma.countdownTimer.deleteMany({ where: { shopId: shop.id } });

  // Create Bundles
  const bundles = [
    {
      name: "Summer Outfit Bundle",
      description: "T-shirt + Shorts + Cap - Save 15%",
      status: "ACTIVE" as const,
      discountType: "PERCENTAGE" as const,
      discountValue: 15,
      requireAll: true,
      minProducts: 3,
    },
    {
      name: "Electronics Starter Kit",
      description: "Phone case + Charger + Earbuds",
      status: "ACTIVE" as const,
      discountType: "FIXED_AMOUNT" as const,
      discountValue: 20,
      requireAll: true,
      minProducts: 3,
    },
    {
      name: "Gift Set Collection",
      description: "Any 2 items from gift collection",
      status: "DRAFT" as const,
      discountType: "PERCENTAGE" as const,
      discountValue: 10,
      requireAll: false,
      minProducts: 2,
    },
  ];

  for (const bundleData of bundles) {
    await prisma.bundle.create({
      data: {
        shopId: shop.id,
        ...bundleData,
      },
    });
  }
  console.log("Created 3 bundles");

  // Create BOGO Offers
  const bogoOffers = [
    {
      name: "Buy 2 Get 1 Free",
      description: "Buy any 2 t-shirts, get 1 free",
      status: "ACTIVE" as const,
      bogoType: "BUY_X_GET_Y_FREE" as const,
      buyQuantity: 2,
      getQuantity: 1,
      discountType: "PERCENTAGE" as const,
      discountValue: 100,
      ordersUsed: 47,
      totalDiscountGiven: 1250.50,
    },
    {
      name: "Buy 1 Get 1 50% Off",
      description: "Buy any item, get second at half price",
      status: "ACTIVE" as const,
      bogoType: "BUY_X_GET_Y_PERCENT" as const,
      buyQuantity: 1,
      getQuantity: 1,
      discountType: "PERCENTAGE" as const,
      discountValue: 50,
      ordersUsed: 89,
      totalDiscountGiven: 2340.75,
    },
    {
      name: "Spend $100 Get Free Gift",
      description: "Free accessory with $100+ purchase",
      status: "PAUSED" as const,
      bogoType: "SPEND_X_GET_Y" as const,
      buyQuantity: 1,
      getQuantity: 1,
      buyMinAmount: 100,
      discountType: "PERCENTAGE" as const,
      discountValue: 100,
      ordersUsed: 23,
      totalDiscountGiven: 575.00,
    },
  ];

  for (const bogoData of bogoOffers) {
    await prisma.bogoOffer.create({
      data: {
        shopId: shop.id,
        ...bogoData,
      },
    });
  }
  console.log("Created 3 BOGO offers");

  // Create Cart Progress Bars
  const progressBars = [
    {
      name: "Free Shipping Progress",
      status: "ACTIVE" as const,
      progressType: "FREE_SHIPPING" as const,
      threshold: 50,
      rewardType: "FREE_SHIPPING" as const,
      barColor: "#4CAF50",
      emptyMessage: "Add {amount} to get FREE shipping!",
      progressMessage: "Only {amount} away from FREE shipping!",
      completeMessage: "You've unlocked FREE shipping!",
      showOn: "CART_PAGE" as const,
      impressions: 1250,
      completions: 312,
      revenueGenerated: 8450.00,
    },
    {
      name: "10% Discount Unlock",
      status: "ACTIVE" as const,
      progressType: "DISCOUNT_UNLOCK" as const,
      threshold: 75,
      rewardType: "PERCENTAGE_DISCOUNT" as const,
      rewardValue: 10,
      barColor: "#2196F3",
      emptyMessage: "Spend {amount} more to unlock 10% OFF!",
      progressMessage: "{amount} away from 10% discount!",
      completeMessage: "10% discount unlocked!",
      showOn: "CART_DRAWER" as const,
      impressions: 890,
      completions: 156,
      revenueGenerated: 4200.00,
    },
  ];

  for (const barData of progressBars) {
    await prisma.cartProgressBar.create({
      data: {
        shopId: shop.id,
        ...barData,
      },
    });
  }
  console.log("Created 2 cart progress bars");

  // Create Countdown Timers
  const timers = [
    {
      name: "Flash Sale Timer",
      status: "ACTIVE" as const,
      endTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
      title: "Flash Sale Ends In:",
      style: "banner",
      bgColor: "#ff4444",
      textColor: "#ffffff",
      showOn: "PRODUCT_PAGES" as const,
    },
    {
      name: "Weekend Special",
      status: "DRAFT" as const,
      endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      title: "Weekend Deal Ends:",
      style: "minimal",
      bgColor: "#333333",
      textColor: "#ffffff",
      showOn: "ALL_PAGES" as const,
    },
  ];

  for (const timerData of timers) {
    await prisma.countdownTimer.create({
      data: {
        shopId: shop.id,
        ...timerData,
      },
    });
  }
  console.log("Created 2 countdown timers");

  console.log("\n✅ Mock data seeded successfully!");
  console.log(`   - 5 pricing rules (3 active, 1 draft, 1 paused)`);
  console.log(`   - 6 sync logs (95% success rate)`);
  console.log(`   - 3 bundles (2 active, 1 draft)`);
  console.log(`   - 3 BOGO offers (2 active, 1 paused)`);
  console.log(`   - 2 cart progress bars`);
  console.log(`   - 2 countdown timers`);
  console.log(`   - Plan: GROWTH`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
