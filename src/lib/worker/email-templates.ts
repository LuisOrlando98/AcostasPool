import {
  normalizeLocalizedEmailTemplates,
  renderEmailTemplate,
  type EmailTemplateContent,
  type EmailTemplateId,
  type EmailTemplateLocale,
  type LocalizedEmailTemplatesConfig,
} from "@/lib/email-templates";
import { TEMPLATE_CACHE_TTL_MS } from "@/lib/worker/constants";
import type { EmailTemplateSource, WorkerDb } from "@/lib/worker/types";

const SITE_SETTINGS_ID = "default";

type TemplateCacheEntry = {
  readonly loadedAt: number;
  readonly templates: LocalizedEmailTemplatesConfig;
};

/**
 * Plantillas de correo desde SiteSettings.emailTemplates, normalizadas con la
 * misma función que usa la web (`normalizeLocalizedEmailTemplates`).
 *
 * Se lee la fila directamente en lugar de usar `@/lib/site-settings`: ese
 * módulo envuelve la consulta en `unstable_cache` de Next, que fuera del
 * runtime de Next lanza "incrementalCache missing". La caché por TTL replica la
 * del antiguo worker.
 */
export function createEmailTemplateSource(
  db: WorkerDb,
  ttlMs: number = TEMPLATE_CACHE_TTL_MS
): EmailTemplateSource {
  let cache: TemplateCacheEntry | null = null;

  return {
    async load(now: Date) {
      if (cache && now.getTime() - cache.loadedAt < ttlMs) {
        return cache.templates;
      }
      const settings = await db.siteSettings.findUnique({
        where: { id: SITE_SETTINGS_ID },
        select: { emailTemplates: true },
      });
      const templates = normalizeLocalizedEmailTemplates(settings?.emailTemplates);
      cache = { loadedAt: now.getTime(), templates };
      return templates;
    },
  };
}

export function renderWorkerTemplate(
  templates: LocalizedEmailTemplatesConfig,
  templateId: EmailTemplateId,
  locale: EmailTemplateLocale,
  variables: Readonly<Record<string, string>>
): EmailTemplateContent {
  return renderEmailTemplate(templates[templateId][locale], { ...variables });
}
