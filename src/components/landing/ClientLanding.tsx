"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import type { LandingLocale } from "@/components/landing/preferences";
import { useLandingPreferences } from "@/components/landing/useLandingPreferences";

type SocialPlatform =
  | "instagram"
  | "facebook"
  | "whatsapp"
  | "x"
  | "youtube"
  | "tiktok";
type TrustSignalIconName = "shield" | "camera" | "route";
type ServicePillarIconName = "spark" | "clean" | "repair" | "chemistry";

type SocialLinks = {
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
      login: "Client log in",
    },
    announce: "South Florida premium pool maintenance with clear weekly execution",
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
      login: "Acceso clientes",
    },
    announce: "Mantenimiento premium de piscinas en el sur de Florida con ejecucion semanal clara",
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
const SUPPORT_EMAIL = "contact@acostaspool.com";

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

const SERVICE_PILLARS: Array<{
  title: string;
  subtitle: string;
  image: string;
  icon: ServicePillarIconName;
  points: string[];
}> = [
  {
    title: "Weekly Signature Care",
    subtitle: "Weekly cleaning and chemistry balancing for stable, polished water.",
    image: "/landing/media/curated/images/pool-service-weekly-technician.jpg",
    icon: "spark",
    points: [
      "Surface skimming and brushing",
      "Vacuum and basket cleaning",
      "Water chemistry balance",
      "Equipment status review",
    ],
  },
  {
    title: "Pool Cleaning",
    subtitle: "Debris removal, wall brushing, and filter care for crystal-clear water.",
    image: "/landing/media/curated/images/pool-service-surface-net-closeup.jpg",
    icon: "clean",
    points: [
      "Filter cleaning routine",
      "Wall and tile brushing",
      "Vacuuming service",
      "Clarity-focused finish",
    ],
  },
  {
    title: "Equipment Repair",
    subtitle: "Troubleshooting and repair for pumps, filters, and circulation components.",
    image: "/landing/media/curated/images/pool-equipment-filtration-room.jpg",
    icon: "repair",
    points: [
      "Leak and pressure checks",
      "Pump and motor service",
      "Filter replacement support",
      "Heater maintenance review",
    ],
  },
  {
    title: "Water Testing Service",
    subtitle: "Balanced chemistry with preventive checks to keep swimmers safe.",
    image: "/landing/media/curated/images/pool-service-water-chemistry-testing.jpg",
    icon: "chemistry",
    points: [
      "pH and chlorine testing",
      "Alkalinity monitoring",
      "Imbalance detection",
      "Clear treatment guidance",
    ],
  },
];

const SERVICES_BACKGROUND_IMAGE = "/landing/media/curated/images/pool-home-services-hero-technician.jpg";
const SERVICES_BACKGROUND_VIDEO =
  process.env.NEXT_PUBLIC_LANDING_SERVICES_BG_VIDEO_SRC?.trim() ||
  "/landing/media/curated/videos/pool-background-water-loop.mp4";
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
    plan: "Weekly Signature Care",
    quote:
      "Consistent service quality every week. The team keeps communication clean and direct.",
  },
  {
    author: "S. Henderson",
    zone: "Kendall",
    rating: 5,
    plan: "Pool Cleaning",
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

const FOOTER_LINK_GROUPS = [
  {
    title: "Company",
    items: [
      { label: "About us", href: "/about" },
      { label: "Reviews", href: "#reviews" },
      { label: "Gallery", href: "#gallery" },
    ],
  },
  {
    title: "Services",
    items: [
      { label: "Weekly Signature Care", href: "#services" },
      { label: "Repair and Recovery", href: "#services" },
      { label: "Premium Property Standard", href: "#services" },
    ],
  },
  {
    title: "Contact",
    items: [
      { label: PHONE_DISPLAY, href: `tel:${PHONE_E164}` },
      { label: SUPPORT_EMAIL, href: `mailto:${SUPPORT_EMAIL}` },
      { label: "Contact page", href: "/contact" },
    ],
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

  const socialItems = useMemo<SocialItem[]>(() => {
    const items: SocialItem[] = [
      { id: "instagram", label: "Instagram", href: socialLinks?.instagramUrl ?? "" },
      { id: "x", label: "X", href: socialLinks?.xUrl ?? "" },
      { id: "youtube", label: "YouTube", href: socialLinks?.youtubeUrl ?? "" },
      { id: "facebook", label: "Facebook", href: socialLinks?.facebookUrl ?? "" },
      { id: "whatsapp", label: "WhatsApp", href: socialLinks?.whatsappUrl ?? "" },
      { id: "tiktok", label: "TikTok", href: socialLinks?.tiktokUrl ?? "" },
    ];
    return items.filter((item) => Boolean(item.href));
  }, [socialLinks]);

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
            {SECTION_NAV_ITEMS.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="lp-nav-link"
                data-active={activeNav === item.id}
                data-pressed={pressedNav === item.id}
                onClick={(event) => handleNavClick(event, item.id)}
              >
                {sectionLabels[item.id]}
              </a>
            ))}

            {PAGE_NAV_ITEMS.map((item) => (
              <Link key={item.href} href={item.href} className="lp-nav-link lp-nav-link-page">
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

      <footer className="lp-footer">
        <div className="lp-container">
          {socialItems.length > 0 ? (
            <div className="lp-footer-follow">
              <p>Follow us</p>
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

          <div className="lp-footer-grid">
            <div className="lp-footer-brand">
              <Link href="/" className="lp-brand">
                <span className="lp-brand-dot" aria-hidden="true" />
                <span className="lp-brand-name">
                  <span>Acostas</span>
                  <span>Pool</span>
                </span>
              </Link>
              <p>Professional maintenance for premium residential pools in South Florida.</p>
            </div>

            {FOOTER_LINK_GROUPS.map((group) => (
              <div key={group.title} className="lp-footer-col">
                <h3>{group.title}</h3>
                <ul>
                  {group.items.map((item) => {
                    const isExternal = item.href.startsWith("tel:") || item.href.startsWith("mailto:");
                    return (
                      <li key={item.label}>
                        {isExternal ? (
                          <a href={item.href}>{item.label}</a>
                        ) : item.href.startsWith("#") ? (
                          <a href={item.href}>{item.label}</a>
                        ) : (
                          <Link href={item.href}>{item.label}</Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

          <div className="lp-footer-meta">
            <p>(c) {new Date().getFullYear()} AcostasPool. All rights reserved.</p>
            <div className="lp-footer-meta-links">
              <Link href="/about">About</Link>
              <Link href="/contact">Contact</Link>
              <Link href="/login">Log in</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
