import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Get all shops
  const shops = await prisma.shop.findMany();

  for (const shop of shops) {
    console.log("Processing shop:", shop.shopDomain);

    // Delete mock data
    await prisma.syncLog.deleteMany({ where: { shopId: shop.id } });
    await prisma.bundle.deleteMany({ where: { shopId: shop.id } });
    await prisma.bogoOffer.deleteMany({ where: { shopId: shop.id } });
    await prisma.cartProgressBar.deleteMany({ where: { shopId: shop.id } });
    await prisma.countdownTimer.deleteMany({ where: { shopId: shop.id } });

    // Delete pricing rules (with cascading)
    const rules = await prisma.pricingRule.findMany({ where: { shopId: shop.id } });
    for (const rule of rules) {
      await prisma.discountTier.deleteMany({ where: { ruleId: rule.id } });
      await prisma.ruleCondition.deleteMany({ where: { ruleId: rule.id } });
    }
    await prisma.pricingRule.deleteMany({ where: { shopId: shop.id } });

    // Update to PROFESSIONAL plan
    await prisma.shop.update({
      where: { id: shop.id },
      data: { plan: "PROFESSIONAL", ruleLimit: -1 }
    });

    console.log("  - Mock data cleared");
    console.log("  - Plan updated to PROFESSIONAL");
  }

  // Verify
  const counts = {
    rules: await prisma.pricingRule.count(),
    bundles: await prisma.bundle.count(),
    bogo: await prisma.bogoOffer.count(),
    progress: await prisma.cartProgressBar.count(),
    timers: await prisma.countdownTimer.count(),
  };

  console.log("\n✅ Done!");
  console.log("Remaining data:", counts);

  const updatedShops = await prisma.shop.findMany();
  console.log("Shop plans:", updatedShops.map(s => `${s.shopDomain}: ${s.plan}`));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
