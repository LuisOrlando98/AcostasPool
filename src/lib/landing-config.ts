import type { Metadata } from "next";

export type LandingLocale = "en" | "es";

export type LandingPromoFields = {
  badge: string;
  title: string;
  detail: string;
  note: string;
  action: string;
  cta: string;
};

export type LandingPromoCopyByLocale = Record<LandingLocale, LandingPromoFields>;

export const DEFAULT_LANDING_PROMO_COPY: LandingPromoCopyByLocale = {
  en: {
    badge: "Limited-time offer",
    title: "FIRST VISIT FREE",
    detail:
      "Contact us on WhatsApp to start today. Send your pool details and we will confirm your first free visit.",
    note: "New residential clients only. Share your city and one pool photo for faster scheduling.",
    action: "WhatsApp direct line",
    cta: "Start on WhatsApp",
  },
  es: {
    badge: "Oferta por tiempo limitado",
    title: "FIRST VISIT FREE",
    detail:
      "Contáctanos por WhatsApp para empezar hoy. Envía los datos de tu piscina y confirmamos tu primera visita gratis.",
    note: "Solo para clientes residenciales nuevos. Comparte tu ciudad y una foto para agendar más rápido.",
    action: "Línea directa por WhatsApp",
    cta: "Comenzar por WhatsApp",
  },
};

const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

function normalizePromoLocale(
  value: unknown,
  fallback: LandingPromoFields
): LandingPromoFields {
  const input = value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return {
    badge: String(input.badge ?? fallback.badge).trim() || fallback.badge,
    title: String(input.title ?? fallback.title).trim() || fallback.title,
    detail: String(input.detail ?? fallback.detail).trim() || fallback.detail,
    note: String(input.note ?? fallback.note).trim() || fallback.note,
    action: String(input.action ?? fallback.action).trim() || fallback.action,
    cta: String(input.cta ?? fallback.cta).trim() || fallback.cta,
  };
}

export function normalizeLandingPromoCopy(value: unknown): LandingPromoCopyByLocale {
  const input = value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return {
    en: normalizePromoLocale(input.en, DEFAULT_LANDING_PROMO_COPY.en),
    es: normalizePromoLocale(input.es, DEFAULT_LANDING_PROMO_COPY.es),
  };
}

function pickVideoId(candidate: string | null) {
  if (!candidate) {
    return null;
  }
  return YOUTUBE_VIDEO_ID.test(candidate) ? candidate : null;
}

function extractYoutubeVideoId(rawValue: string | null | undefined) {
  const value = String(rawValue ?? "").trim();
  if (!value) {
    return null;
  }

  const directId = pickVideoId(value);
  if (directId) {
    return directId;
  }

  const withProtocol =
    value.startsWith("http://") || value.startsWith("https://")
      ? value
      : `https://${value}`;

  try {
    const parsed = new URL(withProtocol);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();

    if (host === "youtu.be") {
      return pickVideoId(parsed.pathname.split("/").filter(Boolean)[0] ?? null);
    }

    if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
      const queryId = pickVideoId(parsed.searchParams.get("v"));
      if (queryId) {
        return queryId;
      }

      const segments = parsed.pathname.split("/").filter(Boolean);
      const embedIndex = segments.findIndex((segment) => segment === "embed");
      if (embedIndex >= 0) {
        return pickVideoId(segments[embedIndex + 1] ?? null);
      }

      const shortsIndex = segments.findIndex((segment) => segment === "shorts");
      if (shortsIndex >= 0) {
        return pickVideoId(segments[shortsIndex + 1] ?? null);
      }
    }
  } catch {
    return null;
  }

  return null;
}

export function getLandingYoutubeEmbedSrc(rawUrl: string | null | undefined, fallbackId?: string) {
  const videoId =
    extractYoutubeVideoId(rawUrl) ??
    extractYoutubeVideoId(fallbackId) ??
    "M7lc1UVf-VE";

  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`;
}

/* -------------------------------------------------------------------------- */
/* Business identity shared by the public landing, contact page and JSON-LD.   */
/* -------------------------------------------------------------------------- */

export const LANDING_SITE_NAME = "AcostasPool";

export const DEFAULT_LANDING_SITE_URL = "https://acostaspool.com";

export const LANDING_CONTACT = {
  phoneDisplay: "+1 (786) 793-0081",
  phoneE164: "+17867930081",
  /** Hyphenated form recommended for schema.org `telephone`. */
  phoneSchema: "+1-786-793-0081",
  supportEmail: "contact@acostaspool.com",
} as const;

/** Mirrors the business hours shown on the contact page (Monday to Saturday, 8 AM to 6 PM). */
export const LANDING_BUSINESS_HOURS = {
  days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  opens: "08:00",
  closes: "18:00",
} as const;

/** Cities listed on the coverage map (`CoverageMapCard`). Keep both lists in sync. */
export const LANDING_SERVICE_AREAS = [
  "Miami Gardens",
  "Miramar",
  "Miami",
  "Kendall",
  "Coral Gables",
  "Doral",
  "Homestead",
  "Cutler Bay",
] as const;

export function buildWhatsAppLink(message: string, phoneE164: string = LANDING_CONTACT.phoneE164) {
  return `https://wa.me/${phoneE164.replace("+", "")}?text=${encodeURIComponent(message)}`;
}

