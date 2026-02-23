import Link from "next/link";
import { revalidatePath } from "next/cache";
import AppShell from "@/components/layout/AppShell";
import NotificationPreferences from "@/components/settings/NotificationPreferences";
import ServiceTiersManager from "@/components/settings/ServiceTiersManager";
import FormSubmitButton from "@/components/ui/FormSubmitButton";
import {
  EMAIL_TEMPLATE_DEFINITIONS,
  EMAIL_TEMPLATE_IDS,
  isEmailTemplateId,
  renderEmailTemplate,
} from "@/lib/email-templates";
import {
  normalizeInvoiceTemplateConfig,
  renderInvoiceTemplatePreview,
  type InvoiceTemplateTheme,
} from "@/lib/invoice-template";
import { requireRole } from "@/lib/auth/guards";
import {
  getEmailTemplatesConfig,
  getInvoiceTemplateConfig,
  getSiteLandingConfig,
  getSiteSocialLinks,
  saveEmailTemplateConfig,
  saveInvoiceTemplateConfig,
  saveSiteLandingConfig,
  saveSiteSocialLinks,
} from "@/lib/site-settings";
import { getTranslations } from "@/i18n/server";

type SettingsTabId =
  | "social"
  | "landing"
  | "email-templates"
  | "tiers"
  | "notifications";
type TemplatesKind = "email" | "invoice";
type TemplateViewMode = "code" | "web" | "split";

type SettingsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const SETTINGS_TABS: Array<{ id: SettingsTabId; label: string }> = [
  { id: "social", label: "Social links" },
  { id: "landing", label: "Landing page config" },
  { id: "email-templates", label: "Templates" },
  { id: "tiers", label: "Service tiers" },
  { id: "notifications", label: "Notifications" },
];

function getFirstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function resolveTab(value: string | undefined): SettingsTabId {
  if (value === "social") return "social";
  if (value === "landing") return "landing";
  if (value === "email-templates") return "email-templates";
  if (value === "tiers") return "tiers";
  if (value === "notifications") return "notifications";
  return "social";
}

function resolveTemplateKind(value: string | undefined): TemplatesKind {
  return value === "invoice" ? "invoice" : "email";
}

function resolveTemplateMode(value: string | undefined): TemplateViewMode {
  if (value === "code" || value === "web") {
    return value;
  }
  return "split";
}

function resolveInvoiceTheme(value: string | undefined): InvoiceTemplateTheme {
  if (value === "SPECIAL" || value === "ESTIMATE") {
    return value;
  }
  return "STANDARD";
}

async function saveSocialLinks(formData: FormData) {
  "use server";
  await requireRole("ADMIN");

  await saveSiteSocialLinks({
    instagramUrl: String(formData.get("instagramUrl") ?? "").trim() || null,
    facebookUrl: String(formData.get("facebookUrl") ?? "").trim() || null,
    whatsappUrl: String(formData.get("whatsappUrl") ?? "").trim() || null,
    xUrl: String(formData.get("xUrl") ?? "").trim() || null,
    youtubeUrl: String(formData.get("youtubeUrl") ?? "").trim() || null,
    tiktokUrl: String(formData.get("tiktokUrl") ?? "").trim() || null,
  });

  revalidatePath("/");
  revalidatePath("/admin/settings");
}

async function saveLandingConfiguration(formData: FormData) {
  "use server";
  await requireRole("ADMIN");

  const read = (key: string) => String(formData.get(key) ?? "").trim();

  await saveSiteLandingConfig({
    youtubeUrl: read("landingYoutubeUrl") || null,
    promo: {
      en: {
        badge: read("promoBadgeEn"),
        title: read("promoTitleEn"),
        detail: read("promoDetailEn"),
        note: read("promoNoteEn"),
        action: read("promoActionEn"),
        cta: read("promoCtaEn"),
      },
      es: {
        badge: read("promoBadgeEs"),
        title: read("promoTitleEs"),
        detail: read("promoDetailEs"),
        note: read("promoNoteEs"),
        action: read("promoActionEs"),
        cta: read("promoCtaEs"),
      },
    },
  });

  revalidatePath("/");
  revalidatePath("/admin/settings");
}

async function saveEmailTemplate(formData: FormData) {
  "use server";
  await requireRole("ADMIN");

  const templateId = String(formData.get("templateId") ?? "");
  if (!isEmailTemplateId(templateId)) {
    return;
  }

  await saveEmailTemplateConfig(templateId, {
    subject: String(formData.get("subject") ?? ""),
    text: String(formData.get("text") ?? ""),
    html: String(formData.get("html") ?? ""),
  });

  revalidatePath("/admin/settings");
}

