"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import LandingFooter, { type LandingSocialLinks } from "@/components/landing/LandingFooter";
import type { LandingLocale } from "@/components/landing/preferences";
import { useLandingPreferences } from "@/components/landing/useLandingPreferences";

type TrustSignalIconName = "shield" | "camera" | "route";
type ServicePillarIconName = "spark" | "clean" | "repair" | "chemistry";

type SocialLinks = LandingSocialLinks;

const LANDING_COPY: Record<
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
      subtitle: string;
      whatsapp: string;
      quote: string;
      callPrefix: string;
      responseTime: string;
      satisfaction: string;
      yearsService: string;
      mediaNote: string;
    };
    services: {
      title: string;
    };
    gallery: {
      title: string;
    };
    visit: {
      title: string;
    };
    reviews: {
      title: string;
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
      login: "Log in",
    },
    announce: "Need pool service today? Tap the WhatsApp button to contact us instantly.",
    hero: {
      title: "Professional pool care that feels effortless for your home.",
      subtitle:
        "Reliable weekly plans, clean communication, and proactive maintenance for homeowners who expect quality without friction.",
      whatsapp: "Start on WhatsApp",
      quote: "Get a quote",
      callPrefix: "Call",
      responseTime: "Average response time",
      satisfaction: "Client satisfaction",
      yearsService: "South Florida service",
      mediaNote: "Every visit can include service photos, chemistry checks, and equipment notes.",
    },
    services: {
      title: "Pool services designed for clean water and dependable operation.",
    },
    gallery: {
      title: "Visual quality standards from real service environments.",
    },
    visit: {
      title: "What each visit includes.",
    },
    reviews: {
      title: "Premium homeowner reviews.",
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
      login: "Acceso",
    },
    announce: "Necesitas servicio de piscina hoy? Toca el boton de WhatsApp para contactarnos al instante.",
    hero: {
      title: "Cuidado profesional de piscinas para que tu hogar funcione sin friccion.",
      subtitle:
        "Planes semanales confiables, comunicacion clara y mantenimiento preventivo para propietarios que exigen calidad.",
      whatsapp: "Comenzar por WhatsApp",
      quote: "Solicitar cotizacion",
      callPrefix: "Llamar",
      responseTime: "Tiempo promedio de respuesta",
      satisfaction: "Satisfaccion del cliente",
      yearsService: "Servicio en South Florida",
      mediaNote:
        "Cada visita puede incluir fotos del servicio, chequeo quimico y notas de equipos.",
    },
    services: {
      title: "Servicios de piscina pensados para agua limpia y operacion confiable.",
    },
    gallery: {
      title: "Estandares visuales de calidad en entornos reales de servicio.",
    },
    visit: {
      title: "Que incluye cada visita.",
    },
    reviews: {
      title: "Resenas de propietarios premium.",
    },
  },
};

const PHONE_DISPLAY = "+1 (786) 519-5059";
const PHONE_E164 = "+17865195059";

const HERO_IMAGE =
  "/landing/media/curated/images/pool-premium-residential-deck.jpg";

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
  { href: "/login", key: "login" },
] as const;

const TRUST_SIGNALS: Array<{ title: string; detail: string; icon: TrustSignalIconName }> = [
  {
    title: "Licensed and insured",
    detail: "Florida-compliant operation for residential pool care and service accountability.",
    icon: "shield",
  },
  {
    title: "Photo-backed notes",
    detail: "Each visit includes a visual service log with chemistry and equipment observations.",
    icon: "camera",
  },
  {
    title: "Predictable weekly routes",
    detail: "Structured cadence and route discipline for clean, consistent weekly results.",
    icon: "route",
  },
];

const SERVICE_PROMO_COPY: Record<
  LandingLocale,
  {
    badge: string;
    title: string;
    detail: string;
    note: string;
    cta: string;
  }
