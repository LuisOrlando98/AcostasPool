import type { Prisma } from "@prisma/client";
import { revalidateTag, unstable_cache } from "next/cache";
import {
  normalizeEmailTemplateContent,
  normalizeEmailTemplates,
  type EmailTemplateContent,
  type EmailTemplateId,
  type EmailTemplatesConfig,
} from "@/lib/email-templates";
import { prisma } from "@/lib/db";
import {
  normalizeLandingPromoCopy,
  type LandingPromoCopyByLocale,
} from "@/lib/landing-config";
import {
  normalizeInvoiceTemplateConfig,
  type InvoiceTemplateConfig,
} from "@/lib/invoice-template";

export type SiteSocialLinks = {
  instagramUrl: string | null;
  facebookUrl: string | null;
  whatsappUrl: string | null;
  xUrl: string | null;
  youtubeUrl: string | null;
  tiktokUrl: string | null;
};

export type SiteLandingConfig = {
  youtubeUrl: string | null;
  promo: LandingPromoCopyByLocale;
};

export type SiteInvoiceTemplateConfig = InvoiceTemplateConfig;

const EMPTY_SOCIAL_LINKS: SiteSocialLinks = {
  instagramUrl: null,
  facebookUrl: null,
  whatsappUrl: null,
  xUrl: null,
  youtubeUrl: null,
  tiktokUrl: null,
};

const SITE_SETTINGS_TAG = "site-settings";

type SiteSettingsData = {
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  whatsappUrl?: string | null;
  xUrl?: string | null;
  youtubeUrl?: string | null;
  tiktokUrl?: string | null;
  landingYoutubeUrl?: string | null;
  landingPromoCopy?: Prisma.InputJsonValue | null;
  emailTemplates?: Prisma.InputJsonValue | null;
  invoiceTemplate?: Prisma.InputJsonValue | null;
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

const getSiteSettingsCached = unstable_cache(
  async () => {
    return prisma.siteSettings.findUnique({
      where: { id: "default" },
      select: {
        instagramUrl: true,
        facebookUrl: true,
        whatsappUrl: true,
        xUrl: true,
        youtubeUrl: true,
        tiktokUrl: true,
        landingYoutubeUrl: true,
        landingPromoCopy: true,
        emailTemplates: true,
        invoiceTemplate: true,
      },
    });
  },
  ["site-settings"],
  { revalidate: 300, tags: [SITE_SETTINGS_TAG] }
);

async function saveSiteSettings(data: SiteSettingsData) {
  const saved = await prisma.siteSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      ...data,
    },
    update: data,
  });

  revalidateTag(SITE_SETTINGS_TAG, "max");
  return saved;
}

export async function getSiteSocialLinks() {
  const settings = await getSiteSettingsCached();
  if (!settings) {
    return EMPTY_SOCIAL_LINKS;
  }

  return {
    instagramUrl: settings.instagramUrl,
    facebookUrl: settings.facebookUrl,
    whatsappUrl: settings.whatsappUrl,
    xUrl: settings.xUrl,
    youtubeUrl: settings.youtubeUrl,
    tiktokUrl: settings.tiktokUrl,
  };
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

  return saveSiteSettings(data);
}

export async function getSiteLandingConfig(): Promise<SiteLandingConfig> {
  const settings = await getSiteSettingsCached();

  return {
    youtubeUrl: settings?.landingYoutubeUrl ?? null,
    promo: normalizeLandingPromoCopy(settings?.landingPromoCopy),
  };
}

export async function saveSiteLandingConfig(input: SiteLandingConfig) {
  const data = {
    landingYoutubeUrl: normalizeUrl(input.youtubeUrl ?? "") ?? null,
    landingPromoCopy: normalizeLandingPromoCopy(input.promo) as Prisma.InputJsonValue,
  };

  return saveSiteSettings(data);
}

export async function getEmailTemplatesConfig(): Promise<EmailTemplatesConfig> {
  const settings = await getSiteSettingsCached();
  return normalizeEmailTemplates(settings?.emailTemplates);
}

export async function saveEmailTemplateConfig(
  templateId: EmailTemplateId,
  template: EmailTemplateContent
) {
  const current = await getEmailTemplatesConfig();
  const next = {
    ...current,
    [templateId]: normalizeEmailTemplateContent(template, current[templateId]),
  };

  return saveSiteSettings({
    emailTemplates: next as Prisma.InputJsonValue,
  });
}

export async function getInvoiceTemplateConfig(): Promise<SiteInvoiceTemplateConfig> {
  const settings = await getSiteSettingsCached();
  return normalizeInvoiceTemplateConfig(settings?.invoiceTemplate);
}

export async function saveInvoiceTemplateConfig(template: SiteInvoiceTemplateConfig) {
  const normalized = normalizeInvoiceTemplateConfig(template);
  return saveSiteSettings({
    invoiceTemplate: normalized as Prisma.InputJsonValue,
  });
}
