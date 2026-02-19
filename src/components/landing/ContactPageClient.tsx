"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { LandingLocale } from "@/components/landing/preferences";
import { useLandingPreferences } from "@/components/landing/useLandingPreferences";
import ContactRequestForm from "@/components/landing/ContactRequestForm";
import CoverageMapCard from "@/components/landing/CoverageMapCard";

type SocialLinks = {
  whatsappUrl?: string | null;
};

const PHONE_DISPLAY = "+1 (786) 519-5059";
const PHONE_E164 = "+17865195059";
const SUPPORT_EMAIL = "contact@acostaspool.com";

const CONTACT_COPY: Record<
  LandingLocale,
  {
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
    hero: {
      title: string;
      lead: string;
      whatsapp: string;
      call: string;
      email: string;
      message: string;
    };
    hub: {
      title: string;
      lead: string;
      whatsAppLabel: string;
      whatsAppSub: string;
      callLabel: string;
      hoursTitle: string;
      hoursValue: string;
      inboxTitle: string;
    };
    support: {
      includeTitle: string;
      includeItems: string[];
      detailsTitle: string;
      detailsLead: string;
      detailsAction: string;
    };
  }
> = {
  en: {
    nav: {
      overview: "Home",
      services: "Services",
      gallery: "Gallery",
      video: "Video",
      reviews: "Reviews",
      about: "About",
      contact: "Contact",
      login: "Client log in",
    },
    announce: "South Florida premium pool maintenance with clear weekly execution",
    hero: {
      title: "Get In Touch Now",
      lead:
        "Tell us your pool location, current condition, and preferred schedule. We will reply with a clear service recommendation.",
      whatsapp: "Start on WhatsApp",
      call: "Call",
      email: "Send email",
      message: "Hi AcostasPool, I would like a premium pool maintenance quote.",
    },
    hub: {
      title: "Reach us directly",
      lead:
        "Choose your preferred channel or send your request using the form. We usually respond in less than 24 hours.",
      whatsAppLabel: "WhatsApp",
      whatsAppSub: "Start chat now",
      callLabel: "Call us",
      hoursTitle: "Business hours:",
      hoursValue: "Monday to Saturday, 8:00 AM to 6:00 PM.",
      inboxTitle: "Direct inbox:",
    },
    support: {
      includeTitle: "What to include in your first message",
      includeItems: [
        "Pool size and current water condition",
        "Any equipment concerns you have noticed",
        "Preferred weekly service cadence",
        "Optional photos for faster evaluation",
      ],
      detailsTitle: "Need more details before booking?",
      detailsLead:
        "Learn how we organize route cadence, technical checks, and homeowner reporting before your first visit.",
      detailsAction: "Learn about our team",
    },
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
      login: "Acceso clientes",
    },
    announce: "Mantenimiento premium de piscinas en el sur de Florida con ejecucion semanal clara",
    hero: {
      title: "Contactanos ahora",
      lead:
        "Comparte la ubicacion de tu piscina, condicion actual y frecuencia preferida. Te responderemos con una recomendacion clara.",
      whatsapp: "Comenzar por WhatsApp",
      call: "Llamar",
      email: "Enviar correo",
      message: "Hola AcostasPool, me gustaria recibir una cotizacion premium de mantenimiento.",
    },
    hub: {
      title: "Contacto directo",
      lead:
        "Elige tu canal preferido o envia tu solicitud con el formulario. Normalmente respondemos en menos de 24 horas.",
      whatsAppLabel: "WhatsApp",
      whatsAppSub: "Iniciar chat",
      callLabel: "Llamanos",
      hoursTitle: "Horario:",
      hoursValue: "Lunes a sabado, 8:00 AM a 6:00 PM.",
      inboxTitle: "Correo directo:",
    },
    support: {
      includeTitle: "Que incluir en tu primer mensaje",
      includeItems: [
        "Tamano de la piscina y condicion actual del agua",
        "Cualquier preocupacion de equipos que hayas notado",
        "Frecuencia semanal de servicio preferida",
        "Fotos opcionales para evaluar mas rapido",
      ],
      detailsTitle: "Necesitas mas detalles antes de reservar?",
      detailsLead:
        "Conoce como organizamos el ritmo de rutas, chequeos tecnicos y reportes al propietario antes de la primera visita.",
      detailsAction: "Conocer al equipo",
    },
  },
};

const SECTION_NAV_ITEMS = [
  { id: "overview" },
  { id: "services" },
  { id: "gallery" },
  { id: "video" },
  { id: "reviews" },
] as const;

const PAGE_NAV_ITEMS = [
  { href: "/about", key: "about" },
  { href: "/contact", key: "contact" },
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

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 21a9 9 0 1 0-4.5-1.2L4 21l1.3-3.3A9 9 0 0 0 12 21Z" />
      <path d="M9.3 8.8c.3-.3.5-.3.7.1l.6 1.3c.1.2.1.4-.1.6l-.5.5c-.2.2-.2.4 0 .6.3.6.8 1.1 1.4 1.4.2.1.4.1.6 0l.5-.5c.2-.2.4-.2.6-.1l1.3.6c.3.2.4.4.1.7l-.6.7c-.6.6-1.4.8-2.2.5-1.4-.5-2.7-1.7-3.7-3.1-.8-1.1-1.1-2.1-.7-2.9l.7-.8Z" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M6.5 3.8h3l1.3 3.2-1.7 2.1a12.2 12.2 0 0 0 5.8 5.8l2.1-1.7 3.2 1.3v3a1.9 1.9 0 0 1-2.1 1.9C9.7 20.1 3.9 14.3 4.6 6a1.9 1.9 0 0 1 1.9-2.2Z" />
    </svg>
  );
}

