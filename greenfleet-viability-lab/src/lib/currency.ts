/**
 * Currency registry. Adding a currency is one entry here; nothing else needs to change.
 * Currencies are labels only: the app never converts between them.
 */
export const CURRENCIES = {
  NGN: { code: "NGN", symbol: "₦", name: "Nigerian Naira" },
  USD: { code: "USD", symbol: "$", name: "US Dollar" },
  GHS: { code: "GHS", symbol: "GH₵", name: "Ghanaian Cedi" },
  KES: { code: "KES", symbol: "KSh", name: "Kenyan Shilling" },
  ZAR: { code: "ZAR", symbol: "R", name: "South African Rand" },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;
export type Currency = (typeof CURRENCIES)[CurrencyCode];

export const DEFAULT_CURRENCY: CurrencyCode = "NGN";
export const CURRENCY_LIST: readonly Currency[] = Object.values(CURRENCIES);

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(CURRENCIES, value);
}