> = {
  en: {
    badge: "WhatsApp direct line",
    title: "Get your quote on WhatsApp in minutes",
    detail:
      "Tap the WhatsApp button now and send your pool details to receive a fast, personalized response from our team.",
    note: "Share your city and one pool photo for faster support.",
    cta: "Tap button to contact WhatsApp",
  },
  es: {
    badge: "Linea directa por WhatsApp",
    title: "Recibe tu cotizacion por WhatsApp en minutos",
    detail:
      "Toca el boton de WhatsApp ahora y envianos los datos de tu piscina para darte una respuesta rapida y personalizada.",
    note: "Comparte tu ciudad y una foto de la piscina para ayudarte mas rapido.",
    cta: "Toca el boton de WhatsApp",
  },
};

const SERVICE_PILLARS: Array<{
  title: string;
  subtitle: string;
  image: string;
  icon: ServicePillarIconName;
  points: string[];
}> = [
  {
    title: "One-Month Pool Cleaning",
    subtitle: "A one-month reset to bring your pool back to clear, comfortable condition.",
    image: "/landing/media/curated/images/pool-service-weekly-technician.jpg",
    icon: "clean",
    points: [
      "Deep cleaning visit",
      "Debris and algae removal",
      "Full vacuum and brushing",
      "Filter system check",
      "Perfect for events or a seasonal reset",
    ],
  },
  {
    title: "Regular Maintenance",
    subtitle: "Consistent weekly care that keeps water balanced and equipment performing right.",
    image: "/landing/media/curated/images/pool-service-surface-net-closeup.jpg",
    icon: "spark",
    points: [
      "Full cleaning and vacuum",
      "Water chemistry balancing",
      "Equipment inspection",
      "Basket and surface cleaning",
      "Ongoing maintenance plan",
    ],
  },
  {
    title: "Pool Cleaning + Leak Detection",
    subtitle: "Detailed cleaning with early leak diagnostics to protect pool structure and flow.",
    image: "/landing/media/curated/images/pool-service-water-chemistry-testing.jpg",
    icon: "chemistry",
    points: [
      "Leak diagnostics and targeted repair",
      "Filter wash and flow optimization",
      "Wall and tile scrubbing",
      "Precision vacuum service",
    ],
  },
  {
    title: "Equipment Repair",
    subtitle: "Diagnosis and repair support for pumps, filters, heaters, and circulation systems.",
    image: "/landing/media/curated/images/pool-equipment-filtration-room.jpg",
    icon: "repair",
    points: [
      "Leak and pressure diagnostics",
      "Pump and motor troubleshooting",
      "Filter and circulation repairs",
      "Heater and control system review",
    ],
  },
];

const SERVICES_BACKGROUND_IMAGE = "/landing/media/curated/images/pool-home-services-hero-technician.jpg";
const SERVICES_BACKGROUND_VIDEO =
  process.env.NEXT_PUBLIC_LANDING_SERVICES_BG_VIDEO_SRC?.trim() ||
  "/landing/media/curated/videos/pool-services-clean-water-promo.mp4";
const SERVICES_BACKGROUND_VIDEO_ENABLED =
  (process.env.NEXT_PUBLIC_LANDING_SERVICES_BG_VIDEO_ENABLED ?? "true").toLowerCase() !==
  "false";

const GALLERY_SLIDES = [
  {
    id: "pool-1",
    title: "Resort-level finish, every week",
    image: "/landing/media/curated/images/pool-gallery-cleaning-vacuum-closeup.jpg",
  },
  {
    id: "pool-2",
    title: "Balanced chemistry and healthy circulation",
    image: "/landing/media/curated/images/pool-gallery-maintenance-tools-set.jpg",
  },
  {
    id: "pool-3",
    title: "Clean presentation for premium properties",
    image: "/landing/media/curated/images/pool-gallery-full-service-cleaning.jpg",
  },
  {
    id: "pool-4",
    title: "Equipment health and preventive checks",
    image: "/landing/media/curated/images/pool-gallery-lifestyle-underwater-view.jpg",
  },
];

