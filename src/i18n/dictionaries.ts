import { defaultLocale, locales } from "@/i18n/config";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/core";

/**
 * Carga de diccionarios por locale.
 *
 * Los `import()` dinámicos mantienen cada JSON (~100 KB) en su propio chunk, de
 * modo que un render solo evalúa el diccionario del locale activo en lugar de
 * los dos. Este módulo está pensado para el servidor: los componentes cliente
 * reciben el diccionario ya resuelto vía `I18nProvider` y solo importan
 * `@/i18n/core`, que no incluye ningún JSON.
 */
const loaders: Record<Locale, () => Promise<Messages>> = {
  en: async () => (await import("@/i18n/messages/en.json")).default,
  es: async () => (await import("@/i18n/messages/es.json")).default,
};

/** Diccionarios ya cargados: alimenta la vía síncrona `getMessages`. */
const loadedMessages = new Map<Locale, Messages>();

function resolveLocale(locale: Locale): Locale {
  return (locales as readonly string[]).includes(locale) ? locale : defaultLocale;
}

/** `true` si `getMessages(locale)` puede resolverse sin esperar. */
export function isMessagesLoaded(locale: Locale): boolean {
  return loadedMessages.has(resolveLocale(locale));
}

/**
 * Carga (una sola vez) el diccionario del locale indicado; un locale
 * desconocido cae a `defaultLocale`. Devuelve siempre la misma instancia.
 */
export async function loadMessages(locale: Locale): Promise<Messages> {
  const resolvedLocale = resolveLocale(locale);
  const cached = loadedMessages.get(resolvedLocale);
  if (cached) {
    return cached;
  }
  try {
    const messages = await loaders[resolvedLocale]();
    loadedMessages.set(resolvedLocale, messages);
    return messages;
  } catch (error) {
    throw new Error(`[i18n] no se pudo cargar el diccionario "${resolvedLocale}"`, {
      cause: error,
    });
  }
}

/**
 * Vía síncrona sobre el mapa precargado: devuelve el diccionario del locale si
 * ya se cargó (p. ej. tras `getTranslations`/`loadMessages` en la misma
 * petición) y falla de forma explícita si no, en lugar de devolver textos de
 * otro idioma.
 */
export function getMessages(locale: Locale): Messages {
  const resolvedLocale = resolveLocale(locale);
  const cached = loadedMessages.get(resolvedLocale);
  if (!cached) {
    throw new Error(
      `[i18n] el diccionario "${resolvedLocale}" no está cargado: usa "await loadMessages(locale)" (o "await getTranslations(locale)") antes de la vía síncrona.`
    );
  }
  return cached;
}
