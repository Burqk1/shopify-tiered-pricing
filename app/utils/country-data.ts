/**
 * Country Data Utility
 *
 * Common country data for geo-targeting (shared between client and server)
 */

export const COUNTRY_DATA: Record<string, { name: string; currency: string; symbol: string }> = {
  US: { name: "United States", currency: "USD", symbol: "$" },
  GB: { name: "United Kingdom", currency: "GBP", symbol: "£" },
  EU: { name: "European Union", currency: "EUR", symbol: "€" },
  DE: { name: "Germany", currency: "EUR", symbol: "€" },
  FR: { name: "France", currency: "EUR", symbol: "€" },
  IT: { name: "Italy", currency: "EUR", symbol: "€" },
  ES: { name: "Spain", currency: "EUR", symbol: "€" },
  NL: { name: "Netherlands", currency: "EUR", symbol: "€" },
  CA: { name: "Canada", currency: "CAD", symbol: "CA$" },
  AU: { name: "Australia", currency: "AUD", symbol: "A$" },
  JP: { name: "Japan", currency: "JPY", symbol: "¥" },
  CN: { name: "China", currency: "CNY", symbol: "¥" },
  KR: { name: "South Korea", currency: "KRW", symbol: "₩" },
  BR: { name: "Brazil", currency: "BRL", symbol: "R$" },
  MX: { name: "Mexico", currency: "MXN", symbol: "MX$" },
  TR: { name: "Turkey", currency: "TRY", symbol: "₺" },
  IN: { name: "India", currency: "INR", symbol: "₹" },
  RU: { name: "Russia", currency: "RUB", symbol: "₽" },
  AE: { name: "UAE", currency: "AED", symbol: "د.إ" },
  SA: { name: "Saudi Arabia", currency: "SAR", symbol: "﷼" },
};

export function getCountryName(countryCode: string): string {
  return COUNTRY_DATA[countryCode]?.name || countryCode;
}

export function getCountryCurrency(countryCode: string): string {
  return COUNTRY_DATA[countryCode]?.currency || "USD";
}

export function getCountryCurrencySymbol(countryCode: string): string {
  return COUNTRY_DATA[countryCode]?.symbol || "$";
}
