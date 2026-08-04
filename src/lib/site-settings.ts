import { Prisma } from "@prisma/client";
import { revalidateTag, unstable_cache } from "next/cache";
import {
  buildPremiumEmailTemplateHtml,
  normalizeEmailTemplateContent,
  normalizeLocalizedEmailTemplates,
  normalizeEmailTemplates,
  resolveEmailTemplateLocale,
  type EmailTemplateContent,
  type EmailTemplateId,
  type EmailTemplateLocale,
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
import {
  normalizeComplianceContent,
  normalizeComplianceDocContent,
  type ComplianceContentConfig,
  type ComplianceDocContent,
  type ComplianceDocId,
} from "@/lib/compliance-config";

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
export type RouteAssistantConfig = {
  dailyAutoOptimizeEnabled: boolean;
};

export type StripeReconcileStatus = {
  lastRunAt: string | null;
  checkedCount: number;
  correctedCount: number;
};

const EMPTY_SOCIAL_LINKS: SiteSocialLinks = {
  instagramUrl: null,
  facebookUrl: null,
  whatsappUrl: null,
  xUrl: null,
  youtubeUrl: null,
  tiktokUrl: null,
};

const DEFAULT_ROUTE_ASSISTANT_CONFIG: RouteAssistantConfig = {
  dailyAutoOptimizeEnabled: false,
};

const DEFAULT_STRIPE_RECONCILE_STATUS: StripeReconcileStatus = {
  lastRunAt: null,
  checkedCount: 0,
  correctedCount: 0,
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
  routeAssistantConfig?: Prisma.InputJsonValue | null;
  complianceContent?: Prisma.InputJsonValue | null;
  companySignatureUrl?: string | null;
  stripeReconcileStatus?: Prisma.InputJsonValue | null;
};

function toNullableJsonInput(value: Prisma.InputJsonValue | null | undefined) {
  if (value === undefined) {
    return undefined;
  }
  return value === null ? Prisma.JsonNull : value;
}

function normalizeRouteAssistantConfig(
  value: Prisma.JsonValue | null | undefined
): RouteAssistantConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return DEFAULT_ROUTE_ASSISTANT_CONFIG;
  }

  const candidate = value as { dailyAutoOptimizeEnabled?: unknown };
  return {
    dailyAutoOptimizeEnabled:
      candidate.dailyAutoOptimizeEnabled === true,
  };
}

function normalizeStripeReconcileStatus(
  value: Prisma.JsonValue | null | undefined
): StripeReconcileStatus {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return DEFAULT_STRIPE_RECONCILE_STATUS;
  }

  const candidate = value as {
    lastRunAt?: unknown;
    checkedCount?: unknown;
    correctedCount?: unknown;
  };
  return {
    lastRunAt: typeof candidate.lastRunAt === "string" ? candidate.lastRunAt : null,
    checkedCount:
      typeof candidate.checkedCount === "number" ? candidate.checkedCount : 0,
    correctedCount:
      typeof candidate.correctedCount === "number" ? candidate.correctedCount : 0,
  };
}

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
        routeAssistantConfig: true,
        complianceContent: true,
        companySignatureUrl: true,
        stripeReconcileStatus: true,
      },
    });
  },
  ["site-settings"],
  { revalidate: 300, tags: [SITE_SETTINGS_TAG] }
);

async function saveSiteSettings(data: SiteSettingsData) {
  const normalizedData = {
    ...data,
    landingPromoCopy: toNullableJsonInput(data.landingPromoCopy),
    emailTemplates: toNullableJsonInput(data.emailTemplates),
    invoiceTemplate: toNullableJsonInput(data.invoiceTemplate),
    routeAssistantConfig: toNullableJsonInput(data.routeAssistantConfig),
    complianceContent: toNullableJsonInput(data.complianceContent),
    stripeReconcileStatus: toNullableJsonInput(data.stripeReconcileStatus),
  };

  const saved = await prisma.siteSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      ...normalizedData,
    },
    update: normalizedData,
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

export async function getEmailTemplatesConfig(
  locale: EmailTemplateLocale | string = "EN"
): Promise<EmailTemplatesConfig> {
  const settings = await getSiteSettingsCached();
  return normalizeEmailTemplates(
    settings?.emailTemplates,
    resolveEmailTemplateLocale(locale)
  );
}

export async function saveEmailTemplateConfig(
  templateId: EmailTemplateId,
  template: EmailTemplateContent,
  locale: EmailTemplateLocale | string = "EN"
) {
  const resolvedLocale = resolveEmailTemplateLocale(locale);
  const settings = await getSiteSettingsCached();
  const current = normalizeLocalizedEmailTemplates(settings?.emailTemplates);
  const normalized = normalizeEmailTemplateContent(
    template,
    current[templateId][resolvedLocale]
  );
  const next = {
    ...current,
    [templateId]: {
      ...current[templateId],
      [resolvedLocale]: {
        subject: normalized.subject,
        text: normalized.text,
        html: buildPremiumEmailTemplateHtml(
          templateId,
          normalized.subject,
          normalized.text
        ),
      },
    },
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

export async function getCompanySignatureUrl(): Promise<string | null> {
  // Bypasses the 5-minute site-settings cache: this feeds a legal
  // document, so a signature saved moments ago must show up immediately
  // on the next "generate contract" instead of waiting out the cache.
  const settings = await prisma.siteSettings.findUnique({
    where: { id: "default" },
    select: { companySignatureUrl: true },
  });
  return settings?.companySignatureUrl ?? null;
}

export async function getCompanySignatureMeta(): Promise<{
  url: string | null;
  updatedAt: Date | null;
}> {
  const settings = await prisma.siteSettings.findUnique({
    where: { id: "default" },
    select: { companySignatureUrl: true, updatedAt: true },
  });
  return {
    url: settings?.companySignatureUrl ?? null,
    updatedAt: settings?.updatedAt ?? null,
  };
}

export async function saveCompanySignatureUrl(url: string | null) {
  return saveSiteSettings({ companySignatureUrl: url });
}

export async function getRouteAssistantConfig(): Promise<RouteAssistantConfig> {
  const settings = await getSiteSettingsCached();
  return normalizeRouteAssistantConfig(settings?.routeAssistantConfig);
}

export async function saveRouteAssistantConfig(input: RouteAssistantConfig) {
  const normalized = normalizeRouteAssistantConfig(
    input as unknown as Prisma.JsonValue
  );
  return saveSiteSettings({
    routeAssistantConfig: normalized as Prisma.InputJsonValue,
  });
}

export async function getComplianceContentConfig(): Promise<ComplianceContentConfig> {
  const settings = await getSiteSettingsCached();
  return normalizeComplianceContent(settings?.complianceContent);
}

export async function saveComplianceDocLocalesConfig(
  docId: ComplianceDocId,
  content: { en: ComplianceDocContent; es: ComplianceDocContent }
) {
  const current = await getComplianceContentConfig();
  const next = {
    ...current,
    [docId]: {
      en: normalizeComplianceDocContent(content.en, current[docId].en),
      es: normalizeComplianceDocContent(content.es, current[docId].es),
    },
  };

  return saveSiteSettings({
    complianceContent: next as Prisma.InputJsonValue,
  });
}

export async function getStripeReconcileStatus(): Promise<StripeReconcileStatus> {
  const settings = await getSiteSettingsCached();
  return normalizeStripeReconcileStatus(settings?.stripeReconcileStatus);
}

export async function saveStripeReconcileStatus(status: StripeReconcileStatus) {
  return saveSiteSettings({
    stripeReconcileStatus: status as unknown as Prisma.InputJsonValue,
  });
}