export default function ContactPageClient({ socialLinks }: { socialLinks?: SocialLinks }) {
  const { language, setLanguage, theme, setTheme } = useLandingPreferences();
  const copy = CONTACT_COPY[language];
  const sectionLabels: Record<(typeof SECTION_NAV_ITEMS)[number]["id"], string> = {
    overview: copy.nav.overview,
    services: copy.nav.services,
    gallery: copy.nav.gallery,
    video: copy.nav.video,
    reviews: copy.nav.reviews,
  };

  const whatsappLink = useMemo(() => {
    if (socialLinks?.whatsappUrl) {
      return socialLinks.whatsappUrl;
    }
    return `https://wa.me/${PHONE_E164.replace("+", "")}?text=${encodeURIComponent(copy.hero.message)}`;
  }, [copy.hero.message, socialLinks?.whatsappUrl]);

  return (
    <div className="lp-shell lp-contact-page" data-theme={theme}>
      <header className="lp-header">
        <div className="lp-container lp-header-inner">
          <Link href="/" className="lp-brand">
            <span className="lp-brand-dot" aria-hidden="true" />
            <span className="lp-brand-name">
              <span>Acostas</span>
              <span>Pool</span>
            </span>
          </Link>

          <nav className="lp-nav" aria-label="Primary">
            {SECTION_NAV_ITEMS.map((item) => (
              <Link key={item.id} href={`/#${item.id}`} className="lp-nav-link">
                {sectionLabels[item.id]}
              </Link>
            ))}

            {PAGE_NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="lp-nav-link lp-nav-link-page"
                data-active={item.href === "/contact"}
              >
                {copy.nav[item.key]}
              </Link>
            ))}
          </nav>

          <div className="lp-header-actions">
            <div className="lp-lang-switch" role="group" aria-label="Language">
              <button
                type="button"
                className="lp-lang-btn"
                data-active={language === "en"}
                onClick={() => setLanguage("en")}
                aria-label="English"
                title="English"
              >
                EN
              </button>
              <button
                type="button"
                className="lp-lang-btn"
                data-active={language === "es"}
                onClick={() => setLanguage("es")}
                aria-label="Espanol"
                title="Espanol"
              >
                ES
              </button>
            </div>

            <div className="lp-theme-switch" role="group" aria-label="Theme">
              <button
                type="button"
                className="lp-theme-btn"
                data-active={theme === "ocean"}
                onClick={() => setTheme("ocean")}
                aria-label="Light theme"
                title="Light theme"
              >
                <SunIcon />
              </button>
              <button
                type="button"
                className="lp-theme-btn"
                data-active={theme === "night"}
                onClick={() => setTheme("night")}
                aria-label="Dark theme"
                title="Dark theme"
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

      <main className="lp-main">
        <section className="lp-section">
          <div className="lp-container">
            <article className="lp-contact-hero lp-surface">
              <img
                src="/landing/media/curated/images/pool-service-weekly-technician.jpg"
                alt="Pool service technician cleaning a residential swimming pool"
              />
              <div className="lp-contact-hero-overlay">
                <h1>{copy.hero.title}</h1>
                <p>{copy.hero.lead}</p>
                <div className="lp-actions">
                  <a href={whatsappLink} className="lp-btn lp-btn-primary">
                    {copy.hero.whatsapp}
                  </a>
                  <a href={`tel:${PHONE_E164}`} className="lp-btn lp-btn-ghost">
                    {copy.hero.call} {PHONE_DISPLAY}
                  </a>
                  <a href={`mailto:${SUPPORT_EMAIL}`} className="lp-btn lp-btn-ghost">
                    {copy.hero.email}
                  </a>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section className="lp-section">
          <div className="lp-container lp-contact-hub">
            <article className="lp-contact-hub-info lp-surface">
              <h2>{copy.hub.title}</h2>
              <p>{copy.hub.lead}</p>

              <div className="lp-contact-methods">
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noreferrer"
                  className="lp-contact-method lp-contact-method-whatsapp"
                >
                  <span className="lp-contact-method-icon">
                    <WhatsAppIcon />
                  </span>
                  <span>
                    <strong>{copy.hub.whatsAppLabel}</strong>
                    <em>{copy.hub.whatsAppSub}</em>
                  </span>
                </a>

                <a href={`tel:${PHONE_E164}`} className="lp-contact-method">
                  <span className="lp-contact-method-icon">
                    <PhoneIcon />
                  </span>
                  <span>
                    <strong>{copy.hub.callLabel}</strong>
                    <em>{PHONE_DISPLAY}</em>
                  </span>
                </a>
              </div>

              <div className="lp-contact-meta">
                <p>
                  <strong>{copy.hub.hoursTitle}</strong> {copy.hub.hoursValue}
                </p>
                <p>
                  <strong>{copy.hub.inboxTitle}</strong> {SUPPORT_EMAIL}
                </p>
              </div>
            </article>

            <article className="lp-contact-hub-form lp-surface">
              <ContactRequestForm language={language} />
            </article>
          </div>
        </section>

        <section className="lp-section">
          <div className="lp-container lp-contact-grid-v2">
            <CoverageMapCard language={language} />

            <div className="lp-contact-support-grid">
              <article className="lp-contact-card lp-surface">
                <h2>{copy.support.includeTitle}</h2>
                <ul className="lp-contact-checklist">
                  {copy.support.includeItems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>

              <article className="lp-contact-card lp-surface">
                <h2>{copy.support.detailsTitle}</h2>
                <p className="lp-contact-note">{copy.support.detailsLead}</p>
                <Link href="/about" className="lp-btn lp-btn-soft">
                  {copy.support.detailsAction}
                </Link>
              </article>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
