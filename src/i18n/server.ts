import { cookies } from "next/headers";
import { LOCALE_COOKIE, defaultLocale, normalizeLocale } from "@/i18n/config";
import type { Locale } from "@/i18n/config";
import { createTranslator, type Translator } from "@/i18n/core";
import { loadMessages } from "@/i18n/dictionaries";

export async function getRequestLocale() {
  const store = await cookies();
  const raw = store.get(LOCALE_COOKIE)?.value;
  return normalizeLocale(raw ?? defaultLocale);
}

/**
 * Devuelve `t(key, values)` para el locale de la petición; el mismo `t` expone
 * `t.plural(key, count, values)` para claves con formas `.one` / `.other`.
 * Carga (y cachea) únicamente el diccionario de ese locale.
 */
export async function getTranslations(locale?: Locale): Promise<Translator> {
  const resolvedLocale = locale ?? (await getRequestLocale());
  return createTranslator(await loadMessages(resolvedLocale));
}
