// `import type` se borra al compilar: este módulo NO arrastra ningún JSON al
// bundle (ni cliente ni servidor). Solo toma de en.json la forma del tipo.
import type enMessages from "@/i18n/messages/en.json";

/** Árbol de mensajes de un locale; su forma es la de `messages/en.json`. */
type Messages = typeof enMessages;

export type TranslateValues = Record<string, string | number>;
export type TranslateFn = (key: string, values?: TranslateValues) => string;
export type TranslatePluralFn = (
  key: string,
  count: number,
  values?: TranslateValues
) => string;
/** `t(key, values)` que además expone `t.plural(key, count, values)`. */
export type Translator = TranslateFn & { readonly plural: TranslatePluralFn };

const DEVELOPMENT_ENV = "development";

/**
 * Registro de claves ya avisadas: el aviso de clave ausente se emite una sola
 * vez por clave y solo en desarrollo (en test y producción es silencioso, y en
 * el build de producción `process.env.NODE_ENV` se inlinea y el aviso se
 * elimina como código muerto).
 */
const warnedMissingKeys = new Set<string>();

function warnMissingKeyOnce(key: string) {
  if (process.env.NODE_ENV !== DEVELOPMENT_ENV) {
    return;
  }
  if (warnedMissingKeys.has(key)) {
    return;
  }
  warnedMissingKeys.add(key);
  console.warn(`[i18n] missing translation key: "${key}"`);
}

const PRODUCTION_ENV = "production";

/**
 * Texto legible a partir del último segmento de una clave
 * ("client.request.errors.availableDays" → "Available Days"). Es lo que ve el
 * usuario en producción cuando falta una traducción: nunca la clave cruda.
 */
export function humanizeMissingKey(key: string): string {
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

/**
 * Valor de una clave ausente. En desarrollo y test es la propia clave, visible
 * en el aviso y en las aserciones (`tests/unit/i18n/parity.test.ts` garantiza
 * además que en/es tienen las mismas claves); en producción se humaniza para
 * que el usuario nunca vea una clave cruda.
 */
function resolveMissingKey(key: string): string {
  warnMissingKeyOnce(key);
  return process.env.NODE_ENV === PRODUCTION_ENV ? humanizeMissingKey(key) : key;
}

function getValue(messages: Messages, key: string) {
  return key.split(".").reduce((acc, part) => {
    if (acc && typeof acc === "object" && part in acc) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, messages as unknown);
}

/**
 * Devuelve el texto de `key`; si no existe (o no es texto) devuelve la clave
 * (humanizada en producción, ver `resolveMissingKey`).
 */
export function translate(
  messages: Messages,
  key: string,
  values?: Record<string, string | number>
) {
  const raw = getValue(messages, key);
  if (typeof raw !== "string") {
    return resolveMissingKey(key);
  }
  if (!values) {
    return raw;
  }
  return raw.replace(/\{\{(\w+)\}\}/g, (_, token: string) => {
    const value = values[token];
    return value === undefined ? "" : String(value);
  });
}

export type PluralForm = "one" | "other";

const PLURAL_ONE: PluralForm = "one";
const PLURAL_OTHER: PluralForm = "other";

/**
 * Los dos idiomas soportados (en, es) usan la forma "one" solo para exactamente
 * 1 y "other" para el resto. Si se añade un idioma con más categorías, sustituir
 * por `Intl.PluralRules`.
 */
export function selectPluralForm(count: number): PluralForm {
  return count === 1 ? PLURAL_ONE : PLURAL_OTHER;
}

/**
 * Busca `${key}.one` / `${key}.other` según `count`, con fallback a
 * `${key}.other` y después a la clave plana `key` (compatible con mensajes aún
 * no pluralizados). `{{count}}` siempre se interpola; `values` aporta el resto.
 */
export function translatePlural(
  messages: Messages,
  key: string,
  count: number,
  values?: TranslateValues
) {
  const candidates = [
    `${key}.${selectPluralForm(count)}`,
    `${key}.${PLURAL_OTHER}`,
    key,
  ];
  const resolvedKey =
    candidates.find((candidate) => typeof getValue(messages, candidate) === "string") ??
    key;
  return translate(messages, resolvedKey, { ...values, count });
}

/** Crea el traductor de un diccionario: `t(key, values)` y `t.plural(key, count, values)`. */
export function createTranslator(messages: Messages): Translator {
  const t: TranslateFn = (key, values) => translate(messages, key, values);
  const plural: TranslatePluralFn = (key, count, values) =>
    translatePlural(messages, key, count, values);
  return Object.assign(t, { plural });
}

export type { Messages };
