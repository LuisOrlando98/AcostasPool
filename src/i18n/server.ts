import { cookies } from "next/headers";
import { LOCALE_COOKIE, defaultLocale, normalizeLocale } from "@/i18n/config";
import { getMessages, translate, type Messages } from "@/i18n/translate";

export async function getRequestLocale() {
  const store = await cookies();
  const raw = store.get(LOCALE_COOKIE)?.value;
  return normalizeLocale(raw ?? defaultLocale);
}

export async function getTranslations(locale?: string) {
  const resolvedLocale = locale ?? (await getRequestLocale());
  const messages: Messages = getMessages(resolvedLocale);
  return (key: string, values?: Record<string, string | number>) =>
    translate(messages, key, values);
}
