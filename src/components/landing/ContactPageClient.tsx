"use client";

import Image from "next/image";
import Link from "next/link";
import LandingFooter, { type LandingSocialLinks } from "@/components/landing/LandingFooter";
import LandingHeader, { WhatsAppIcon } from "@/components/landing/LandingHeader";
import type { LandingLocale } from "@/components/landing/preferences";
import { useLandingPreferences } from "@/components/landing/useLandingPreferences";
import ContactRequestForm from "@/components/landing/ContactRequestForm";
import CoverageMapCard from "@/components/landing/CoverageMapCard";
import { LANDING_CONTACT, LANDING_IMAGES, buildWhatsAppLink } from "@/lib/landing-config";

type SocialLinks = LandingSocialLinks;

const HERO_IMAGE = LANDING_IMAGES.weeklyTechnician;
const FULL_WIDTH_IMAGE_SIZES = "(max-width: 760px) 94vw, 88vw";

const CONTACT_COPY: Record<
  LandingLocale,
  {
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
        "Choose your preferred channel or send your request using the form. We cover up to Miramar and Miami Gardens, then all areas south. We usually respond in less than 24 hours.",
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
    hero: {
      title: "Contáctanos ahora",
      lead:
        "Comparte la ubicación de tu piscina, condición actual y frecuencia preferida. Te responderemos con una recomendación clara.",
      whatsapp: "Comenzar por WhatsApp",
      call: "Llamar",
      email: "Enviar correo",
      message: "Hola AcostasPool, me gustaría recibir una cotización premium de mantenimiento.",
    },
    hub: {
      title: "Contacto directo",
      lead:
        "Elige tu canal preferido o envía tu solicitud con el formulario. Cubrimos hasta Miramar y Miami Gardens, y todo hacia el sur. Normalmente respondemos en menos de 24 horas.",
      whatsAppLabel: "WhatsApp",
      whatsAppSub: "Iniciar chat",
      callLabel: "Llámanos",
      hoursTitle: "Horario:",
      hoursValue: "Lunes a sábado, 8:00 AM a 6:00 PM.",
      inboxTitle: "Correo directo:",
    },
    support: {
      includeTitle: "Qué incluir en tu primer mensaje",
      includeItems: [
        "Tamaño de la piscina y condición actual del agua",
        "Cualquier preocupación de equipos que hayas notado",
        "Frecuencia semanal de servicio preferida",
        "Fotos opcionales para evaluar más rápido",
      ],
      detailsTitle: "¿Necesitas más detalles antes de reservar?",
      detailsLead:
        "Conoce cómo organizamos el ritmo de rutas, chequeos técnicos y reportes al propietario antes de la primera visita.",
      detailsAction: "Conocer al equipo",
    },
  },
};

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
  const whatsappLink = socialLinks?.whatsappUrl || buildWhatsAppLink(copy.hero.message);

  return (
    <div className="lp-shell lp-contact-page" data-theme={theme}>
      <LandingHeader
        language={language}
        theme={theme}
        onLanguageChange={setLanguage}
        onThemeChange={setTheme}
        whatsappLink={whatsappLink}
        activePage="contact"
      />

      <main id="main-content" className="lp-main" tabIndex={-1}>
        <section className="lp-section">
          <div className="lp-container">
            <article className="lp-contact-hero lp-surface">
              <Image
                src={HERO_IMAGE.src}
                width={HERO_IMAGE.width}
                height={HERO_IMAGE.height}
                sizes={FULL_WIDTH_IMAGE_SIZES}
                priority
                fetchPriority="high"
                alt={
                  language === "es"
                    ? "Técnico de piscina limpiando una piscina residencial"
                    : "Pool service technician cleaning a residential swimming pool"
                }
              />
              <div className="lp-contact-hero-overlay">
                <h1>{copy.hero.title}</h1>
                <p>{copy.hero.lead}</p>
                <div className="lp-actions">
                  <a href={whatsappLink} className="lp-btn lp-btn-primary">
                    {copy.hero.whatsapp}
                  </a>
                  <a href={`tel:${LANDING_CONTACT.phoneE164}`} className="lp-btn lp-btn-ghost">
                    {copy.hero.call} {LANDING_CONTACT.phoneDisplay}
                  </a>
                  <a href={`mailto:${LANDING_CONTACT.supportEmail}`} className="lp-btn lp-btn-ghost">
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

                <a href={`tel:${LANDING_CONTACT.phoneE164}`} className="lp-contact-method">
                  <span className="lp-contact-method-icon">
                    <PhoneIcon />
                  </span>
                  <span>
                    <strong>{copy.hub.callLabel}</strong>
                    <em>{LANDING_CONTACT.phoneDisplay}</em>
                  </span>
                </a>
              </div>

              <div className="lp-contact-meta">
                <p>
                  <strong>{copy.hub.hoursTitle}</strong> {copy.hub.hoursValue}
                </p>
                <p>
                  <strong>{copy.hub.inboxTitle}</strong> {LANDING_CONTACT.supportEmail}
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

      <LandingFooter
        language={language}
        theme={theme}
        onLanguageChange={setLanguage}
        onThemeChange={setTheme}
        socialLinks={socialLinks}
      />
    </div>
  );
}
