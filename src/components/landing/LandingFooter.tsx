"use client";

import Link from "next/link";
import type { LandingLocale, LandingTheme } from "@/components/landing/preferences";

type SocialPlatform =
  | "instagram"
  | "facebook"
  | "whatsapp"
  | "x"
  | "youtube"
  | "tiktok";

export type LandingSocialLinks = {
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  whatsappUrl?: string | null;
  xUrl?: string | null;
  youtubeUrl?: string | null;
  tiktokUrl?: string | null;
};

type SocialItem = {
  id: SocialPlatform;
  label: string;
  href: string;
};

const PHONE_DISPLAY = "+1 (786) 793-0081";
const PHONE_E164 = "+17867930081";
const SUPPORT_EMAIL = "contact@acostaspool.com";

const FOOTER_COPY: Record<
  LandingLocale,
  {
    follow: string;
    headline: string;
    summary: string;
    company: string;
    services: string;
    contact: string;
    aboutUs: string;
    reviews: string;
    gallery: string;
    weeklyCare: string;
    repairRecovery: string;
    premiumStandard: string;
    contactPage: string;
    legal: string;
    legalCenter: string;
    privacyPolicy: string;
    termsOfService: string;
    paymentCancellation: string;
    disclaimerLiability: string;
    cookieNotice: string;
    rights: string;
    about: string;
    contactShort: string;
    legalShort: string;
    login: string;
    languageLabel: string;
    themeLabel: string;
    light: string;
    dark: string;
  }
> = {
  en: {
    follow: "Follow us",
    headline: "AcostasPool - U.S. Verified Business.",
    summary:
      "Growing, reliable and dedicated pool service with a mission to keep homeowners stress-free.",
    company: "Company",
    services: "Services",
    contact: "Contact",
    aboutUs: "About us",
    reviews: "Reviews",
    gallery: "Gallery",
    weeklyCare: "One-Month Pool Cleaning",
    repairRecovery: "Regular Maintenance",
    premiumStandard: "Pool Repair",
    contactPage: "Contact page",
    legal: "Legal",
    legalCenter: "Legal center",
    privacyPolicy: "Privacy policy",
    termsOfService: "Terms of service",
    paymentCancellation: "Payment and cancellation",
    disclaimerLiability: "Disclaimer and liability",
    cookieNotice: "Cookie notice",
    rights: "All rights reserved.",
    about: "About",
    contactShort: "Contact",
    legalShort: "Legal",
    login: "Log in",
    languageLabel: "Language",
    themeLabel: "Theme",
    light: "Light",
    dark: "Dark",
  },
  es: {
    follow: "Siguenos",
    headline: "AcostasPool - Empresa verificada en EE. UU.",
    summary:
      "Servicio confiable y dedicado, enfocado en mantener piscinas premium sin friccion para propietarios.",
    company: "Compania",
    services: "Servicios",
    contact: "Contacto",
    aboutUs: "Nosotros",
    reviews: "Resenas",
    gallery: "Galeria",
    weeklyCare: "Limpieza de piscina por un mes",
    repairRecovery: "Mantenimiento regular",
    premiumStandard: "Reparacion de piscina",
    contactPage: "Pagina de contacto",
    legal: "Legal",
    legalCenter: "Centro legal",
    privacyPolicy: "Politica de privacidad",
    termsOfService: "Terminos de servicio",
    paymentCancellation: "Pago y cancelacion",
    disclaimerLiability: "Descargo y responsabilidad",
    cookieNotice: "Aviso de cookies",
    rights: "Todos los derechos reservados.",
    about: "Nosotros",
    contactShort: "Contacto",
    legalShort: "Legal",
    login: "Acceso",
    languageLabel: "Idioma",
    themeLabel: "Tema",
    light: "Claro",
    dark: "Oscuro",
  },
};

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

