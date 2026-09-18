import type { Locale } from "@/i18n/config";
// `import type`: solo se toma la forma del diccionario, sin cargar el JSON.
import type enMessages from "@/i18n/messages/en.json";
import { createTranslator } from "@/i18n/core";
import type { Messages, Translator } from "@/i18n/core";

/**
 * Subconjunto mínimo de mensajes para las dos superficies que se renderizan
 * FUERA de `I18nProvider` y necesitan traducir de forma síncrona:
 * `app/global-error.tsx` (sustituye al layout raíz, así que no hay provider) y
 * `components/pwa/PwaUpdateNotice.tsx` (montado por `PwaRegister`, hermano del
 * provider).
 *
 * Se copian aquí ~9 cadenas en lugar de cargar el diccionario completo del
 * locale: un `import()` dinámico obligaría a renderizar primero sin texto
 * (cambio visible) y `getMessages` necesita el mapa ya precargado, que en esos
 * dos casos no existe. El tipo se deriva de `en.json`, de modo que falta o
 * sobra una clave rompe el `tsc`, y `tests/unit/i18n/shell-messages.test.ts`
 * comprueba que cada texto sigue siendo idéntico al de en.json/es.json.
 */
type ShellMessages = {
  readonly globalShell: {
    readonly globalError: typeof enMessages.globalShell.globalError;
  };
  readonly pwa: { readonly update: typeof enMessages.pwa.update };
};

const SHELL_MESSAGES: Record<Locale, ShellMessages> = {
  en: {
    globalShell: {
      globalError: {
        kicker: "Critical error",
        title: "The app couldn't start",
        subtitle:
          "An unexpected error prevented the app from loading. Try again or go back to the home page.",
        digest: "Reference: {{digest}}",
        retry: "Retry",
        backHome: "Go to home",
      },
    },
    pwa: {
      update: {
        title: "New version available",
        reload: "Reload",
        dismiss: "Later",
      },
    },
  },
  es: {
    globalShell: {
      globalError: {
        kicker: "Error crítico",
        title: "La app no pudo iniciarse",
        subtitle:
          "Un error inesperado impidió cargar la app. Inténtalo de nuevo o vuelve al inicio.",
        digest: "Referencia: {{digest}}",
        retry: "Reintentar",
        backHome: "Ir al inicio",
      },
    },
    pwa: {
      update: {
        title: "Nueva versión disponible",
        reload: "Recargar",
        dismiss: "Más tarde",
      },
    },
  },
};

/** Traductor síncrono limitado a las claves del subconjunto de arriba. */
export function getShellTranslator(locale: Locale): Translator {
  // El subconjunto no es un diccionario completo; `translate` solo recorre las
  // claves que recibe, así que el cast se limita a esta frontera.
  return createTranslator(SHELL_MESSAGES[locale] as unknown as Messages);
}

export const SHELL_MESSAGE_KEYS = [
  "globalShell.globalError.kicker",
  "globalShell.globalError.title",
  "globalShell.globalError.subtitle",
  "globalShell.globalError.digest",
  "globalShell.globalError.retry",
  "globalShell.globalError.backHome",
  "pwa.update.title",
  "pwa.update.reload",
  "pwa.update.dismiss",
] as const;
