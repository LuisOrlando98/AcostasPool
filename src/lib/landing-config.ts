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
      "Contactanos por WhatsApp para empezar hoy. Envia los datos de tu piscina y confirmamos tu primera visita gratis.",
    note: "Solo para clientes residenciales nuevos. Comparte tu ciudad y una foto para agendar mas rapido.",
    action: "Linea directa por WhatsApp",
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
