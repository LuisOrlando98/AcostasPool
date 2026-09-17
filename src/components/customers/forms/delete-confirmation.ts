import type { Locale } from "@/i18n/config";

/**
 * Palabra que el administrador debe escribir para borrar un cliente, por
 * idioma. `DeleteCustomerButton` la muestra e interpola en los textos y la
 * compara en cliente; `deleteCustomerSchema` acepta cualquiera de ellas en
 * servidor, de modo que ambos lados no puedan desalinearse.
 */
export const DELETE_CONFIRMATION_KEYWORDS: Readonly<Record<Locale, string>> = {
  en: "delete",
  es: "eliminar",
};

export const DELETE_CONFIRMATION_WORDS: readonly string[] = Object.values(
  DELETE_CONFIRMATION_KEYWORDS
);
