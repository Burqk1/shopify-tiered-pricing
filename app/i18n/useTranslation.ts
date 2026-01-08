/**
 * useTranslation Hook
 *
 * Simple translation hook for multi-language support
 */

import { translations, type Locale, type TranslationKeys } from "./translations";

type NestedKeyOf<T> = T extends object
  ? {
      [K in keyof T]: K extends string
        ? T[K] extends object
          ? `${K}.${NestedKeyOf<T[K]>}` | K
          : K
        : never;
    }[keyof T]
  : never;

type TranslationKey = NestedKeyOf<TranslationKeys>;

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const keys = path.split(".");
  let result: unknown = obj;

  for (const key of keys) {
    if (result && typeof result === "object" && key in result) {
      result = (result as Record<string, unknown>)[key];
    } else {
      return path; // Return key if not found
    }
  }

  return typeof result === "string" ? result : path;
}

/**
 * Create translation function for a specific locale
 */
export function createTranslator(locale: string) {
  const currentLocale = (locale in translations ? locale : "en") as Locale;
  const currentTranslations = translations[currentLocale];

  /**
   * Translate a key
   */
  function t(key: string): string {
    return getNestedValue(currentTranslations as unknown as Record<string, unknown>, key);
  }

  return { t, locale: currentLocale };
}

/**
 * Get translations object for a locale
 */
export function getTranslations(locale: string): TranslationKeys {
  const currentLocale = (locale in translations ? locale : "en") as Locale;
  return translations[currentLocale];
}

export { translations, type Locale, type TranslationKeys };
