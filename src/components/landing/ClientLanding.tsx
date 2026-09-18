"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import LandingFooter, { type LandingSocialLinks } from "@/components/landing/LandingFooter";
import LandingHeader from "@/components/landing/LandingHeader";
import {
  LANDING_SECTION_NAV_ITEMS,
  getLandingShellCopy,
  type LandingSectionId,
} from "@/components/landing/landing-copy";
import type { LandingLocale } from "@/components/landing/preferences";
import { useLandingPreferences } from "@/components/landing/useLandingPreferences";
import { useIsHydrated, useMediaQuery } from "@/components/landing/useMediaQuery";
import {
  DEFAULT_LANDING_PROMO_COPY,
  LANDING_CONTACT,
  LANDING_IMAGES,
  buildWhatsAppLink,
  getLandingYoutubeEmbedSrc,
  type LandingImageAsset,
  type LandingPromoCopyByLocale,
} from "@/lib/landing-config";

type TrustSignalIconName = "shield" | "camera" | "route";
type ServicePillarIconName = "spark" | "clean" | "repair" | "chemistry";

type SocialLinks = LandingSocialLinks;
type LandingConfig = {
  youtubeUrl: string | null;
  promo: LandingPromoCopyByLocale;
};

const LANDING_COPY: Record<
  LandingLocale,
  {
    hero: {
      title: string;
      subtitle: string;
      whatsapp: string;
      quote: string;
      callPrefix: string;
      responseTime: string;
      satisfaction: string;
      yearsValue: string;
      yearsService: string;
      mediaNote: string;
    };
    services: {
      title: string;
    };
    gallery: {
      title: string;
      carouselLabel: string;
      pauseLabel: string;
      slideLabel: (position: number, total: number) => string;
    };
    visit: {
      title: string;
      kicker: string;
      heading: string;
      subtitle: string;
      listA: [string, string];
      listB: [string, string];
      tags: [string, string, string];
      action: string;
    };
    reviews: {
      title: string;
    };
  }
> = {
  en: {
    hero: {
      title: "Professional pool care that feels effortless for your home.",
      subtitle:
        "Reliable weekly plans, clean communication, and proactive maintenance for homeowners who expect quality without friction.",
      whatsapp: "Start on WhatsApp",
      quote: "Get a quote",
      callPrefix: "Call",
      responseTime: "Average response time",
      satisfaction: "Client satisfaction",
      yearsValue: "5+ years",
      yearsService: "South Florida service",
      mediaNote: "Every visit can include service photos, chemistry checks, and equipment notes.",
    },
    services: {
      title: "Pool services designed for clean water and dependable operation.",
    },
    gallery: {
      title: "Visual quality standards from real service environments.",
      carouselLabel: "Service gallery",
      pauseLabel: "Pause automatic rotation",
      slideLabel: (position, total) => `Image ${position} of ${total}`,
    },
    visit: {
      title: "What each visit includes.",
      kicker: "Visit protocol",
      heading: "Quality checks in every routine service",
      subtitle:
        "Every stop follows a consistent sequence so your water quality, equipment performance, and presentation remain under control.",
      listA: ["Water chemistry testing and balancing", "Skimming, brushing, and vacuum workflow"],
      listB: ["Pump, filter, and circulation review", "Short report with key findings"],
      tags: ["Checklist-based execution", "Photo-ready finish quality", "Preventive equipment focus"],
      action: "Learn more about our process",
    },
    reviews: {
      title: "Premium homeowner reviews.",
    },
  },
  es: {
    hero: {
      title: "Cuidado profesional de piscinas para que tu hogar funcione sin fricción.",
      subtitle:
        "Planes semanales confiables, comunicación clara y mantenimiento preventivo para propietarios que exigen calidad.",
      whatsapp: "Comenzar por WhatsApp",
      quote: "Solicitar cotización",
      callPrefix: "Llamar",
      responseTime: "Tiempo promedio de respuesta",
      satisfaction: "Satisfacción del cliente",
      yearsValue: "5+ años",
      yearsService: "Servicio en South Florida",
      mediaNote:
        "Cada visita puede incluir fotos del servicio, chequeo químico y notas de equipos.",
    },
    services: {
      title: "Servicios de piscina pensados para agua limpia y operación confiable.",
    },
    gallery: {
      title: "Estándares visuales de calidad en entornos reales de servicio.",
      carouselLabel: "Galería de servicios",
      pauseLabel: "Pausar la rotación automática",
      slideLabel: (position, total) => `Imagen ${position} de ${total}`,
    },
    visit: {
      title: "Qué incluye cada visita.",
      kicker: "Protocolo de visita",
      heading: "Chequeos de calidad en cada servicio rutinario",
      subtitle:
        "Cada parada sigue una secuencia consistente para mantener controlados la calidad del agua, el rendimiento de equipos y la presentación.",
      listA: [
        "Prueba y balanceo de química del agua",
        "Limpieza de superficie, cepillado y aspirado",
      ],
      listB: [
        "Revisión de bomba, filtro y circulación",
        "Reporte corto con hallazgos clave",
      ],
      tags: [
        "Ejecución con checklist",
        "Acabado visual listo para fotos",
        "Enfoque preventivo en equipos",
      ],
      action: "Conoce más sobre nuestro proceso",
    },
    reviews: {
      title: "Reseñas de propietarios premium.",
    },
  },
};

