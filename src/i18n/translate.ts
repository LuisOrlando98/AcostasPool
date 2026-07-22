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

function humanizeMissingKey(key: string) {
  const lastSegment = key.split(".").pop() ?? key;
  const withSpaces = lastSegment
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  if (!withSpaces) {
    return key;
  }
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

function resolveRaw(messages: Messages, key: string): string {
  const direct = getValue(messages, key);
  if (typeof direct === "string") {
    return direct;
  }
  const otherMessages = messages === dictionaries.en ? dictionaries.es : dictionaries.en;
  const fallback = getValue(otherMessages, key);
  if (typeof fallback === "string") {
    return fallback;
  }
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[i18n] Missing translation key: "${key}"`);
  }
  return humanizeMissingKey(key);
}

export function translate(
  messages: Messages,
  key: string,
  values?: Record<string, string | number>
) {
  const raw = resolveRaw(messages, key);
  if (!values) {
    return raw;
  }
  return raw.replace(/\{\{(\w+)\}\}/g, (_, token: string) => {
    const value = values[token];
    return value === undefined ? "" : String(value);
  });
}

export type { Messages };