const REVIEWS = [
  {
    author: "R. Martinez",
    zone: "Coral Gables",
    rating: 5,
    plan: "Regular Maintenance",
    quote:
      "Consistent service quality every week. The team keeps communication clean and direct.",
  },
  {
    author: "S. Henderson",
    zone: "Kendall",
    rating: 5,
    plan: "Pool Cleaning + Leak Detection",
    quote:
      "They solved recurring water issues fast and documented every recommendation clearly.",
  },
  {
    author: "A. Patel",
    zone: "Doral",
    rating: 5,
    plan: "Equipment Repair",
    quote:
      "Excellent detail level. Our pool looks polished and equipment checks are always on point.",
  },
];

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

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor">
      <path
        strokeWidth="1.7"
        d="m12 3.2 2.7 5.5 6 .9-4.3 4.2 1 5.9L12 16.8 6.6 19.7l1-5.9L3.3 9.6l6-.9L12 3.2Z"
      />
    </svg>
  );
}

function TrustSignalIcon({ id }: { id: TrustSignalIconName }) {
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

function ServicePillarIcon({ id }: { id: ServicePillarIconName }) {
  if (id === "spark") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
        <path d="m12 3.5 1.9 4.3 4.3 1.9-4.3 1.9-1.9 4.3-1.9-4.3-4.3-1.9 4.3-1.9L12 3.5Z" />
        <path d="m18.2 14.8.9 2 .2.2 2 .9-2 .9-.9 2-.9-2-2-.9 2-.9.9-2Z" />
      </svg>
    );
  }
  if (id === "clean") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
        <path d="M3.8 17.2h16.4" />
        <path d="m7.2 14.6 6.6-6.6a1.2 1.2 0 0 1 1.7 0l.5.5a1.2 1.2 0 0 1 0 1.7l-6.6 6.6H7.2Z" />
        <path d="m14.4 6.9 2.8 2.8" />
      </svg>
    );
  }
  if (id === "repair") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
        <path d="m14.6 4.6 4.8 4.8-3 3-4.8-4.8a4 4 0 0 1-5 5l-2.9 2.9a1.4 1.4 0 0 0 2 2l2.9-2.9a4 4 0 0 1 5-5l1-1Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M6.2 5.2h11.6l-1.4 11.6H7.6L6.2 5.2Z" />
      <path d="M8.8 9.2h6.4M9.3 12.2h5.4" />
      <path d="M12 3v2.2" />
    </svg>
  );
}