const HERO_IMAGE = LANDING_IMAGES.heroDeck;

/* `sizes` hints approximate the rendered width of each image slot (see globals.css grids). */
const FULL_WIDTH_IMAGE_SIZES = "(max-width: 760px) 94vw, 88vw";
const HALF_WIDTH_IMAGE_SIZES = "(max-width: 1180px) 94vw, 44vw";
const SERVICE_CARD_IMAGE_SIZES = "(max-width: 760px) 84vw, (max-width: 1180px) 44vw, 22vw";

const CAROUSEL_INTERVAL_MS = 5500;
const BACK_TO_TOP_THRESHOLD_PX = 520;
const NAV_PRESS_FEEDBACK_MS = 220;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const TRUST_SIGNALS_COPY: Record<
  LandingLocale,
  Array<{ title: string; detail: string; icon: TrustSignalIconName }>
> = {
  en: [
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
  ],
  es: [
    {
      title: "Licenciados y asegurados",
      detail: "Operación alineada con Florida para servicio residencial y trazabilidad de atención.",
      icon: "shield",
    },
    {
      title: "Notas con evidencia fotográfica",
      detail: "Cada visita incluye bitácora visual con observaciones de química y equipos.",
      icon: "camera",
    },
    {
      title: "Rutas semanales predecibles",
      detail: "Cadencia estructurada y disciplina de ruta para resultados limpios y consistentes.",
      icon: "route",
    },
  ],
};

const SERVICE_PILLARS_COPY: Record<
  LandingLocale,
  Array<{
    title: string;
    subtitle: string;
    image: LandingImageAsset;
    icon: ServicePillarIconName;
    points: string[];
  }>
> = {
  en: [
    {
      title: "One-Month Pool Cleaning",
      subtitle: "A one-month reset to bring your pool back to clear, comfortable condition.",
      image: LANDING_IMAGES.weeklyTechnician,
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
      image: LANDING_IMAGES.surfaceNetCloseup,
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
      image: LANDING_IMAGES.waterChemistryTesting,
      icon: "chemistry",
      points: [
        "Leak diagnostics and targeted repair",
        "Filter wash and flow optimization",
        "Wall and tile scrubbing",
        "Precision vacuum service",
      ],
    },
    {
      title: "Pool Repair",
      subtitle:
        "Repair-focused service for pool body, finish, and circulation lines to restore safe, clean operation.",
      image: LANDING_IMAGES.underwaterView,
      icon: "repair",
      points: [
        "Shell and crack condition assessment",
        "Tile, grout, and coping repair planning",
        "Leak isolation in plumbing and structure",
        "Skimmer, return, and drain line corrections",
      ],
    },
  ],
  es: [
    {
      title: "Limpieza de piscina por un mes",
      subtitle: "Reinicio de un mes para devolver tu piscina a una condición clara y cómoda.",
      image: LANDING_IMAGES.weeklyTechnician,
      icon: "clean",
      points: [
        "Visita de limpieza profunda",
        "Remoción de residuos y algas",
        "Aspirado y cepillado completo",
        "Revisión del sistema de filtración",
        "Ideal para eventos o reinicio de temporada",
      ],
    },
    {
      title: "Mantenimiento regular",
      subtitle: "Cuidado semanal consistente para mantener el agua balanceada y los equipos operando bien.",
      image: LANDING_IMAGES.surfaceNetCloseup,
      icon: "spark",
      points: [
        "Limpieza completa y aspirado",
        "Balanceo de química del agua",
        "Inspección de equipos",
        "Limpieza de canastas y superficie",
        "Plan continuo de mantenimiento",
      ],
    },
    {
      title: "Limpieza de piscina + detección de fugas",
      subtitle: "Limpieza detallada con diagnóstico temprano de fugas para proteger estructura y flujo.",
      image: LANDING_IMAGES.waterChemistryTesting,
      icon: "chemistry",
      points: [
        "Diagnóstico de fugas y reparación dirigida",
        "Lavado de filtro y optimización de flujo",
        "Cepillado de paredes y azulejos",
        "Servicio de aspirado de precisión",
      ],
    },
    {
      title: "Reparación de piscina",
      subtitle:
        "Servicio enfocado en reparación de estructura, acabados y líneas de circulación para recuperar operación segura.",
      image: LANDING_IMAGES.underwaterView,
      icon: "repair",
      points: [
        "Evaluación de casco y grietas",
        "Plan de reparación de azulejo, grout y coping",
        "Aislamiento de fugas en tuberías y estructura",
        "Correcciones en skimmer, retornos y drenajes",
      ],
    },
  ],
};