function SocialIcon({ id }: { id: SocialPlatform }) {
  if (id === "instagram") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.6" cy="6.4" r="0.8" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (id === "facebook") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M13.3 21v-7h2.3l.4-2.7h-2.7V9.6c0-.8.2-1.4 1.3-1.4H16V5.8c-.2 0-1-.1-1.9-.1-1.9 0-3.2 1.1-3.2 3.3v2.3H8.8V14h2.1v7h2.4Z" />
      </svg>
    );
  }
  if (id === "x") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.2 3H21l-6.1 7 7.2 11h-5.7L12 14.4 6.2 21H3.4l6.5-7.4L3 3h5.8L12.8 9 18.2 3Zm-1 16.2h1.6L7.9 4.7H6.2l11 14.5Z" />
      </svg>
    );
  }
  if (id === "youtube") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M21.6 8.2a2.9 2.9 0 0 0-2-2.1C18 5.6 12 5.6 12 5.6s-6 0-7.6.5a2.9 2.9 0 0 0-2 2.1C2 9.8 2 12 2 12s0 2.2.4 3.8a2.9 2.9 0 0 0 2 2.1c1.6.5 7.6.5 7.6.5s6 0 7.6-.5a2.9 2.9 0 0 0 2-2.1C22 14.2 22 12 22 12s0-2.2-.4-3.8ZM10 15.1V8.9L15.2 12 10 15.1Z" />
      </svg>
    );
  }
  if (id === "whatsapp") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M12 21a9 9 0 1 0-4.5-1.2L4 21l1.3-3.3A9 9 0 0 0 12 21Z" />
        <path d="M9.3 8.8c.3-.3.5-.3.7.1l.6 1.3c.1.2.1.4-.1.6l-.5.5c-.2.2-.2.4 0 .6.3.6.8 1.1 1.4 1.4.2.1.4.1.6 0l.5-.5c.2-.2.4-.2.6-.1l1.3.6c.3.2.4.4.1.7l-.6.7c-.6.6-1.4.8-2.2.5-1.4-.5-2.7-1.7-3.7-3.1-.8-1.1-1.1-2.1-.7-2.9l.7-.8Z" />
      </svg>
    );
  }
  if (id === "tiktok") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M14.6 3h2.5c.2 1.6 1.1 2.8 2.5 3.3v2.4a6.1 6.1 0 0 1-2.5-1v6.1a5.7 5.7 0 1 1-5.7-5.7c.3 0 .6 0 .9.1v2.5a3.2 3.2 0 1 0 2.3 3.1V3Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 12h18M12 3v18" />
    </svg>
  );
}

