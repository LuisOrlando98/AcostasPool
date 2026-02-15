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

export async function getSiteSocialLinks() {
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

  return prisma.siteSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      ...data,
    },
    update: data,
  });
}
