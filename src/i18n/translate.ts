/**
 * Superficie pública estable de i18n (`@/i18n/translate`).
 *
 * El motor vive en `@/i18n/core` (sin JSON, apto para el bundle cliente) y la
 * carga por locale en `@/i18n/dictionaries` (solo servidor: `getMessages` es
 * síncrono sobre el mapa ya cargado y `loadMessages` es la vía asíncrona).
 * Importar desde este barrel conecta ambos, así que el código cliente debe
 * importar `@/i18n/core` directamente.
 */
export {
  createTranslator,
  selectPluralForm,
  translate,
  translatePlural,
} from "@/i18n/core";
export type {
  Messages,
  PluralForm,
  TranslateFn,
  TranslatePluralFn,
  TranslateValues,
  Translator,
} from "@/i18n/core";
export { getMessages, isMessagesLoaded, loadMessages } from "@/i18n/dictionaries";
