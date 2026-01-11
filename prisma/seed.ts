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

  console.log("\n✅ Mock data seeded successfully!");
  console.log(`   - 5 pricing rules (3 active, 1 draft, 1 paused)`);
  console.log(`   - 6 sync logs (95% success rate)`);
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
