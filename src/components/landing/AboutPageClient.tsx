"use client";

import Image from "next/image";
import Link from "next/link";
import LandingFooter, { type LandingSocialLinks } from "@/components/landing/LandingFooter";
import LandingHeader from "@/components/landing/LandingHeader";
import type { LandingLocale } from "@/components/landing/preferences";
import { useLandingPreferences } from "@/components/landing/useLandingPreferences";
import { LANDING_IMAGES, buildWhatsAppLink } from "@/lib/landing-config";

type SocialLinks = LandingSocialLinks;

type PrincipleIconName = "shield" | "camera" | "route";
type FlowIconName = "request" | "plan" | "deliver";

const HERO_IMAGE = LANDING_IMAGES.servicesHeroTechnician;
const STORY_IMAGE = LANDING_IMAGES.heroDeck;
const FULL_WIDTH_IMAGE_SIZES = "(max-width: 760px) 94vw, 88vw";
const HALF_WIDTH_IMAGE_SIZES = "(max-width: 1180px) 94vw, 44vw";

const ABOUT_COPY: Record<
  LandingLocale,
  {
    hero: {
      title: string;
      lead: string;
      whatsapp: string;
      contact: string;
      message: string;
    };
    story: {
      title: string;
      lead: string;
      bullets: string[];
    };
    history: {
      title: string;
      leadOne: string;
      leadTwo: string;
      milestones: Array<{ year: string; title: string; text: string }>;
    };
    principlesTitle: string;
    principles: Array<{ title: string; text: string; icon: PrincipleIconName }>;
    flowTitle: string;
    flowSteps: Array<{ title: string; text: string; icon: FlowIconName }>;
  }