export default function ClientLanding({ socialLinks }: { socialLinks?: SocialLinks }) {
  const searchParams = useSearchParams();
  const navPressTimer = useRef<number | null>(null);

  const { language, setLanguage, theme, setTheme } = useLandingPreferences();
  const [activeSlide, setActiveSlide] = useState(0);
  const [pauseCarousel, setPauseCarousel] = useState(false);
  const [activeNav, setActiveNav] =
    useState<(typeof SECTION_NAV_ITEMS)[number]["id"]>("overview");
  const [pressedNav, setPressedNav] = useState<string | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const copy = LANDING_COPY[language];
  const promoCopy = SERVICE_PROMO_COPY[language];

  const cityParam = (searchParams.get("city") ?? "").trim();
  const servingLine = cityParam ? `${cityParam} and South Florida` : "South Florida";

  const defaultWhatsAppLink = useMemo(() => {
    const text = encodeURIComponent(
      "Hi AcostasPool, I want a premium maintenance plan for my pool."
    );
    return `https://wa.me/${PHONE_E164.replace("+", "")}?text=${text}`;
  }, []);
  const whatsappLink = socialLinks?.whatsappUrl || defaultWhatsAppLink;

  const youtubeVideoId = (process.env.NEXT_PUBLIC_LANDING_YOUTUBE_ID ?? "").trim();
  const youtubeSrc = `https://www.youtube-nocookie.com/embed/${
    youtubeVideoId || "M7lc1UVf-VE"
  }?rel=0&modestbranding=1`;

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        let candidate: (typeof SECTION_NAV_ITEMS)[number]["id"] | null = null;
        let candidateRatio = 0;
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= candidateRatio) {
            candidate = entry.target.id as (typeof SECTION_NAV_ITEMS)[number]["id"];
            candidateRatio = entry.intersectionRatio;
          }
        }
        if (candidate) {
          setActiveNav(candidate);
        }
      },
      {
        threshold: [0.3, 0.45, 0.6],
        rootMargin: "-18% 0px -45% 0px",
      }
    );

    for (const item of SECTION_NAV_ITEMS) {
      const el = document.getElementById(item.id);
      if (el) {
        observer.observe(el);
      }
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const revealElements = Array.from(
      document.querySelectorAll<HTMLElement>("[data-lp-reveal]")
    );
    if (revealElements.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries, currentObserver) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            currentObserver.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.2, rootMargin: "0px 0px -12% 0px" }
    );

    for (const element of revealElements) {
      observer.observe(element);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (pauseCarousel) {
      return;
    }
    const timer = window.setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % GALLERY_SLIDES.length);
    }, 5500);
    return () => window.clearInterval(timer);
  }, [pauseCarousel]);

  useEffect(() => {
    const onScroll = () => {
      setShowBackToTop(window.scrollY > 520);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    return () => {
      if (navPressTimer.current) {
        window.clearTimeout(navPressTimer.current);
      }
    };
  }, []);

  function handleNavClick(
    event: MouseEvent<HTMLAnchorElement>,
    sectionId: (typeof SECTION_NAV_ITEMS)[number]["id"]
  ) {
    event.preventDefault();
    setPressedNav(sectionId);
    setActiveNav(sectionId);

    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    if (navPressTimer.current) {
      window.clearTimeout(navPressTimer.current);
    }
    navPressTimer.current = window.setTimeout(() => {
      setPressedNav(null);
    }, 220);
  }

  const sectionLabels: Record<(typeof SECTION_NAV_ITEMS)[number]["id"], string> = {
    overview: copy.nav.overview,
    services: copy.nav.services,
    gallery: copy.nav.gallery,
    video: copy.nav.video,
    reviews: copy.nav.reviews,
  };

  return (
    <div className="lp-shell" data-theme={theme}>
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
            <Link href="/" className="lp-nav-link lp-nav-logo-link" data-nav-key="brand">
              <span className="lp-nav-logo-dot" aria-hidden="true" />
              <span className="lp-nav-logo-text">
                <span>Acostas</span>
                <span>Pool</span>
              </span>
            </Link>

            {SECTION_NAV_ITEMS.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="lp-nav-link"
                data-nav-key={item.id}
                data-active={activeNav === item.id}
                data-pressed={pressedNav === item.id}
                onClick={(event) => handleNavClick(event, item.id)}
              >
                {sectionLabels[item.id]}
              </a>
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
        <section id="overview" className="lp-hero">
          <div className="lp-container lp-hero-grid">
            <article className="lp-hero-copy lp-surface" data-lp-reveal>
              <p className="lp-kicker">
                {language === "es"
                  ? `Sirviendo hogares premium en ${servingLine}`
                  : `Serving ${servingLine} premium homes`}
              </p>
              <h1>{copy.hero.title}</h1>
              <p>{copy.hero.subtitle}</p>

              <div className="lp-actions">
                <a href={whatsappLink} className="lp-btn lp-btn-primary">
                  {copy.hero.whatsapp}
                </a>
                <Link href="/contact" className="lp-btn lp-btn-ghost">
                  {copy.hero.quote}
                </Link>
                <a href={`tel:${PHONE_E164}`} className="lp-btn lp-btn-ghost">
                  {copy.hero.callPrefix} {PHONE_DISPLAY}
                </a>
              </div>

              <div className="lp-stats">
                <div>
                  <strong>&lt;24h</strong>
                  <span>{copy.hero.responseTime}</span>
                </div>
                <div>
                  <strong>4.9/5</strong>
                  <span>{copy.hero.satisfaction}</span>
                </div>
                <div>
                  <strong>5+ years</strong>
                  <span>{copy.hero.yearsService}</span>
                </div>
              </div>
            </article>

            <div className="lp-hero-media lp-surface" data-lp-reveal>
              <img src={HERO_IMAGE} alt="Luxury residential pool in South Florida" />
              <div className="lp-hero-media-overlay">
                <p>{copy.hero.mediaNote}</p>
              </div>
            </div>
          </div>

        </section>

        <section id="services" className="lp-section lp-services-section">
          <div className="lp-container">
            <div className="lp-services-intro-shell lp-surface" data-lp-reveal>
              <img
                src={SERVICES_BACKGROUND_IMAGE}
                alt="Premium pool deck with palm trees and modern architecture"
                className="lp-services-intro-bg"
              />
              {SERVICES_BACKGROUND_VIDEO_ENABLED ? (
                <video
                  className="lp-services-intro-video"
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  poster={SERVICES_BACKGROUND_IMAGE}
                  aria-hidden="true"
                >
                  <source src={SERVICES_BACKGROUND_VIDEO} type="video/mp4" />
                </video>
              ) : null}
              <div className="lp-services-intro-overlay" />

              <div className="lp-services-intro-content">
                <div className="lp-services-intro-copy">
                  <p className="lp-kicker">
                    {language === "es"
                      ? "Disenado para hogares del sur de Florida"
                      : "Designed for South Florida homes"}
                  </p>
                  <h2>{copy.services.title}</h2>
                  <p className="lp-section-head-copy">
                    {language === "es"
                      ? "Flujos semanales estructurados, reportes claros y ejecucion enfocada en detalle para mantener tu piscina saludable y consistente."
                      : "Structured weekly workflows, clear reporting, and detail-focused execution to keep your pool healthy and visually consistent."}
                  </p>
                </div>

                <div className="lp-services-intro-trust">
                  {TRUST_SIGNALS.map((item) => (
                    <article key={item.title} className="lp-services-intro-trust-card">
                      <span className="lp-services-trust-icon" aria-hidden="true">
                        <TrustSignalIcon id={item.icon} />
                      </span>
                      <div>
                        <h3>{item.title}</h3>
                        <p>{item.detail}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>

            <aside className="lp-service-promo lp-surface" data-lp-reveal>
              <div className="lp-service-promo-copy">
                <p className="lp-service-promo-badge">{promoCopy.badge}</p>
                <h3>{promoCopy.title}</h3>
                <p>{promoCopy.detail}</p>
                <p className="lp-service-promo-note">{promoCopy.note}</p>
              </div>
              <a href={whatsappLink} className="lp-btn lp-btn-primary lp-service-promo-cta">
                {promoCopy.cta}
              </a>
            </aside>

            <div className="lp-service-plan-grid" data-lp-reveal>
              {SERVICE_PILLARS.map((pillar) => (
                <article key={pillar.title} className="lp-service-plan-card">
                  <div className="lp-service-plan-media">
                    <img src={pillar.image} alt={`${pillar.title} service preview`} />
                  </div>
                  <div className="lp-service-plan-head">
                    <span className="lp-service-icon" aria-hidden="true">
                      <ServicePillarIcon id={pillar.icon} />
                    </span>
                    <h3>{pillar.title}</h3>
                  </div>
                  <p>{pillar.subtitle}</p>
                  <ul>
                    {pillar.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="gallery" className="lp-section">
          <div className="lp-container">
            <div className="lp-section-head">
              <h2>{copy.gallery.title}</h2>
            </div>

            <div
              className="lp-carousel lp-surface"
              data-lp-reveal
              onMouseEnter={() => setPauseCarousel(true)}
              onMouseLeave={() => setPauseCarousel(false)}
            >
              {GALLERY_SLIDES.map((slide, index) => (
                <article key={slide.id} className="lp-slide" data-active={activeSlide === index}>
                  <img src={slide.image} alt={slide.title} />
                </article>
              ))}

              <div className="lp-slide-caption">{GALLERY_SLIDES[activeSlide]?.title}</div>
              <div className="lp-carousel-counter" aria-live="polite">
                {activeSlide + 1} / {GALLERY_SLIDES.length}
              </div>

              <button
                type="button"
                className="lp-slide-nav"
                data-dir="prev"
                onClick={() =>
                  setActiveSlide(
                    (prev) => (prev - 1 + GALLERY_SLIDES.length) % GALLERY_SLIDES.length
                  )
                }
                aria-label="Previous image"
              >
                <span>{"<"}</span>
              </button>

              <button
                type="button"
                className="lp-slide-nav"
                data-dir="next"
                onClick={() => setActiveSlide((prev) => (prev + 1) % GALLERY_SLIDES.length)}
                aria-label="Next image"
              >
                <span>{">"}</span>
              </button>
            </div>

            <div className="lp-slide-dots">
              {GALLERY_SLIDES.map((slide, index) => (
                <button
                  key={slide.id}
                  type="button"
                  className="lp-dot"
                  data-active={activeSlide === index}
                  onClick={() => setActiveSlide(index)}
                  aria-label={`Show image ${index + 1}`}
                />
              ))}
            </div>

          </div>
        </section>

        <section id="video" className="lp-section">
          <div className="lp-container">
            <div className="lp-section-head">
              <h2>{copy.visit.title}</h2>
            </div>

            <div className="lp-video-layout" data-lp-reveal>
              <div className="lp-video-card lp-surface">
                <iframe
                  src={youtubeSrc}
                  title="AcostasPool service video"
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>

              <article className="lp-video-copy lp-surface">
                <p className="lp-kicker">Visit protocol</p>
                <h3>Quality checks in every routine service</h3>
                <p>
                  Every stop follows a consistent sequence so your water quality, equipment
                  performance, and presentation remain under control.
                </p>
                <div className="lp-video-copy-lists">
                  <ul>
                    <li>Water chemistry testing and balancing</li>
                    <li>Skimming, brushing, and vacuum workflow</li>
                  </ul>
                  <ul>
                    <li>Pump, filter, and circulation review</li>
                    <li>Short report with key findings</li>
                  </ul>
                </div>
                <div className="lp-video-copy-tags">
                  <span>Checklist-based execution</span>
                  <span>Photo-ready finish quality</span>
                  <span>Preventive equipment focus</span>
                </div>
                <Link href="/about" className="lp-btn lp-btn-soft">
                  Learn more about our process
                </Link>
              </article>
            </div>
          </div>
        </section>

        <section id="reviews" className="lp-section">
          <div className="lp-container">
            <div className="lp-section-head">
              <h2>{copy.reviews.title}</h2>
            </div>

            <div className="lp-review-grid">
              {REVIEWS.map((review) => {
                const initials = review.author
                  .split(" ")
                  .map((token) => token.charAt(0))
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();

                return (
                  <article key={review.author} className="lp-review-card lp-surface" data-lp-reveal>
                    <header className="lp-review-head">
                      <div className="lp-review-avatar" aria-hidden="true">
                        {initials}
                      </div>
                      <div className="lp-review-meta">
                        <p className="lp-review-author">{review.author}</p>
                        <p className="lp-review-zone">{review.zone}</p>
                      </div>
                    </header>

                    <div className="lp-review-stars" aria-label={`${review.rating} out of 5 stars`}>
                      {Array.from({ length: 5 }).map((_, index) => (
                        <StarIcon key={`${review.author}-${index}`} filled={index < review.rating} />
                      ))}
                      <span>{review.rating.toFixed(1)}</span>
                    </div>

                    <p className="lp-review-quote">&ldquo;{review.quote}&rdquo;</p>
                    <p className="lp-review-plan">{review.plan}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      <button
        type="button"
        className="lp-back-to-top"
        data-visible={showBackToTop}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Back to top"
      >
        <span>{"^"}</span>
      </button>

      <LandingFooter
        language={language}
        theme={theme}
        onLanguageChange={(nextLocale) => setLanguage(nextLocale)}
        onThemeChange={(nextTheme) => setTheme(nextTheme)}
        socialLinks={socialLinks}
      />
    </div>
  );
}