export default function LandingFooter({
  language = "en",
  theme = "ocean",
  onLanguageChange,
  onThemeChange,
  socialLinks,
}: {
  language?: LandingLocale;
  theme?: LandingTheme;
  onLanguageChange?: (locale: LandingLocale) => void;
  onThemeChange?: (theme: LandingTheme) => void;
  socialLinks?: LandingSocialLinks;
}) {
  const copy = FOOTER_COPY[language];
  const socialItems: SocialItem[] = [
    { id: "instagram", label: "Instagram", href: socialLinks?.instagramUrl ?? "" },
    { id: "x", label: "X", href: socialLinks?.xUrl ?? "" },
    { id: "youtube", label: "YouTube", href: socialLinks?.youtubeUrl ?? "" },
    { id: "facebook", label: "Facebook", href: socialLinks?.facebookUrl ?? "" },
    { id: "whatsapp", label: "WhatsApp", href: socialLinks?.whatsappUrl ?? "" },
    { id: "tiktok", label: "TikTok", href: socialLinks?.tiktokUrl ?? "" },
  ].filter((item) => Boolean(item.href));

  const contactItems = [
    { label: PHONE_DISPLAY, href: `tel:${PHONE_E164}` },
    { label: SUPPORT_EMAIL, href: `mailto:${SUPPORT_EMAIL}` },
    { label: copy.contactPage, href: "/contact" },
  ];
  const legalItems = [
    { label: copy.legalCenter, href: "/legal" },
    { label: copy.privacyPolicy, href: "/legal/privacy-policy" },
    { label: copy.termsOfService, href: "/legal/terms-of-service" },
    { label: copy.paymentCancellation, href: "/legal/payment-cancellation-policy" },
    {
      label: copy.disclaimerLiability,
      href: "/legal/disclaimer-limitation-of-liability",
    },
    { label: copy.cookieNotice, href: "/legal/cookie-notice" },
  ];

  return (
    <footer className="lp-footer">
      <div className="lp-container">
        <div className="lp-footer-top" data-has-social={socialItems.length > 0}>
          {socialItems.length > 0 ? (
            <div className="lp-footer-follow">
              <div className="lp-footer-follow-copy">
                <h3>{copy.headline}</h3>
                <p>{copy.summary}</p>
              </div>
              <p>{copy.follow}</p>
              <div className="lp-footer-social-icons">
                {socialItems.map((social) => (
                  <a
                    key={social.id}
                    href={social.href}
                    target="_blank"
                    rel="noreferrer"
                    className="lp-social-icon-link"
                    aria-label={social.label}
                    title={social.label}
                  >
                    <SocialIcon id={social.id} />
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="lp-footer-middle">
          <div className="lp-footer-brand lp-footer-brand-inline">
            <Link href="/" className="lp-brand">
              <span className="lp-brand-dot" aria-hidden="true" />
              <span className="lp-brand-name">
                <span>Acostas</span>
                <span>Pool</span>
              </span>
            </Link>
            <p>Professional maintenance for premium residential pools in South Florida.</p>
          </div>

          <div className="lp-footer-col lp-footer-col-contact">
            <h3>{copy.contact}</h3>
            <ul>
              {contactItems.map((item) => {
                const isExternal = item.href.startsWith("tel:") || item.href.startsWith("mailto:");
                return (
                  <li key={item.label}>
                    {isExternal ? (
                      <a href={item.href}>{item.label}</a>
                    ) : (
                      <Link href={item.href}>{item.label}</Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="lp-footer-col lp-footer-col-legal">
            <h3>{copy.legal}</h3>
            <ul>
              {legalItems.map((item) => (
                <li key={item.label}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="lp-footer-meta">
          <p>
            (c) {new Date().getFullYear()} AcostasPool. {copy.rights}
          </p>
          <div className="lp-footer-meta-links">
            <Link href="/about">{copy.about}</Link>
            <Link href="/contact">{copy.contactShort}</Link>
            <Link href="/legal">{copy.legalShort}</Link>
            <Link href="/login">{copy.login}</Link>
          </div>

          <div className="lp-footer-meta-preferences">
            <div className="lp-lang-switch" role="group" aria-label={copy.languageLabel}>
              <button
                type="button"
                className="lp-lang-btn"
                data-active={language === "en"}
                onClick={() => onLanguageChange?.("en")}
                aria-label={language === "es" ? "Ingles" : "English"}
                title={language === "es" ? "Ingles" : "English"}
              >
                EN
              </button>
              <button
                type="button"
                className="lp-lang-btn"
                data-active={language === "es"}
                onClick={() => onLanguageChange?.("es")}
                aria-label={language === "es" ? "Espanol" : "Spanish"}
                title={language === "es" ? "Espanol" : "Spanish"}
              >
                ES
              </button>
            </div>

            <div className="lp-theme-switch" role="group" aria-label={copy.themeLabel}>
              <button
                type="button"
                className="lp-theme-btn"
                data-active={theme === "ocean"}
                onClick={() => onThemeChange?.("ocean")}
                aria-label={copy.light}
                title={copy.light}
              >
                <SunIcon />
              </button>
              <button
                type="button"
                className="lp-theme-btn"
                data-active={theme === "night"}
                onClick={() => onThemeChange?.("night")}
                aria-label={copy.dark}
                title={copy.dark}
              >
                <MoonIcon />
              </button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
