import type { Locale } from "@/i18n/config";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";

type Messages = typeof en;

const dictionaries: Record<Locale, Messages> = {
  en,
  es,
};

export function getMessages(locale: Locale): Messages {
  return dictionaries[locale] ?? en;
}

function getValue(messages: Messages, key: string) {
  return key.split(".").reduce((acc, part) => {
    if (acc && typeof acc === "object" && part in acc) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, messages as unknown);
}

export function translate(
  messages: Messages,
  key: string,
  values?: Record<string, string | number>
) {
  const raw = getValue(messages, key);
  if (typeof raw !== "string") {
    return key;
  }
  if (!values) {
    return raw;
  }
  return raw.replace(/\{\{(\w+)\}\}/g, (_, token: string) => {
    const value = values[token];
    return value === undefined ? "" : String(value);
  });
}

export type { Messages };