> = {
  en: {
    hero: {
      title: "About AcostasPool",
      lead:
        "We provide premium weekly pool maintenance built on consistency, communication, and technical detail for South Florida homes.",
      whatsapp: "Start on WhatsApp",
      contact: "Contact us",
      message: "Hi AcostasPool, I would like to learn more about your service plans.",
    },
    story: {
      title: "Built on process, not guesswork.",
      lead:
        "Every property receives a service rhythm that matches its pool system, usage level, and seasonal demands. Our objective is stable water quality, reliable communication, and clear expectations on every visit.",
      bullets: [
        "Checklist-based service execution",
        "Chemistry-first corrective decisions",
        "Preventive equipment observations",
        "Consistent homeowner communication",
      ],
    },
    history: {
      title: "Our History and Commitment",
      leadOne:
        "AcostasPool grew from a simple objective: deliver premium pool care with reliable weekly discipline, not inconsistent one-off fixes.",
      leadTwo:
        "Our commitment remains the same on every property: stable water chemistry, clear technical communication, and service execution homeowners can trust long-term.",
      milestones: [
        {
          year: "2019",
          title: "First recurring routes",
          text: "Started with a small group of residential clients focused on consistency and clean communication.",
        },
        {
          year: "2022",
          title: "Process standardization",
          text: "Introduced structured visit checklists and clearer diagnostic reporting for equipment and water balance.",
        },
        {
          year: "Today",
          title: "Commitment to premium care",
          text: "Serving South Florida properties with preventive maintenance and dependable weekly execution.",
        },
      ],
    },
    principlesTitle: "What defines our service quality.",
    principles: [
      {
        title: "Licensed and insured operation",
        text: "Compliance-first service model built for residential property standards in Florida.",
        icon: "shield",
      },
      {
        title: "Photo-backed transparency",
        text: "Each visit can include visual notes and clear next-step recommendations.",
        icon: "camera",
      },
      {
        title: "Predictable service rhythm",
        text: "Structured routing and checklist execution for reliable pool quality week after week.",
        icon: "route",
      },
    ],
    flowTitle: "How we work with homeowners.",
    flowSteps: [
      {
        title: "Request",
        text: "You share your city, pool condition, and preferred service schedule.",
        icon: "request",
      },
      {
        title: "Plan",
        text: "We align service frequency, route timing, and equipment priorities for your property.",
        icon: "plan",
      },
      {
        title: "Deliver",
        text: "Our team executes with chemistry checks, visual quality control, and concise reporting.",
        icon: "deliver",
      },
    ],
  },
  es: {
    hero: {
      title: "Sobre AcostasPool",
      lead:
        "Ofrecemos mantenimiento premium semanal de piscinas con consistencia, comunicación clara y ejecución técnica enfocada en detalle para hogares del sur de Florida.",
      whatsapp: "Comenzar por WhatsApp",
      contact: "Contactarnos",
      message: "Hola AcostasPool, quiero conocer más sobre sus planes de servicio.",
    },
    story: {
      title: "Basado en proceso, no en suposiciones.",
      lead:
        "Cada propiedad recibe un ritmo de servicio acorde al sistema de su piscina, uso y demanda estacional. Nuestro objetivo es agua estable, comunicación confiable y expectativas claras en cada visita.",
      bullets: [
        "Ejecución guiada por checklist",
        "Decisiones correctivas basadas en química",
        "Observaciones preventivas de equipos",
        "Comunicación consistente con el propietario",
      ],
    },
    history: {
      title: "Nuestra historia y compromiso",
      leadOne:
        "AcostasPool nació con un objetivo simple: brindar cuidado premium con disciplina semanal real, no soluciones aisladas e inconsistentes.",
      leadTwo:
        "Nuestro compromiso sigue igual en cada propiedad: química estable, comunicación técnica clara y ejecución confiable a largo plazo.",
      milestones: [
        {
          year: "2019",
          title: "Primeras rutas recurrentes",
          text: "Iniciamos con un grupo pequeño de clientes residenciales enfocados en consistencia y comunicación clara.",
        },
        {
          year: "2022",
          title: "Estandarización del proceso",
          text: "Implementamos checklists de visita y reportes técnicos más claros para equipos y balance químico.",
        },
        {
          year: "Hoy",
          title: "Compromiso premium",
          text: "Atendemos propiedades del sur de Florida con mantenimiento preventivo y ejecución semanal confiable.",
        },
      ],
    },
    principlesTitle: "Qué define nuestra calidad de servicio.",
    principles: [
      {
        title: "Operación licenciada y asegurada",
        text: "Modelo de trabajo orientado a cumplimiento para propiedades residenciales en Florida.",
        icon: "shield",
      },
      {
        title: "Transparencia con evidencia",
        text: "Cada visita puede incluir notas visuales y recomendaciones claras del siguiente paso.",
        icon: "camera",
      },
      {
        title: "Ritmo de servicio predecible",
        text: "Rutas estructuradas y ejecución por checklist para calidad confiable semana tras semana.",
        icon: "route",
      },
    ],
    flowTitle: "Cómo trabajamos con propietarios.",
    flowSteps: [
      {
        title: "Solicitud",
        text: "Nos compartes ciudad, condición de piscina y frecuencia de servicio preferida.",
        icon: "request",
      },
      {
        title: "Plan",
        text: "Alineamos frecuencia, horario de ruta y prioridades de equipos para tu propiedad.",
        icon: "plan",
      },
      {
        title: "Ejecución",
        text: "Nuestro equipo realiza chequeos químicos, control visual y reporte breve de hallazgos.",
        icon: "deliver",
      },
    ],
  },
};

function AboutPrincipleIcon({ id }: { id: PrincipleIconName }) {
  if (id === "shield") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
        <path d="M12 3.5 5.8 6v5.7c0 4.5 2.6 7.6 6.2 8.8 3.6-1.2 6.2-4.3 6.2-8.8V6L12 3.5Z" />
        <path d="m9.5 11.9 1.6 1.6 3.4-3.4" />
      </svg>
    );
  }
  if (id === "camera") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
        <path d="M4.5 8.2h15a2 2 0 0 1 2 2v6.3a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2v-6.3a2 2 0 0 1 2-2Z" />
        <path d="m9 8.2 1-2.2h4l1 2.2" />
        <circle cx="12" cy="13.3" r="2.8" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M3 17.8h6l2-3.5h10" />
      <path d="m4.6 12.6 4.3-4.3 2.5 2.5 4.8-4.8 2.2 2.2" />
      <circle cx="4.6" cy="12.6" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="11.4" cy="10.8" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="18.4" cy="8" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function AboutFlowIcon({ id }: { id: FlowIconName }) {
  if (id === "request") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
        <rect x="4.2" y="4.2" width="15.6" height="15.6" rx="2.8" />
        <path d="M8 9h8M8 12h8M8 15h4.6" />
      </svg>
    );
  }
  if (id === "plan") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
        <path d="M7.2 4.8v3.1M16.8 4.8v3.1M5 8h14" />
        <rect x="4.2" y="6.6" width="15.6" height="13.2" rx="2.5" />
        <path d="m9.4 14.1 1.8 1.8 3.4-3.4" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M5 15.4V9.2a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6.2" />
      <path d="M4 15.4h16v2a1.8 1.8 0 0 1-1.8 1.8H5.8A1.8 1.8 0 0 1 4 17.4v-2Z" />
      <path d="M10 11.3h4" />
    </svg>
  );
}

