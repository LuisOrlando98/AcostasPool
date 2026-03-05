"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import LandingFooter, { type LandingSocialLinks } from "@/components/landing/LandingFooter";
import type { LandingLocale, LandingTheme } from "@/components/landing/preferences";

type ShellCopy = {
  nav: {
    overview: string;
    services: string;
    gallery: string;
    video: string;
    reviews: string;
    about: string;
    contact: string;
    login: string;
  };
  announce: string;
};

const SHELL_COPY: Record<LandingLocale, ShellCopy> = {
  en: {
    nav: {
      overview: "Home",
      services: "Services",
      gallery: "Gallery",
      video: "Video",
      reviews: "Reviews",
      about: "About",
      contact: "Contact",
      login: "Log in",
    },
    announce: "Need pool service today? Tap the WhatsApp button to contact us instantly.",
  },
  es: {
    nav: {
      overview: "Inicio",
      services: "Servicios",
      gallery: "Galeria",
      video: "Video",
      reviews: "Resenas",
      about: "Nosotros",
      contact: "Contacto",
      login: "Acceso",
    },
    announce: "Necesitas servicio de piscina hoy? Toca el boton de WhatsApp para contactarnos al instante.",
  },
};

const SECTION_NAV_ITEMS = [
  { href: "/#overview", key: "overview" },
  { href: "/#services", key: "services" },
  { href: "/#gallery", key: "gallery" },
  { href: "/#video", key: "video" },
  { href: "/#reviews", key: "reviews" },
] as const;

const PAGE_NAV_ITEMS = [
  { href: "/about", key: "about" },
  { href: "/contact", key: "contact" },
  { href: "/login", key: "login" },
] as const;

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2.2M12 19.8V22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2 12h2.2M19.8 12H22M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M20.1 14.8A8.7 8.7 0 1 1 9.2 3.9a7 7 0 1 0 10.9 10.9Z" />
    </svg>
  );
}

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
  const copy = SHELL_COPY[language];

  return (
    <div className="lp-shell lp-legal-page" data-theme={theme}>
      <header className="lp-header">
        <div className="lp-container lp-header-inner">
          <Link href="/" className="lp-brand">
            <span className="lp-brand-dot" aria-hidden="true" />
            <span className="lp-brand-name">
              <span>Acostas</span>
              <span>Pool</span>
            </span>
          </Link>

          <nav className="lp-nav" aria-label={language === "es" ? "Principal" : "Primary"}>
            <Link href="/" className="lp-nav-link lp-nav-logo-link" data-nav-key="brand">
              <span className="lp-nav-logo-dot" aria-hidden="true" />
              <span className="lp-nav-logo-text">
                <span>Acostas</span>
                <span>Pool</span>
              </span>
            </Link>

            {SECTION_NAV_ITEMS.map((item) => (
              <Link key={item.href} href={item.href} className="lp-nav-link" data-nav-key={item.key}>
                {copy.nav[item.key]}
              </Link>
            ))}

            {PAGE_NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="lp-nav-link lp-nav-link-page"
                data-nav-key={item.key}
              >
                {copy.nav[item.key]}
              </Link>
            ))}
          </nav>

          <div className="lp-header-actions">
            <div className="lp-lang-switch" role="group" aria-label={language === "es" ? "Idioma" : "Language"}>
              <button
                type="button"
                className="lp-lang-btn"
                data-active={language === "en"}
                onClick={() => onLanguageChange("en")}
                aria-label={language === "es" ? "Ingles" : "English"}
                title={language === "es" ? "Ingles" : "English"}
              >
                EN
              </button>
              <button
                type="button"
                className="lp-lang-btn"
                data-active={language === "es"}
                onClick={() => onLanguageChange("es")}
                aria-label={language === "es" ? "Espanol" : "Spanish"}
                title={language === "es" ? "Espanol" : "Spanish"}
              >
                ES
              </button>
            </div>

            <div className="lp-theme-switch" role="group" aria-label={language === "es" ? "Tema" : "Theme"}>
              <button
                type="button"
                className="lp-theme-btn"
                data-active={theme === "ocean"}
                onClick={() => onThemeChange("ocean")}
                aria-label={language === "es" ? "Tema claro" : "Light theme"}
                title={language === "es" ? "Tema claro" : "Light theme"}
              >
                <SunIcon />
              </button>
              <button
                type="button"
                className="lp-theme-btn"
                data-active={theme === "night"}
                onClick={() => onThemeChange("night")}
                aria-label={language === "es" ? "Tema oscuro" : "Dark theme"}
                title={language === "es" ? "Tema oscuro" : "Dark theme"}
              >
                <MoonIcon />
              </button>
            </div>

            <Link href="/login" className="lp-login-btn">
              {copy.nav.login}
            </Link>
          </div>
        </div>

        <div className="lp-announce">
          <div className="lp-container lp-announce-inner">
            <p>{copy.announce}</p>
          </div>
        </div>
      </header>

      <main className="lp-main">{children}</main>

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