const SERVICES_BACKGROUND_IMAGE = LANDING_IMAGES.servicesHeroTechnician;
const DEFAULT_SERVICES_BACKGROUND_VIDEO =
  "/landing/media/curated/videos/pool-services-clean-water-promo.mp4";
const CONFIGURED_SERVICES_BACKGROUND_VIDEO =
  process.env.NEXT_PUBLIC_LANDING_SERVICES_BG_VIDEO_SRC?.trim() || "";
const SERVICES_BACKGROUND_VIDEO_SOURCES = [
  CONFIGURED_SERVICES_BACKGROUND_VIDEO,
  DEFAULT_SERVICES_BACKGROUND_VIDEO,
].filter((value, index, list) => Boolean(value) && list.indexOf(value) === index);
const SERVICES_BACKGROUND_VIDEO_ENABLED =
  (process.env.NEXT_PUBLIC_LANDING_SERVICES_BG_VIDEO_ENABLED ?? "true").toLowerCase() !==
  "false";

const GALLERY_SLIDES_COPY: Record<
  LandingLocale,
  Array<{
    id: string;
    title: string;
    image: LandingImageAsset;
  }>
> = {
  en: [
    {
      id: "pool-1",
      title: "Resort-level finish, every week",
      image: LANDING_IMAGES.galleryVacuumCloseup,
    },
    {
      id: "pool-2",
      title: "Balanced chemistry and healthy circulation",
      image: LANDING_IMAGES.galleryToolsSet,
    },
    {
      id: "pool-3",
      title: "Clean presentation for premium properties",
      image: LANDING_IMAGES.galleryFullService,
    },
    {
      id: "pool-4",
      title: "Equipment health and preventive checks",
      image: LANDING_IMAGES.underwaterView,
    },
  ],
  es: [
    {
      id: "pool-1",
      title: "Acabado tipo resort, cada semana",
      image: LANDING_IMAGES.galleryVacuumCloseup,
    },
    {
      id: "pool-2",
      title: "Química balanceada y circulación saludable",
      image: LANDING_IMAGES.galleryToolsSet,
    },
    {
      id: "pool-3",
      title: "Presentación limpia para propiedades premium",
      image: LANDING_IMAGES.galleryFullService,
    },
    {
      id: "pool-4",
      title: "Salud de equipos y chequeos preventivos",
      image: LANDING_IMAGES.underwaterView,
    },
  ],
};

const REVIEWS_COPY: Record<
  LandingLocale,
  Array<{
    author: string;
    zone: string;
    rating: number;
    plan: string;
    quote: string;
  }>
> = {
  en: [
    {
      author: "R. Martínez",
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
      plan: "Pool Repair",
      quote:
        "Excellent detail level. Our pool looks polished and they identified repair needs early.",
    },
  ],
  es: [
    {
      author: "R. Martínez",
      zone: "Coral Gables",
      rating: 5,
      plan: "Mantenimiento regular",
      quote:
        "Calidad de servicio consistente cada semana. El equipo mantiene una comunicación clara y directa.",
    },
    {
      author: "S. Henderson",
      zone: "Kendall",
      rating: 5,
      plan: "Limpieza de piscina + detección de fugas",
      quote:
        "Resolvieron problemas recurrentes del agua rápido y documentaron cada recomendación con claridad.",
    },
    {
      author: "A. Patel",
      zone: "Doral",
      rating: 5,
      plan: "Reparación de piscina",
      quote:
        "Excelente nivel de detalle. Nuestra piscina se ve impecable y detectaron reparaciones a tiempo.",
    },
  ],
};

