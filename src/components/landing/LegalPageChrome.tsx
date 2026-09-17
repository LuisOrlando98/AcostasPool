"use client";

import type { ReactNode } from "react";
import LandingFooter, { type LandingSocialLinks } from "@/components/landing/LandingFooter";
import LandingHeader from "@/components/landing/LandingHeader";
import { getLandingShellCopy } from "@/components/landing/landing-copy";
import type { LandingLocale, LandingTheme } from "@/components/landing/preferences";
import { buildWhatsAppLink } from "@/lib/landing-config";

export default function LegalPageChrome({
  language,
  theme,
  onLanguageChange,
  onThemeChange,
  socialLinks,
  children,
}: {
  language: LandingLocale;
  theme: LandingTheme;
  onLanguageChange: (nextLocale: LandingLocale) => void;
  onThemeChange: (nextTheme: LandingTheme) => void;
  socialLinks?: LandingSocialLinks;
  children: ReactNode;
}) {
  const whatsappLink =
    socialLinks?.whatsappUrl || buildWhatsAppLink(getLandingShellCopy(language).whatsapp.message);

  return (
    <div className="lp-shell lp-legal-page" data-theme={theme}>
      <LandingHeader
        language={language}
        theme={theme}
        onLanguageChange={onLanguageChange}
        onThemeChange={onThemeChange}
        whatsappLink={whatsappLink}
      />

      <main id="main-content" className="lp-main" tabIndex={-1}>
        {children}
      </main>

      <LandingFooter
        language={language}
        theme={theme}
        onLanguageChange={onLanguageChange}
        onThemeChange={onThemeChange}
        socialLinks={socialLinks}
      />
    </div>
  );
}
