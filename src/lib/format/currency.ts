/**
 * Formato de importes con `Intl.NumberFormat`, memoizando un formatter por
 * par (locale, moneda): construirlos es caro y las páginas los usan en bucle.
 */

export const DEFAULT_CURRENCY = "USD";

const DEFAULT_LOCALE_TAG = "en-US";

/**
 * Los locales de la app son escuetos ("en" | "es"); el negocio opera en EE. UU.,
 * así que ambos formatean con convenciones estadounidenses ($1,234.50). Cualquier
 * otra etiqueta BCP 47 se usa tal cual.
 */
const APP_LOCALE_TAGS: Readonly<Record<string, string>> = {
  en: "en-US",
  es: "es-US",
};

const formatters = new Map<string, Intl.NumberFormat>();

function createCurrencyFormatter(localeTag: string, currency: string): Intl.NumberFormat {
  try {
    return new Intl.NumberFormat(localeTag, { style: "currency", currency });
  } catch (error) {
    // Una etiqueta de locale malformada lanza RangeError: degradamos al locale
    // por defecto conservando la moneda (una moneda inválida sí debe fallar).
    if (error instanceof RangeError && localeTag !== DEFAULT_LOCALE_TAG) {
      return new Intl.NumberFormat(DEFAULT_LOCALE_TAG, { style: "currency", currency });
    }
    throw error;
  }
}

function getCurrencyFormatter(locale: string, currency: string): Intl.NumberFormat {
  const localeTag = APP_LOCALE_TAGS[locale] ?? locale;
  const cacheKey = `${localeTag}|${currency}`;
  const cached = formatters.get(cacheKey);
  if (cached) {
    return cached;
  }
  const formatter = createCurrencyFormatter(localeTag, currency);
  formatters.set(cacheKey, formatter);
  return formatter;
}

/**
 * Formatea `amount` como importe en `currency` (ISO 4217, por defecto USD)
 * según `locale`. Valores no finitos se delegan a Intl ("NaN", "∞").
 */
export function formatCurrency(
  amount: number,
  locale: string,
  currency: string = DEFAULT_CURRENCY
): string {
  return getCurrencyFormatter(locale, currency).format(amount);
}
