import { describe, expect, it } from "vitest";
import { locales, type Locale } from "@/i18n/config";
import { translate, type Messages } from "@/i18n/core";
import { loadMessages } from "@/i18n/dictionaries";
import { SHELL_MESSAGE_KEYS, getShellTranslator } from "@/i18n/shell-messages";

const dictionaries = new Map<Locale, Messages>(
  await Promise.all(
    locales.map(
      async (locale) => [locale, await loadMessages(locale)] as const
    )
  )
);

describe("shell messages subset", () => {
  it("keeps every shell key identical to the full dictionary", () => {
    for (const locale of locales) {
      const full = dictionaries.get(locale) as Messages;
      const t = getShellTranslator(locale);
      for (const key of SHELL_MESSAGE_KEYS) {
        expect(t(key), `${locale}: ${key}`).toBe(translate(full, key));
        // Una clave ausente devolvería la propia clave: eso sería una fuga.
        expect(t(key), `${locale}: ${key}`).not.toBe(key);
      }
    }
  });

  it("interpolates placeholders like the full dictionary", () => {
    for (const locale of locales) {
      const full = dictionaries.get(locale) as Messages;
      const values = { digest: "abc123" };
      expect(
        getShellTranslator(locale)("globalShell.globalError.digest", values)
      ).toBe(translate(full, "globalShell.globalError.digest", values));
    }
  });

  it("returns the key for anything outside the subset", () => {
    expect(getShellTranslator("en")("notifications.jobCompleted")).toBe(
      "notifications.jobCompleted"
    );
  });
});