async function saveInvoiceTemplate(formData: FormData) {
  "use server";
  await requireRole("ADMIN");

  const templateJson = String(formData.get("templateJson") ?? "");
  if (!templateJson.trim()) {
    return;
  }

  try {
    const parsed = JSON.parse(templateJson);
    const normalized = normalizeInvoiceTemplateConfig(parsed);
    await saveInvoiceTemplateConfig(normalized);
  } catch {
    return;
  }

  revalidatePath("/admin/settings");
  revalidatePath("/admin/invoices");
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  await requireRole("ADMIN");
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const currentTab = resolveTab(getFirstSearchValue(resolvedSearchParams?.tab));
  const templateQuery = getFirstSearchValue(resolvedSearchParams?.template);
  const templateKind = resolveTemplateKind(
    getFirstSearchValue(resolvedSearchParams?.kind)
  );
  const templateMode = resolveTemplateMode(
    getFirstSearchValue(resolvedSearchParams?.mode)
  );
  const invoiceThemePreview = resolveInvoiceTheme(
    getFirstSearchValue(resolvedSearchParams?.invoiceTheme)
  );

  const [t, socialLinks, landingConfig, emailTemplates, invoiceTemplate] = await Promise.all([
    getTranslations(),
    getSiteSocialLinks(),
    getSiteLandingConfig(),
    getEmailTemplatesConfig(),
    getInvoiceTemplateConfig(),
  ]);

  const selectedTemplateId = isEmailTemplateId(templateQuery)
    ? templateQuery
    : EMAIL_TEMPLATE_IDS[0];
  const selectedTemplate = emailTemplates[selectedTemplateId];
  const selectedTemplateMeta = EMAIL_TEMPLATE_DEFINITIONS[selectedTemplateId];
  const selectedTemplatePreview = renderEmailTemplate(
    selectedTemplate,
    selectedTemplateMeta.previewValues
  );
  const invoiceTemplatePreview = renderInvoiceTemplatePreview(
    invoiceTemplate,
    invoiceThemePreview
  );
  const invoiceTemplateJson = JSON.stringify(invoiceTemplate, null, 2);

  const socialFields = [
    {
      key: "instagramUrl",
      label: t("admin.settings.social.fields.instagram"),
      placeholder: "https://instagram.com/...",
      hint: t("admin.settings.social.hints.instagram"),
      value: socialLinks.instagramUrl ?? "",
      icon: "IG",
    },
    {
      key: "facebookUrl",
      label: t("admin.settings.social.fields.facebook"),
      placeholder: "https://facebook.com/...",
      hint: t("admin.settings.social.hints.facebook"),
      value: socialLinks.facebookUrl ?? "",
      icon: "FB",
    },
    {
      key: "whatsappUrl",
      label: t("admin.settings.social.fields.whatsapp"),
      placeholder: "+13055550199 / https://wa.me/13055550199",
      hint: t("admin.settings.social.hints.whatsapp"),
      value: socialLinks.whatsappUrl ?? "",
      icon: "WA",
    },
    {
      key: "xUrl",
      label: t("admin.settings.social.fields.x"),
      placeholder: "https://x.com/...",
      hint: t("admin.settings.social.hints.x"),
      value: socialLinks.xUrl ?? "",
      icon: "X",
    },
    {
      key: "youtubeUrl",
      label: t("admin.settings.social.fields.youtube"),
      placeholder: "https://youtube.com/@...",
      hint: t("admin.settings.social.hints.youtube"),
      value: socialLinks.youtubeUrl ?? "",
      icon: "YT",
    },
    {
      key: "tiktokUrl",
      label: t("admin.settings.social.fields.tiktok"),
      placeholder: "https://tiktok.com/@...",
      hint: t("admin.settings.social.hints.tiktok"),
      value: socialLinks.tiktokUrl ?? "",
      icon: "TT",
    },
  ] as const;

  const localeSections: Array<{ key: "en" | "es"; label: string }> = [
    { key: "en", label: "English promo copy" },
    { key: "es", label: "Spanish promo copy" },
  ];
  const buildTemplateHref = (overrides?: {
    template?: string;
    kind?: TemplatesKind;
    mode?: TemplateViewMode;
    invoiceTheme?: InvoiceTemplateTheme;
  }) => {
    const params = new URLSearchParams({
      tab: "email-templates",
      template: overrides?.template ?? selectedTemplateId,
      kind: overrides?.kind ?? templateKind,
      mode: overrides?.mode ?? templateMode,
      invoiceTheme: overrides?.invoiceTheme ?? invoiceThemePreview,
    });
    return `/admin/settings?${params.toString()}`;
  };

  return (
    <AppShell
      title={t("admin.settings.title")}
      subtitle={t("admin.settings.subtitle")}
      role="ADMIN"
    >
      <section className="space-y-6">
        <div className="app-card p-4 shadow-contrast">
          <div className="ui-segment flex w-full flex-wrap gap-1">
            {SETTINGS_TABS.map((tab) => {
              const params = new URLSearchParams({ tab: tab.id });
              if (tab.id === "email-templates") {
                params.set("template", selectedTemplateId);
                params.set("kind", templateKind);
                params.set("mode", templateMode);
                params.set("invoiceTheme", invoiceThemePreview);
              }
              const isActive = currentTab === tab.id;

              return (
                <Link
                  key={tab.id}
                  href={`/admin/settings?${params.toString()}`}
                  className={`ui-segment-item ${isActive ? "is-active" : ""}`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </div>

        {currentTab === "social" ? (
          <div className="app-card p-6 shadow-contrast">
            <h2 className="text-lg font-semibold">{t("admin.settings.social.title")}</h2>
            <p className="mt-2 text-sm text-slate-600">{t("admin.settings.social.subtitle")}</p>
            <form action={saveSocialLinks} className="mt-5 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {socialFields.map((field) => (
                  <label
                    key={field.key}
                    className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-3 shadow-sm transition hover:border-sky-200"
                  >
                    <span className="flex items-center gap-2">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold tracking-[0.08em] text-white">
                        {field.icon}
                      </span>
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        {field.label}
                      </span>
                    </span>
                    <input
                      name={field.key}
                      defaultValue={field.value}
                      className="app-input mt-3 w-full px-4 py-3 text-sm"
                      placeholder={field.placeholder}
                    />
                    <span className="mt-2 block text-[11px] text-slate-400">{field.hint}</span>
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs text-slate-500">{t("admin.settings.social.footerHint")}</p>
                <FormSubmitButton
                  idleLabel={t("admin.settings.social.actions.save")}
                  pendingLabel={t("common.feedback.saving")}
                  successLabel={t("common.feedback.saved")}
                  className="px-5 py-2.5"
                />
              </div>
            </form>
          </div>
        ) : null}

        {currentTab === "landing" ? (
          <div className="app-card p-6 shadow-contrast">
            <h2 className="text-lg font-semibold">Landing page configuration</h2>
            <p className="mt-2 text-sm text-slate-600">
              Edit the promotion text and set the full YouTube URL shown in the video section.
            </p>
            <form action={saveLandingConfiguration} className="mt-5 space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Landing video URL (full YouTube link)
                </label>
                <input
                  name="landingYoutubeUrl"
                  defaultValue={landingConfig.youtubeUrl ?? ""}
                  className="app-input mt-2 w-full px-4 py-3 text-sm"
                  placeholder="https://www.youtube.com/watch?v=..."
                />
                <p className="mt-2 text-[11px] text-slate-500">
                  Paste the full URL. We automatically extract the video id for the embedded player.
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {localeSections.map((localeSection) => {
                  const localePromo = landingConfig.promo[localeSection.key];
                  const suffix = localeSection.key === "en" ? "En" : "Es";

                  return (
                    <div
                      key={localeSection.key}
                      className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-4"
                    >
                      <h3 className="text-sm font-semibold">{localeSection.label}</h3>
                      <div className="mt-4 space-y-3">
                        <label className="block">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Badge
                          </span>
                          <input
                            name={`promoBadge${suffix}`}
                            defaultValue={localePromo.badge}
                            className="app-input mt-2 w-full px-4 py-3 text-sm"
                          />
                        </label>
                        <label className="block">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Title
                          </span>
                          <input
                            name={`promoTitle${suffix}`}
                            defaultValue={localePromo.title}
                            className="app-input mt-2 w-full px-4 py-3 text-sm"
                          />
                        </label>
                        <label className="block">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Detail
                          </span>
                          <textarea
                            name={`promoDetail${suffix}`}
                            defaultValue={localePromo.detail}
                            className="app-input mt-2 w-full px-4 py-3 text-sm"
                            rows={4}
                          />
                        </label>
                        <label className="block">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Note
                          </span>
                          <textarea
                            name={`promoNote${suffix}`}
                            defaultValue={localePromo.note}
                            className="app-input mt-2 w-full px-4 py-3 text-sm"
                            rows={3}
                          />
                        </label>
                        <label className="block">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Action label
                          </span>
                          <input
                            name={`promoAction${suffix}`}
                            defaultValue={localePromo.action}
                            className="app-input mt-2 w-full px-4 py-3 text-sm"
                          />
                        </label>
                        <label className="block">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            CTA button
                          </span>
                          <input
                            name={`promoCta${suffix}`}
                            defaultValue={localePromo.cta}
                            className="app-input mt-2 w-full px-4 py-3 text-sm"
                          />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-end">
                <FormSubmitButton
                  idleLabel="Save landing configuration"
                  pendingLabel={t("common.feedback.saving")}
                  successLabel={t("common.feedback.saved")}
                  className="px-5 py-2.5"
                />
              </div>
            </form>
          </div>
        ) : null}

        {currentTab === "email-templates" ? (
          <div className="space-y-6">
            <div className="app-card p-4 shadow-contrast">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="ui-segment">
                  <Link
                    href={buildTemplateHref({ kind: "email" })}
                    className={`ui-segment-item ${templateKind === "email" ? "is-active" : ""}`}
                  >
                    Email templates
                  </Link>
                  <Link
                    href={buildTemplateHref({ kind: "invoice" })}
                    className={`ui-segment-item ${templateKind === "invoice" ? "is-active" : ""}`}
                  >
                    Invoice template
                  </Link>
                </div>

                <div className="ui-segment">
                  <Link
                    href={buildTemplateHref({ mode: "code" })}
                    className={`ui-segment-item ${templateMode === "code" ? "is-active" : ""}`}
                  >
                    Code
                  </Link>
                  <Link
                    href={buildTemplateHref({ mode: "web" })}
                    className={`ui-segment-item ${templateMode === "web" ? "is-active" : ""}`}
                  >
                    Web
                  </Link>
                  <Link
                    href={buildTemplateHref({ mode: "split" })}
                    className={`ui-segment-item ${templateMode === "split" ? "is-active" : ""}`}
                  >
                    Split
                  </Link>
                </div>
              </div>

              {templateKind === "invoice" ? (
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                  <span>Preview theme:</span>
                  <div className="ui-segment">
                    <Link
                      href={buildTemplateHref({ invoiceTheme: "STANDARD" })}
                      className={`ui-segment-item ${
                        invoiceThemePreview === "STANDARD" ? "is-active" : ""
                      }`}
                    >
                      Standard
                    </Link>
                    <Link
                      href={buildTemplateHref({ invoiceTheme: "SPECIAL" })}
                      className={`ui-segment-item ${
                        invoiceThemePreview === "SPECIAL" ? "is-active" : ""
                      }`}
                    >
                      Special
                    </Link>
                    <Link
                      href={buildTemplateHref({ invoiceTheme: "ESTIMATE" })}
                      className={`ui-segment-item ${
                        invoiceThemePreview === "ESTIMATE" ? "is-active" : ""
                      }`}
                    >
                      Estimate
                    </Link>
                  </div>
                </div>
              ) : null}
            </div>

            {templateKind === "email" ? (
              <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
                <div className="app-card p-4 shadow-contrast">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Email templates
                  </h2>
                  <div className="mt-3 space-y-2">
                    {EMAIL_TEMPLATE_IDS.map((templateId) => {
                      const definition = EMAIL_TEMPLATE_DEFINITIONS[templateId];
                      const isActive = selectedTemplateId === templateId;
                      return (
                        <Link
                          key={templateId}
                          href={buildTemplateHref({ template: templateId })}
                          className={`block rounded-xl border px-3 py-3 text-left transition ${
                            isActive
                              ? "border-sky-300 bg-sky-50 shadow-sm"
                              : "border-slate-200 bg-white hover:border-slate-300"
                          }`}
                        >
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                            {definition.label}
                          </p>
                          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                            {definition.description}
                          </p>
                        </Link>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-6">
                  {templateMode !== "web" ? (
                    <div className="app-card p-6 shadow-contrast">
                      <h2 className="text-lg font-semibold">
                        Email template editor: {selectedTemplateMeta.label}
                      </h2>
                      <p className="mt-2 text-sm text-slate-600">
                        {selectedTemplateMeta.description}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {selectedTemplateMeta.placeholders.map((placeholder) => (
                          <code
                            key={placeholder}
                            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] text-slate-600"
                          >
                            {placeholder}
                          </code>
                        ))}
                      </div>

                      <form action={saveEmailTemplate} className="mt-5 space-y-4">
                        <input type="hidden" name="templateId" value={selectedTemplateId} />
                        <label className="block">
                          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Subject
                          </span>
                          <input
                            name="subject"
                            defaultValue={selectedTemplate.subject}
                            className="app-input mt-2 w-full px-4 py-3 text-sm"
                          />
                        </label>

                        <label className="block">
                          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Text body
                          </span>
                          <textarea
                            name="text"
                            defaultValue={selectedTemplate.text}
                            rows={10}
                            className="app-input mt-2 w-full px-4 py-3 font-mono text-xs"
                          />
                        </label>

                        <label className="block">
                          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            HTML body
                          </span>
                          <textarea
                            name="html"
                            defaultValue={selectedTemplate.html}
                            rows={12}
                            className="app-input mt-2 w-full px-4 py-3 font-mono text-xs"
                          />
                        </label>

                        <div className="flex items-center justify-end">
                          <FormSubmitButton
                            idleLabel="Save email template"
                            pendingLabel={t("common.feedback.saving")}
                            successLabel={t("common.feedback.saved")}
                            className="px-5 py-2.5"
                          />
                        </div>
                      </form>
                    </div>
                  ) : null}

                  {templateMode !== "code" ? (
                    <div className="app-card p-6 shadow-contrast">
                      <h3 className="text-base font-semibold">Web preview</h3>
                      <p className="mt-2 text-sm text-slate-600">
                        Vista en pagina web del template seleccionado.
                      </p>
                      <div className="mt-4 grid gap-4 xl:grid-cols-2">
                        <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                              Subject preview
                            </p>
                            <p className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                              {selectedTemplatePreview.subject}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                              Text preview
                            </p>
                            <pre className="mt-2 overflow-auto rounded-lg border border-slate-200 bg-white px-3 py-3 text-xs text-slate-700 whitespace-pre-wrap">
                              {selectedTemplatePreview.text}
                            </pre>
                          </div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            HTML preview
                          </p>
                          <iframe
                            title={`preview-${selectedTemplateId}`}
                            className="mt-2 h-96 w-full rounded-xl border border-slate-200 bg-white"
                            sandbox=""
                            srcDoc={`<!doctype html><html><body style="margin:0;padding:16px;background:#f8fafc;">${selectedTemplatePreview.html}</body></html>`}
                          />
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="grid gap-6 xl:grid-cols-2">
                {templateMode !== "web" ? (
                  <div className="app-card p-6 shadow-contrast">
                    <h2 className="text-lg font-semibold">Invoice template editor</h2>
                    <p className="mt-2 text-sm text-slate-600">
                      Complete customization and code-level editing for invoice rendering.
                    </p>
                    <form action={saveInvoiceTemplate} className="mt-5 space-y-4">
                      <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Template JSON
                        </span>
                        <textarea
                          name="templateJson"
                          rows={22}
                          defaultValue={invoiceTemplateJson}
                          className="app-input mt-2 w-full px-4 py-3 font-mono text-xs"
                        />
                      </label>
                      <FormSubmitButton
                        idleLabel="Save invoice template"
                        pendingLabel={t("common.feedback.saving")}
                        successLabel={t("common.feedback.saved")}
                        className="px-5 py-2.5"
                      />
                    </form>
                  </div>
                ) : null}

                {templateMode !== "code" ? (
                  <div className="app-card p-6 shadow-contrast">
                    <h3 className="text-base font-semibold">Web preview</h3>
                    <p className="mt-2 text-sm text-slate-600">
                      This preview shows how the invoice template renders in page mode.
                    </p>
                    <iframe
                      title={`invoice-template-preview-${invoiceThemePreview}`}
                      className="mt-4 h-[680px] w-full rounded-xl border border-slate-200 bg-white"
                      sandbox=""
                      srcDoc={invoiceTemplatePreview}
                    />
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ) : null}

        {currentTab === "tiers" ? (
          <div className="app-card p-6 shadow-contrast">
            <h2 className="text-lg font-semibold">{t("admin.settings.tiers.title")}</h2>
            <p className="mt-3 text-sm text-slate-600">{t("admin.settings.tiers.subtitle")}</p>
            <div className="mt-4">
              <ServiceTiersManager />
            </div>
          </div>
        ) : null}

        {currentTab === "notifications" ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="app-card p-6 shadow-contrast">
              <h2 className="text-lg font-semibold">{t("admin.settings.notifications.title")}</h2>
              <p className="mt-3 text-sm text-slate-600">
                {t("admin.settings.notifications.subtitle")}
              </p>
              <NotificationPreferences />
            </div>
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}
