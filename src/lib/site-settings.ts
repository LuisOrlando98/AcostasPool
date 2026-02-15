import { revalidateTag, unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";

export type SiteSocialLinks = {
  instagramUrl: string | null;
  facebookUrl: string | null;
  whatsappUrl: string | null;
  xUrl: string | null;
  youtubeUrl: string | null;
  tiktokUrl: string | null;
};

const EMPTY_SOCIAL_LINKS: SiteSocialLinks = {
  instagramUrl: null,
  facebookUrl: null,
  whatsappUrl: null,
  xUrl: null,
  youtubeUrl: null,
  tiktokUrl: null,
};

const SITE_SETTINGS_TAG = "site-settings";

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const withProtocol =
    trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function normalizeWhatsApp(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return normalizeUrl(trimmed);
  }

  const digits = trimmed.replace(/\D/g, "");
  if (!digits) {
    return null;
  }
  return `https://wa.me/${digits}`;
}

const getSiteSocialLinksCached = unstable_cache(
  async () => {
    const settings = await prisma.siteSettings.findUnique({
      where: { id: "default" },
      select: {
        instagramUrl: true,
        facebookUrl: true,
        whatsappUrl: true,
        xUrl: true,
        youtubeUrl: true,
        tiktokUrl: true,
      },
    });

    if (!settings) {
      return EMPTY_SOCIAL_LINKS;
    }

    return settings;
  },
  ["site-settings-social-links"],
  { revalidate: 300, tags: [SITE_SETTINGS_TAG] }
);

export async function getSiteSocialLinks() {
  return getSiteSocialLinksCached();
}

export async function saveSiteSocialLinks(input: SiteSocialLinks) {
  const data = {
    instagramUrl: normalizeUrl(input.instagramUrl ?? "") ?? null,
    facebookUrl: normalizeUrl(input.facebookUrl ?? "") ?? null,
    whatsappUrl: normalizeWhatsApp(input.whatsappUrl ?? "") ?? null,
    xUrl: normalizeUrl(input.xUrl ?? "") ?? null,
    youtubeUrl: normalizeUrl(input.youtubeUrl ?? "") ?? null,
    tiktokUrl: normalizeUrl(input.tiktokUrl ?? "") ?? null,
  };

  const saved = await prisma.siteSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      ...data,
    },
    update: data,
  });

  revalidateTag(SITE_SETTINGS_TAG);
  return saved;
}
