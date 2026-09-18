import type { LandingLocale } from "@/components/landing/preferences";

/**
 * Copy shared by the header, announcement bar and preference switches of every
 * public page (landing, about, contact, legal). Page-specific copy stays in
 * each page component.
 */

export const LANDING_SECTION_NAV_ITEMS = [
  { id: "overview" },
  { id: "services" },
  { id: "gallery" },
  { id: "video" },
  { id: "reviews" },
] as const;

export type LandingSectionId = (typeof LANDING_SECTION_NAV_ITEMS)[number]["id"];

export const LANDING_PAGE_NAV_ITEMS = [
  { href: "/about", key: "about" },
  { href: "/contact", key: "contact" },
  { href: "/login", key: "login" },
] as const;

export type LandingPageNavKey = (typeof LANDING_PAGE_NAV_ITEMS)[number]["key"];

export type LandingNavKey = LandingSectionId | LandingPageNavKey;

export type LandingShellCopy = {
  nav: Record<LandingNavKey, string>;
  announce: string;
  primaryNavLabel: string;
  language: {
    label: string;
    english: string;
    spanish: string;
  };
  theme: {
    label: string;
    light: string;
    dark: string;
  };
  whatsapp: {
    /** Short visible label for the compact header CTA. */
    label: string;
    /** Accessible name / tooltip of the CTA. */
    description: string;
    /** Default pre-filled WhatsApp message. */
    message: string;
  };
};

export const LANDING_SHELL_COPY: Record<LandingLocale, LandingShellCopy> = {
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
    primaryNavLabel: "Primary",
    language: {
      label: "Language",
      english: "English",
      spanish: "Spanish",
    },
    theme: {
      label: "Theme",
      light: "Light theme",
      dark: "Dark theme",
    },
    whatsapp: {
      label: "WhatsApp",
      description: "Start on WhatsApp",
      message: "Hi AcostasPool, I want a premium maintenance plan for my pool.",
    },
  },
  es: {
    nav: {
      overview: "Inicio",
      services: "Servicios",
      gallery: "Galería",
      video: "Video",
      reviews: "Reseñas",
      about: "Nosotros",
      contact: "Contacto",
      login: "Acceso",
    },
    announce:
      "¿Necesitas servicio de piscina hoy? Toca el botón de WhatsApp para contactarnos al instante.",
    primaryNavLabel: "Principal",
    language: {
      label: "Idioma",
      english: "Inglés",
      spanish: "Español",
    },
    theme: {
      label: "Tema",
      light: "Tema claro",
      dark: "Tema oscuro",
    },
    whatsapp: {
      label: "WhatsApp",
      description: "Comenzar por WhatsApp",
      message: "Hola AcostasPool, quiero un plan premium de mantenimiento para mi piscina.",
    },
  },
};

export function getLandingShellCopy(locale: LandingLocale): LandingShellCopy {
  return LANDING_SHELL_COPY[locale];
}
