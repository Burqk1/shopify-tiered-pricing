/**
 * i18n Translations
 *
 * Multi-language support for the app UI
 */

export const translations = {
  en: {
    // Common
    common: {
      save: "Save",
      cancel: "Cancel",
      delete: "Delete",
      edit: "Edit",
      create: "Create",
      loading: "Loading...",
      error: "Error",
      success: "Success",
      back: "Back",
      next: "Next",
      yes: "Yes",
      no: "No",
      confirm: "Confirm",
      close: "Close",
    },

    // Navigation
    nav: {
      dashboard: "Dashboard",
      pricingRules: "Pricing Rules",
      settings: "Settings",
      analytics: "Analytics",
    },

    // Dashboard
    dashboard: {
      title: "Dashboard",
      welcome: "Welcome to Tiered Pricing",
      welcomeDescription: "Boost your sales with volume discounts and tiered pricing. Create rules to offer better prices when customers buy more.",

      // Stats
      activeRules: "Active Rules",
      totalSyncs: "Total Syncs",
      lastSync: "Last Sync",
      currentPlan: "Current Plan",
      never: "Never",

      // Quick Actions
      quickActions: "Quick Actions",
      createFirstRule: "Create Your First Rule",
      createFirstRuleDesc: "Set up volume discounts for your products",
      createRule: "Create New Rule",
      createRuleDesc: "Add another pricing rule",
      viewAllRules: "View All Rules",
      manageRules: "Manage Rules",

      // Plan
      upgradePlan: "Upgrade Plan",
      upgradePlanDesc: "Get unlimited rules and advanced features",
      planFeatures: "Plan Features",
      ruleLimit: "Rule Limit",
      unlimited: "Unlimited",

      // Getting Started
      gettingStarted: "Getting Started",
      step1Title: "Create a Pricing Rule",
      step1Desc: "Define quantity thresholds and discounts for your products",
      step2Title: "Apply to Products",
      step2Desc: "Select which products or collections the rule applies to",
      step3Title: "Sync to Storefront",
      step3Desc: "Publish your rules to show dynamic pricing to customers",
    },

    // Settings
    settings: {
      title: "Settings",
      backToDashboard: "Dashboard",

      // Current Plan
      currentPlan: "Current Plan",
      ruleLimit: "Rule Limit",
      customerTags: "Customer Tags",
      cssEditor: "CSS Editor",
      enabled: "Enabled",
      disabled: "Disabled",
      cancelSubscription: "Cancel Subscription",

      // Plans
      availablePlans: "Available Plans",
      free: "Free",
      growth: "Growth",
      professional: "Professional",
      perMonth: "/month",
      currentPlanBadge: "Current Plan",
      bestValue: "Best Value",
      upgradeToGrowth: "Upgrade to Growth",
      upgradeToPro: "Upgrade to Pro",
      downgrade: "Downgrade",

      // Sync Stats
      syncStatistics: "Sync Statistics",
      totalSyncs: "Total Syncs",
      successRate: "Success Rate",
      lastSync: "Last Sync",
      na: "N/A",
      never: "Never",

      // POS
      posIntegration: "POS Integration",
      posAvailable: "Available",
      posDescription: "Configure how tiered pricing works with Shopify POS for in-store sales.",
      posEnable: "Enable POS Integration",
      posEnableHelp: "Apply volume discounts when selling through Shopify POS",
      posShowTierInfo: "Show Tier Information",
      posShowTierInfoHelp: "Display pricing tiers to staff on POS device",
      posStaffOverride: "Allow Staff Override",
      posStaffOverrideHelp: "Let staff manually adjust discounts at checkout",
      savePosSettings: "Save POS Settings",

      // Language
      language: "Language",
      languageDescription: "Choose your preferred language for the app interface.",
      appLanguage: "App Language",
      saveLanguage: "Save Language",
      languageUpdated: "Language updated successfully",

      // Shop Info
      shopInformation: "Shop Information",
      domain: "Domain",
      name: "Name",
      email: "Email",

      // Cancel Modal
      cancelModalTitle: "Cancel Subscription?",
      cancelModalDescription: "Are you sure you want to cancel your subscription? You will be downgraded to the Free plan.",
      cancelModalNote: "Your current features will remain active until the end of your billing period.",
      keepSubscription: "Keep Subscription",
      confirmCancel: "Cancel Subscription",

      // Messages
      posSettingsUpdated: "POS settings updated",
      subscriptionCancelled: "Subscription cancelled",
    },

    // Pricing Rules
    rules: {
      title: "Pricing Rules",
      createRule: "Create Rule",
      noRules: "No pricing rules yet",
      noRulesDescription: "Create your first rule to start offering volume discounts",

      // Rule Status
      active: "Active",
      draft: "Draft",
      paused: "Paused",
      archived: "Archived",

      // Rule Form
      ruleName: "Rule Name",
      ruleNamePlaceholder: "e.g., Bulk Discount",
      description: "Description",
      descriptionPlaceholder: "Optional description",
      priority: "Priority",
      priorityHelp: "Higher priority rules are applied first",

      // Conditions
      conditions: "Conditions",
      addCondition: "Add Condition",
      product: "Product",
      collection: "Collection",
      customerTag: "Customer Tag",
      allProducts: "All Products",

      // Tiers
      tiers: "Discount Tiers",
      addTier: "Add Tier",
      minQuantity: "Min Quantity",
      maxQuantity: "Max Quantity",
      discountType: "Discount Type",
      discountValue: "Discount Value",
      percentage: "Percentage",
      fixedAmount: "Fixed Amount",

      // Actions
      saveRule: "Save Rule",
      deleteRule: "Delete Rule",
      activateRule: "Activate",
      pauseRule: "Pause",
      syncRule: "Sync to Storefront",

      // Messages
      ruleSaved: "Rule saved successfully",
      ruleDeleted: "Rule deleted",
      ruleSynced: "Rule synced to storefront",
    },

    // Errors
    errors: {
      somethingWentWrong: "Something went wrong",
      tryAgain: "Please try again",
      notFound: "Not found",
      unauthorized: "Unauthorized",
      forbidden: "Forbidden",
      shopNotFound: "Shop not found",
    },
  },

  tr: {
    // Common
    common: {
      save: "Kaydet",
      cancel: "İptal",
      delete: "Sil",
      edit: "Düzenle",
      create: "Oluştur",
      loading: "Yükleniyor...",
      error: "Hata",
      success: "Başarılı",
      back: "Geri",
      next: "İleri",
      yes: "Evet",
      no: "Hayır",
      confirm: "Onayla",
      close: "Kapat",
    },

    // Navigation
    nav: {
      dashboard: "Panel",
      pricingRules: "Fiyat Kuralları",
      settings: "Ayarlar",
      analytics: "Analitik",
    },

    // Dashboard
    dashboard: {
      title: "Panel",
      welcome: "Kademeli Fiyatlamaya Hoş Geldiniz",
      welcomeDescription: "Hacim indirimleri ve kademeli fiyatlandırma ile satışlarınızı artırın. Müşteriler daha fazla aldığında daha iyi fiyatlar sunmak için kurallar oluşturun.",

      // Stats
      activeRules: "Aktif Kurallar",
      totalSyncs: "Toplam Senkron",
      lastSync: "Son Senkron",
      currentPlan: "Mevcut Plan",
      never: "Hiç",

      // Quick Actions
      quickActions: "Hızlı İşlemler",
      createFirstRule: "İlk Kuralınızı Oluşturun",
      createFirstRuleDesc: "Ürünleriniz için hacim indirimleri ayarlayın",
      createRule: "Yeni Kural Oluştur",
      createRuleDesc: "Başka bir fiyat kuralı ekleyin",
      viewAllRules: "Tüm Kuralları Gör",
      manageRules: "Kuralları Yönet",

      // Plan
      upgradePlan: "Planı Yükselt",
      upgradePlanDesc: "Sınırsız kural ve gelişmiş özellikler edinin",
      planFeatures: "Plan Özellikleri",
      ruleLimit: "Kural Limiti",
      unlimited: "Sınırsız",

      // Getting Started
      gettingStarted: "Başlangıç",
      step1Title: "Fiyat Kuralı Oluşturun",
      step1Desc: "Ürünleriniz için miktar eşikleri ve indirimler tanımlayın",
      step2Title: "Ürünlere Uygulayın",
      step2Desc: "Kuralın hangi ürün veya koleksiyonlara uygulanacağını seçin",
      step3Title: "Mağazaya Senkronla",
      step3Desc: "Müşterilere dinamik fiyatlandırmayı göstermek için kurallarınızı yayınlayın",
    },

    // Settings
    settings: {
      title: "Ayarlar",
      backToDashboard: "Panel",

      // Current Plan
      currentPlan: "Mevcut Plan",
      ruleLimit: "Kural Limiti",
      customerTags: "Müşteri Etiketleri",
      cssEditor: "CSS Editörü",
      enabled: "Aktif",
      disabled: "Pasif",
      cancelSubscription: "Aboneliği İptal Et",

      // Plans
      availablePlans: "Mevcut Planlar",
      free: "Ücretsiz",
      growth: "Büyüme",
      professional: "Profesyonel",
      perMonth: "/ay",
      currentPlanBadge: "Mevcut Plan",
      bestValue: "En İyi Değer",
      upgradeToGrowth: "Büyüme'ye Yükselt",
      upgradeToPro: "Pro'ya Yükselt",
      downgrade: "Düşür",

      // Sync Stats
      syncStatistics: "Senkronizasyon İstatistikleri",
      totalSyncs: "Toplam Senkron",
      successRate: "Başarı Oranı",
      lastSync: "Son Senkron",
      na: "Yok",
      never: "Hiç",

      // POS
      posIntegration: "POS Entegrasyonu",
      posAvailable: "Mevcut",
      posDescription: "Kademeli fiyatlandırmanın mağaza içi satışlar için Shopify POS ile nasıl çalışacağını yapılandırın.",
      posEnable: "POS Entegrasyonunu Etkinleştir",
      posEnableHelp: "Shopify POS üzerinden satış yaparken hacim indirimlerini uygula",
      posShowTierInfo: "Kademe Bilgisini Göster",
      posShowTierInfoHelp: "POS cihazında personele fiyat kademelerini göster",
      posStaffOverride: "Personel Geçersiz Kılmaya İzin Ver",
      posStaffOverrideHelp: "Personelin ödeme sırasında indirimleri manuel olarak ayarlamasına izin ver",
      savePosSettings: "POS Ayarlarını Kaydet",

      // Language
      language: "Dil",
      languageDescription: "Uygulama arayüzü için tercih ettiğiniz dili seçin.",
      appLanguage: "Uygulama Dili",
      saveLanguage: "Dili Kaydet",
      languageUpdated: "Dil başarıyla güncellendi",

      // Shop Info
      shopInformation: "Mağaza Bilgileri",
      domain: "Alan Adı",
      name: "İsim",
      email: "E-posta",

      // Cancel Modal
      cancelModalTitle: "Aboneliği İptal Et?",
      cancelModalDescription: "Aboneliğinizi iptal etmek istediğinizden emin misiniz? Ücretsiz plana düşürüleceksiniz.",
      cancelModalNote: "Mevcut özellikleriniz fatura döneminizin sonuna kadar aktif kalacaktır.",
      keepSubscription: "Aboneliği Koru",
      confirmCancel: "Aboneliği İptal Et",

      // Messages
      posSettingsUpdated: "POS ayarları güncellendi",
      subscriptionCancelled: "Abonelik iptal edildi",
    },

    // Pricing Rules
    rules: {
      title: "Fiyat Kuralları",
      createRule: "Kural Oluştur",
      noRules: "Henüz fiyat kuralı yok",
      noRulesDescription: "Hacim indirimleri sunmaya başlamak için ilk kuralınızı oluşturun",

      // Rule Status
      active: "Aktif",
      draft: "Taslak",
      paused: "Duraklatıldı",
      archived: "Arşivlendi",

      // Rule Form
      ruleName: "Kural Adı",
      ruleNamePlaceholder: "örn. Toplu İndirim",
      description: "Açıklama",
      descriptionPlaceholder: "İsteğe bağlı açıklama",
      priority: "Öncelik",
      priorityHelp: "Yüksek öncelikli kurallar önce uygulanır",

      // Conditions
      conditions: "Koşullar",
      addCondition: "Koşul Ekle",
      product: "Ürün",
      collection: "Koleksiyon",
      customerTag: "Müşteri Etiketi",
      allProducts: "Tüm Ürünler",

      // Tiers
      tiers: "İndirim Kademeleri",
      addTier: "Kademe Ekle",
      minQuantity: "Min Miktar",
      maxQuantity: "Maks Miktar",
      discountType: "İndirim Türü",
      discountValue: "İndirim Değeri",
      percentage: "Yüzde",
      fixedAmount: "Sabit Tutar",

      // Actions
      saveRule: "Kuralı Kaydet",
      deleteRule: "Kuralı Sil",
      activateRule: "Etkinleştir",
      pauseRule: "Duraklat",
      syncRule: "Mağazaya Senkronla",

      // Messages
      ruleSaved: "Kural başarıyla kaydedildi",
      ruleDeleted: "Kural silindi",
      ruleSynced: "Kural mağazaya senkronlandı",
    },

    // Errors
    errors: {
      somethingWentWrong: "Bir şeyler yanlış gitti",
      tryAgain: "Lütfen tekrar deneyin",
      notFound: "Bulunamadı",
      unauthorized: "Yetkisiz",
      forbidden: "Yasak",
      shopNotFound: "Mağaza bulunamadı",
    },
  },
} as const;

export type Locale = keyof typeof translations;
export type TranslationKeys = typeof translations.en;