/*
 * The carousel toggle is styled with utilities because `.lp-slide-nav` pins its
 * buttons to the vertical center with unlayered rules that would win over any
 * utility override (see LandingHeader.tsx for the same constraint).
 */
const CAROUSEL_TOGGLE_CLASS =
  "absolute right-[0.62rem] top-[0.62rem] z-[4] inline-flex h-[2.45rem] w-[2.45rem] items-center justify-center " +
  "rounded-full border border-white/35 bg-[rgba(7,18,32,0.52)] text-[#f2f9ff]";

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

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width="14" height="14">
      <rect x="6" y="4.5" width="4" height="15" rx="1" />
      <rect x="14" y="4.5" width="4" height="15" rx="1" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width="14" height="14">
      <path d="M8 5.2v13.6a1 1 0 0 0 1.5.9l10.4-6.8a1 1 0 0 0 0-1.7L9.5 4.3A1 1 0 0 0 8 5.2Z" />
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

function supportsIntersectionObserver(): boolean {
  return typeof window !== "undefined" && "IntersectionObserver" in window;
}

function isServicesVideoPlaybackAllowed(reducedMotion: boolean): boolean {
  const connection = (
    navigator as Navigator & {
      connection?: {
        saveData?: boolean;
        effectiveType?: string;
      };
    }
  ).connection;
  const saveData = Boolean(connection?.saveData);
  const effectiveType = connection?.effectiveType?.toLowerCase() ?? "";
  const slowConnection =
    effectiveType.includes("slow-2g") ||
    effectiveType.includes("2g") ||
    effectiveType.includes("3g");

  return !reducedMotion && !saveData && !slowConnection;
}