export default function AboutPageClient({ socialLinks }: { socialLinks?: SocialLinks }) {
  const { language, setLanguage, theme, setTheme } = useLandingPreferences();
  const copy = ABOUT_COPY[language];
  const whatsappLink = socialLinks?.whatsappUrl || buildWhatsAppLink(copy.hero.message);

  return (
    <div className="lp-shell lp-about-page" data-theme={theme}>
      <LandingHeader
        language={language}
        theme={theme}
        onLanguageChange={setLanguage}
        onThemeChange={setTheme}
        whatsappLink={whatsappLink}
        activePage="about"
      />

      <main id="main-content" className="lp-main" tabIndex={-1}>
        <section className="lp-section">
          <div className="lp-container">
            <article className="lp-about-hero lp-surface">
              <Image
                src={HERO_IMAGE.src}
                width={HERO_IMAGE.width}
                height={HERO_IMAGE.height}
                sizes={FULL_WIDTH_IMAGE_SIZES}
                priority
                fetchPriority="high"
                alt={
                  language === "es"
                    ? "Técnico de piscina realizando servicio en una propiedad residencial"
                    : "Pool technician performing service at a residential property"
                }
              />
              <div className="lp-about-hero-overlay">
                <h1>{copy.hero.title}</h1>
                <p>{copy.hero.lead}</p>
                <div className="lp-actions">
                  <a href={whatsappLink} className="lp-btn lp-btn-primary">
                    {copy.hero.whatsapp}
                  </a>
                  <Link href="/contact" className="lp-btn lp-btn-ghost">
                    {copy.hero.contact}
                  </Link>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section className="lp-section">
          <div className="lp-container lp-about-story-layout">
            <article className="lp-about-story-copy lp-surface">
              <h2>{copy.story.title}</h2>
              <p>{copy.story.lead}</p>
              <ul>
                {copy.story.bullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>

            <div className="lp-about-story-media lp-surface">
              <Image
                src={STORY_IMAGE.src}
                width={STORY_IMAGE.width}
                height={STORY_IMAGE.height}
                sizes={HALF_WIDTH_IMAGE_SIZES}
                alt={
                  language === "es"
                    ? "Piscina residencial preparada para servicio premium de mantenimiento"
                    : "Residential swimming pool prepared for premium maintenance service"
                }
              />
            </div>
          </div>
        </section>

        <section className="lp-section">
          <div className="lp-container lp-about-history-layout">
            <article className="lp-about-history-copy lp-surface">
              <h2>{copy.history.title}</h2>
              <p>{copy.history.leadOne}</p>
              <p>{copy.history.leadTwo}</p>
            </article>

            <div className="lp-about-history-timeline">
              {copy.history.milestones.map((item) => (
                <article key={item.title} className="lp-about-history-step lp-surface">
                  <span>{item.year}</span>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-section">
          <div className="lp-container">
            <div className="lp-section-head">
              <h2>{copy.principlesTitle}</h2>
            </div>

            <div className="lp-about-principles-grid">
              {copy.principles.map((item) => (
                <article key={item.title} className="lp-about-principle lp-surface">
                  <span className="lp-about-principle-icon" aria-hidden="true">
                    <AboutPrincipleIcon id={item.icon} />
                  </span>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-section">
          <div className="lp-container">
            <div className="lp-section-head">
              <h2>{copy.flowTitle}</h2>
            </div>

            <div className="lp-about-flow-grid">
              {copy.flowSteps.map((step, index) => (
                <article key={step.title} className="lp-about-flow-step lp-surface">
                  <div className="lp-about-flow-head">
                    <span className="lp-about-flow-icon" aria-hidden="true">
                      <AboutFlowIcon id={step.icon} />
                    </span>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                  </div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </article>
              ))}
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