/* -------------------------------------------------------------------------- */
/* Curated imagery with intrinsic pixel dimensions (needed by next/image).     */
/* -------------------------------------------------------------------------- */

export type LandingImageAsset = {
  src: string;
  width: number;
  height: number;
};

const CURATED_IMAGES_DIR = "/landing/media/curated/images";

export const LANDING_IMAGES = {
  heroDeck: {
    src: `${CURATED_IMAGES_DIR}/pool-premium-residential-deck.jpg`,
    width: 2400,
    height: 1600,
  },
  servicesHeroTechnician: {
    src: `${CURATED_IMAGES_DIR}/pool-home-services-hero-technician.jpg`,
    width: 2400,
    height: 1600,
  },
  weeklyTechnician: {
    src: `${CURATED_IMAGES_DIR}/pool-service-weekly-technician.jpg`,
    width: 2400,
    height: 1600,
  },
  surfaceNetCloseup: {
    src: `${CURATED_IMAGES_DIR}/pool-service-surface-net-closeup.jpg`,
    width: 2400,
    height: 1602,
  },
  waterChemistryTesting: {
    src: `${CURATED_IMAGES_DIR}/pool-service-water-chemistry-testing.jpg`,
    width: 2400,
    height: 1600,
  },
  underwaterView: {
    src: `${CURATED_IMAGES_DIR}/pool-gallery-lifestyle-underwater-view.jpg`,
    width: 2400,
    height: 1800,
  },
  galleryVacuumCloseup: {
    src: `${CURATED_IMAGES_DIR}/pool-gallery-cleaning-vacuum-closeup.jpg`,
    width: 2400,
    height: 1600,
  },
  galleryToolsSet: {
    src: `${CURATED_IMAGES_DIR}/pool-gallery-maintenance-tools-set.jpg`,
    width: 2400,
    height: 1600,
  },
  galleryFullService: {
    src: `${CURATED_IMAGES_DIR}/pool-gallery-full-service-cleaning.jpg`,
    width: 2400,
    height: 1350,
  },
} as const satisfies Record<string, LandingImageAsset>;

/* -------------------------------------------------------------------------- */
/* SEO helpers (server side only: metadata, robots, sitemap, JSON-LD).         */
/* -------------------------------------------------------------------------- */

export const LANDING_OG_IMAGE: LandingImageAsset & { alt: string } = {
  ...LANDING_IMAGES.heroDeck,
  alt: "Luxury residential pool maintained by AcostasPool in South Florida",
};

/**
 * Public origin of the site, taken from `APP_URL`. Falls back to the production
 * domain when the variable is missing or malformed so metadata never throws.
 */
export function getLandingSiteUrl(): string {
  const raw = process.env.APP_URL?.trim();
  if (!raw) {
    return DEFAULT_LANDING_SITE_URL;
  }

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return DEFAULT_LANDING_SITE_URL;
    }
    return parsed.origin;
  } catch {
    return DEFAULT_LANDING_SITE_URL;
  }
}

export function toLandingAbsoluteUrl(path: string) {
  return new URL(path, `${getLandingSiteUrl()}/`).toString();
}

export type LandingPageMetadataInput = {
  /** Path starting with "/" (used for the canonical URL and Open Graph URL). */
  path: string;
  title: string;
  description: string;
  keywords?: string[];
  openGraph?: {
    title?: string;
    description?: string;
  };
};

/**
 * Shared metadata for the public pages: canonical URL, Open Graph and Twitter
 * cards. Only English routes exist today; localized `/es` routes are a pending
 * product decision, so no `alternates.languages` are declared yet.
 */
export function buildLandingMetadata(input: LandingPageMetadataInput): Metadata {
  const ogTitle = input.openGraph?.title ?? input.title;
  const ogDescription = input.openGraph?.description ?? input.description;
  const image = {
    url: LANDING_OG_IMAGE.src,
    width: LANDING_OG_IMAGE.width,
    height: LANDING_OG_IMAGE.height,
    alt: LANDING_OG_IMAGE.alt,
  };

  return {
    metadataBase: new URL(getLandingSiteUrl()),
    title: input.title,
    description: input.description,
    ...(input.keywords ? { keywords: input.keywords } : {}),
    alternates: {
      canonical: input.path,
    },
    openGraph: {
      type: "website",
      siteName: LANDING_SITE_NAME,
      locale: "en_US",
      url: input.path,
      title: ogTitle,
      description: ogDescription,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: ogDescription,
      images: [image],
    },
  };
}