export default function ClientLanding({
  socialLinks,
  landingConfig,
}: {
  socialLinks?: SocialLinks;
  landingConfig?: LandingConfig;
}) {
  const searchParams = useSearchParams();
  const navPressTimer = useRef<number | null>(null);

  const { language, setLanguage, theme, setTheme } = useLandingPreferences();
  const [activeSlide, setActiveSlide] = useState(0);
  const [hoverPaused, setHoverPaused] = useState(false);
  /** `null` follows the reduced-motion preference; a boolean is an explicit user choice. */
  const [userPaused, setUserPaused] = useState<boolean | null>(null);
  const [activeNav, setActiveNav] = useState<LandingSectionId>("overview");
  const [pressedNav, setPressedNav] = useState<LandingSectionId | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [servicesVideoAllowed, setServicesVideoAllowed] =
    useState(SERVICES_BACKGROUND_VIDEO_ENABLED);
  const [servicesVideoVisible, setServicesVideoVisible] = useState(false);
  const [servicesVideoSourceIndex, setServicesVideoSourceIndex] = useState(0);
  const servicesIntroRef = useRef<HTMLDivElement | null>(null);
  const servicesVideoRef = useRef<HTMLVideoElement | null>(null);
  const copy = LANDING_COPY[language];
  const shellCopy = getLandingShellCopy(language);
  const trustSignals = TRUST_SIGNALS_COPY[language];
  const servicePillars = SERVICE_PILLARS_COPY[language];
  const gallerySlides = GALLERY_SLIDES_COPY[language];
  const reviews = REVIEWS_COPY[language];
  const promoCopy = landingConfig?.promo[language] ?? DEFAULT_LANDING_PROMO_COPY[language];
  const reducedMotion = useMediaQuery(REDUCED_MOTION_QUERY);
  const isHydrated = useIsHydrated();
  const carouselPaused = userPaused ?? reducedMotion;
  const autoplayActive = !hoverPaused && !carouselPaused;

  /*
   * Scroll-reveal is opt-in: the attribute is only rendered after hydration,
   * when IntersectionObserver is available and reduced motion is not requested.
   * Server HTML (and no-JS visitors) therefore never get `[data-lp-reveal]`,
   * the selector globals.css uses to start elements at `opacity: 0`.
   */
  const revealEnabled = isHydrated && !reducedMotion && supportsIntersectionObserver();
  const revealAttribute = revealEnabled ? "" : undefined;

  const cityParam = (searchParams.get("city") ?? "").trim();
  const servingRegion = cityParam
    ? language === "es"
      ? `${cityParam} y South Florida`
      : `${cityParam} and South Florida`
    : "South Florida";

  const whatsappLink =
    socialLinks?.whatsappUrl || buildWhatsAppLink(shellCopy.whatsapp.message);

  const youtubeSrc = getLandingYoutubeEmbedSrc(
    landingConfig?.youtubeUrl,
    process.env.NEXT_PUBLIC_LANDING_YOUTUBE_ID
  );

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        let candidate: LandingSectionId | null = null;
        let candidateRatio = 0;
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= candidateRatio) {
            candidate = entry.target.id as LandingSectionId;
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

    for (const item of LANDING_SECTION_NAV_ITEMS) {
      const el = document.getElementById(item.id);
      if (el) {
        observer.observe(el);
      }
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!revealEnabled) {
      return;
    }

    // Flags JS availability on the root element for stylesheets that want to
    // scope reveal styles (e.g. `html.lp-js [data-lp-reveal]`).
    document.documentElement.classList.add("lp-js");

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
  }, [revealEnabled]);

  useEffect(() => {
    if (!servicesVideoAllowed) {
      return;
    }

    const section = servicesIntroRef.current;
    if (!section) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) {
          return;
        }
        observer.disconnect();
        if (!isServicesVideoPlaybackAllowed(reducedMotion)) {
          setServicesVideoAllowed(false);
          return;
        }
        setServicesVideoVisible(true);
      },
      {
        rootMargin: "240px 0px",
        threshold: 0.01,
      }
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, [servicesVideoAllowed, reducedMotion]);

  useEffect(() => {
    if (!servicesVideoAllowed || !servicesVideoVisible) {
      return;
    }

    const video = servicesVideoRef.current;
    if (!video) {
      return;
    }

    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {
        // Autoplay can be blocked on some phones; poster image remains visible.
      });
    }
  }, [servicesVideoAllowed, servicesVideoVisible, servicesVideoSourceIndex]);

  useEffect(() => {
    if (!autoplayActive) {
      return;
    }
    const timer = window.setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % gallerySlides.length);
    }, CAROUSEL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [gallerySlides.length, autoplayActive]);

  useEffect(() => {
    const onScroll = () => {
      setShowBackToTop(window.scrollY > BACK_TO_TOP_THRESHOLD_PX);
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

  function handleNavClick(event: MouseEvent<HTMLAnchorElement>, sectionId: LandingSectionId) {
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
    }, NAV_PRESS_FEEDBACK_MS);
  }

  return (
    <div className="lp-shell" data-theme={theme}>
      <LandingHeader
        language={language}
        theme={theme}
        onLanguageChange={setLanguage}
        onThemeChange={setTheme}
        whatsappLink={whatsappLink}
        sectionNav={{ activeId: activeNav, pressedId: pressedNav, onNavigate: handleNavClick }}
      />

      <main id="main-content" className="lp-main" tabIndex={-1}>
        <section id="overview" className="lp-hero">
          <div className="lp-container lp-hero-grid">
            <article className="lp-hero-copy lp-surface">
              <p className="lp-kicker">
                {language === "es"
                  ? `Sirviendo hogares premium en ${servingRegion}`
                  : `Serving ${servingRegion} premium homes`}
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
                <a href={`tel:${LANDING_CONTACT.phoneE164}`} className="lp-btn lp-btn-ghost">
                  {copy.hero.callPrefix} {LANDING_CONTACT.phoneDisplay}
                </a>
              </div>

              <div className="lp-stats">
                <div>
                  <strong>&lt;12h</strong>
                  <span>{copy.hero.responseTime}</span>
                </div>
                <div>
                  <strong>4.9/5</strong>
                  <span>{copy.hero.satisfaction}</span>
                </div>
                <div>
                  <strong>{copy.hero.yearsValue}</strong>
                  <span>{copy.hero.yearsService}</span>
                </div>
              </div>
            </article>

            <div className="lp-hero-media lp-surface">
              <Image
                src={HERO_IMAGE.src}
                width={HERO_IMAGE.width}
                height={HERO_IMAGE.height}
                sizes={HALF_WIDTH_IMAGE_SIZES}
                priority
                fetchPriority="high"
                alt={
                  language === "es"
                    ? "Piscina residencial de lujo en el sur de Florida"
                    : "Luxury residential pool in South Florida"
                }
              />
              <div className="lp-hero-media-overlay">
                <p>{copy.hero.mediaNote}</p>
              </div>
            </div>
          </div>

        </section>

        <section id="services" className="lp-section lp-services-section">
          <div className="lp-container">
            <div
              ref={servicesIntroRef}
              className="lp-services-intro-shell lp-surface"
              data-lp-reveal={revealAttribute}
            >
              <Image
                src={SERVICES_BACKGROUND_IMAGE.src}
                width={SERVICES_BACKGROUND_IMAGE.width}
                height={SERVICES_BACKGROUND_IMAGE.height}
                sizes={FULL_WIDTH_IMAGE_SIZES}
                alt={
                  language === "es"
                    ? "Área premium de piscina con palmeras y arquitectura moderna"
                    : "Premium pool deck with palm trees and modern architecture"
                }
                className="lp-services-intro-bg"
              />
              {servicesVideoAllowed && servicesVideoVisible ? (
                <video
                  key={SERVICES_BACKGROUND_VIDEO_SOURCES[servicesVideoSourceIndex]}
                  ref={servicesVideoRef}
                  className="lp-services-intro-video"
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="none"
                  poster={SERVICES_BACKGROUND_IMAGE.src}
                  aria-hidden="true"
                  onError={() => {
                    if (servicesVideoSourceIndex < SERVICES_BACKGROUND_VIDEO_SOURCES.length - 1) {
                      setServicesVideoSourceIndex((current) => current + 1);
                      return;
                    }
                    setServicesVideoAllowed(false);
                  }}
                >
                  <source
                    src={SERVICES_BACKGROUND_VIDEO_SOURCES[servicesVideoSourceIndex]}
                    type="video/mp4"
                  />
                </video>
              ) : null}
              <div className="lp-services-intro-overlay" />

              <div className="lp-services-intro-content">
                <div className="lp-services-intro-copy">
                  <p className="lp-kicker">
                    {language === "es"
                      ? "Diseñado para hogares del sur de Florida"
                      : "Designed for South Florida homes"}
                  </p>
                  <h2>{copy.services.title}</h2>
                  <p className="lp-section-head-copy">
                    {language === "es"
                      ? "Flujos semanales estructurados, reportes claros y ejecución enfocada en detalle para mantener tu piscina saludable y consistente."
                      : "Structured weekly workflows, clear reporting, and detail-focused execution to keep your pool healthy and visually consistent."}
                  </p>
                </div>

                <div className="lp-services-intro-trust">
                  {trustSignals.map((item) => (
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

            <aside className="lp-service-promo lp-surface" data-lp-reveal={revealAttribute}>
              <div className="lp-service-promo-copy">
                <p className="lp-service-promo-badge">{promoCopy.badge}</p>
                <h3>{promoCopy.title}</h3>
                <p className="lp-service-promo-detail">{promoCopy.detail}</p>
                <p className="lp-service-promo-note">{promoCopy.note}</p>
              </div>
              <div className="lp-service-promo-action">
                <p>{promoCopy.action}</p>
                <a href={whatsappLink} className="lp-btn lp-btn-primary lp-service-promo-cta">
                  {promoCopy.cta}
                </a>
              </div>
            </aside>

            <div className="lp-service-plan-grid" data-lp-reveal={revealAttribute}>
              {servicePillars.map((pillar) => (
                <article key={pillar.title} className="lp-service-plan-card">
                  <div className="lp-service-plan-media">
                    <Image
                      src={pillar.image.src}
                      width={pillar.image.width}
                      height={pillar.image.height}
                      sizes={SERVICE_CARD_IMAGE_SIZES}
                      alt={
                        language === "es"
                          ? `Vista previa del servicio ${pillar.title}`
                          : `${pillar.title} service preview`
                      }
                    />
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
              data-lp-reveal={revealAttribute}
              role="region"
              aria-roledescription="carousel"
              aria-label={copy.gallery.carouselLabel}
              onMouseEnter={() => setHoverPaused(true)}
              onMouseLeave={() => setHoverPaused(false)}
              onFocus={() => setHoverPaused(true)}
              onBlur={() => setHoverPaused(false)}
            >
              {gallerySlides.map((slide, index) => {
                const isActive = activeSlide === index;
                return (
                  <article
                    key={slide.id}
                    className="lp-slide"
                    data-active={isActive}
                    role="group"
                    aria-roledescription="slide"
                    aria-label={copy.gallery.slideLabel(index + 1, gallerySlides.length)}
                    aria-hidden={!isActive}
                  >
                    <Image
                      src={slide.image.src}
                      width={slide.image.width}
                      height={slide.image.height}
                      sizes={FULL_WIDTH_IMAGE_SIZES}
                      alt={slide.title}
                    />
                  </article>
                );
              })}

              <div className="lp-slide-caption">{gallerySlides[activeSlide]?.title}</div>
              <div className="lp-carousel-counter" aria-live={autoplayActive ? "off" : "polite"}>
                {activeSlide + 1} / {gallerySlides.length}
              </div>

              <button
                type="button"
                className="lp-slide-nav"
                data-dir="prev"
                onClick={() =>
                  setActiveSlide(
                    (prev) => (prev - 1 + gallerySlides.length) % gallerySlides.length
                  )
                }
                aria-label={language === "es" ? "Imagen anterior" : "Previous image"}
              >
                <span>{"<"}</span>
              </button>

              <button
                type="button"
                className="lp-slide-nav"
                data-dir="next"
                onClick={() => setActiveSlide((prev) => (prev + 1) % gallerySlides.length)}
                aria-label={language === "es" ? "Siguiente imagen" : "Next image"}
              >
                <span>{">"}</span>
              </button>

              <button
                type="button"
                className={CAROUSEL_TOGGLE_CLASS}
                onClick={() => setUserPaused(!carouselPaused)}
                aria-pressed={carouselPaused}
                aria-label={copy.gallery.pauseLabel}
                title={copy.gallery.pauseLabel}
              >
                {carouselPaused ? <PlayIcon /> : <PauseIcon />}
              </button>
            </div>

            <div className="lp-slide-dots">
              {gallerySlides.map((slide, index) => (
                <button
                  key={slide.id}
                  type="button"
                  className="lp-dot"
                  data-active={activeSlide === index}
                  aria-pressed={activeSlide === index}
                  onClick={() => setActiveSlide(index)}
                  aria-label={
                    language === "es"
                      ? `Mostrar imagen ${index + 1}`
                      : `Show image ${index + 1}`
                  }
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

            <div className="lp-video-layout" data-lp-reveal={revealAttribute}>
              <div className="lp-video-card lp-surface">
                <iframe
                  src={youtubeSrc}
                  title={language === "es" ? "Video de servicio AcostasPool" : "AcostasPool service video"}
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>

              <article className="lp-video-copy lp-surface">
                <p className="lp-kicker">{copy.visit.kicker}</p>
                <h3>{copy.visit.heading}</h3>
                <p>{copy.visit.subtitle}</p>
                <div className="lp-video-copy-lists">
                  <ul>
                    <li>{copy.visit.listA[0]}</li>
                    <li>{copy.visit.listA[1]}</li>
                  </ul>
                  <ul>
                    <li>{copy.visit.listB[0]}</li>
                    <li>{copy.visit.listB[1]}</li>
                  </ul>
                </div>
                <div className="lp-video-copy-tags">
                  <span>{copy.visit.tags[0]}</span>
                  <span>{copy.visit.tags[1]}</span>
                  <span>{copy.visit.tags[2]}</span>
                </div>
                <Link href="/about" className="lp-btn lp-btn-soft">
                  {copy.visit.action}
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
              {reviews.map((review) => {
                const initials = review.author
                  .split(" ")
                  .map((token) => token.charAt(0))
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();

                return (
                  <article
                    key={review.author}
                    className="lp-review-card lp-surface"
                    data-lp-reveal={revealAttribute}
                  >
                    <header className="lp-review-head">
                      <div className="lp-review-avatar" aria-hidden="true">
                        {initials}
                      </div>
                      <div className="lp-review-meta">
                        <p className="lp-review-author">{review.author}</p>
                        <p className="lp-review-zone">{review.zone}</p>
                      </div>
                    </header>

                    <div
                      className="lp-review-stars"
                      role="img"
                      aria-label={
                        language === "es"
                          ? `${review.rating} de 5 estrellas`
                          : `${review.rating} out of 5 stars`
                      }
                    >
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
        aria-label={language === "es" ? "Volver arriba" : "Back to top"}
      >
        <span>{"^"}</span>
      </button>

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
