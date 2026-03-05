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
import {
  COMPLIANCE_DOC_DEFINITIONS,
  COMPLIANCE_DOC_IDS,
  isComplianceDocId,
} from "@/lib/compliance-config";
import { requireRole } from "@/lib/auth/guards";
import {
  getComplianceContentConfig,
  getEmailTemplatesConfig,
  getInvoiceTemplateConfig,
  getSiteLandingConfig,
  getSiteSocialLinks,
  saveComplianceDocLocalesConfig,
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
  | "compliance"
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
  { id: "compliance", label: "Compliance" },
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
  if (value === "compliance") return "compliance";
  if (value === "tiers") return "tiers";
  if (value === "notifications") return "notifications";
  return "social";
}

function resolveTemplateKind(value: string | undefined): TemplatesKind {
  return value === "invoice" ? "invoice" : "email";
}

function resolveTemplateMode(value: string | undefined): TemplateViewMode {
  if (value === "code" || value === "editor") {
    return "code";
  }
  if (value === "web" || value === "preview") {
    return "web";
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
    html: "",
  });

  revalidatePath("/admin/settings");
}

async function saveInvoiceTemplate(formData: FormData) {
  "use server";
  await requireRole("ADMIN");

  const read = (key: string) => String(formData.get(key) ?? "").trim();
  const readBool = (key: string) => String(formData.get(key) ?? "") === "on";
  const readTheme = (theme: "STANDARD" | "SPECIAL" | "ESTIMATE") => ({
    label: read(`${theme}_label`),
    brandHex: read(`${theme}_brandHex`),
    accentHex: read(`${theme}_accentHex`),
    lightHex: read(`${theme}_lightHex`),
    watermarkText: read(`${theme}_watermarkText`),
  });

  const legalClauses = read("legalClauses")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const normalized = normalizeInvoiceTemplateConfig({
    companyName: read("companyName"),
    companyPhone: read("companyPhone"),
    companyEmail: read("companyEmail"),
    companyWebsite: read("companyWebsite"),
    companyAddressLine1: read("companyAddressLine1"),
    companyAddressLine2: read("companyAddressLine2"),
    companyTaxId: read("companyTaxId"),
    headerSubtitle: read("headerSubtitle"),
    footerNote: read("footerNote"),
    invoiceNumberLabel: read("invoiceNumberLabel"),
    issueDateLabel: read("issueDateLabel"),
    billToLabel: read("billToLabel"),
    notesLabel: read("notesLabel"),
    tableDescriptionLabel: read("tableDescriptionLabel"),
    tableAmountLabel: read("tableAmountLabel"),
    subtotalLabel: read("subtotalLabel"),
    taxLabel: read("taxLabel"),
    totalLabel: read("totalLabel"),
    clausesTitle: read("clausesTitle"),
    legalClauses,
    showEstimateWatermark: readBool("showEstimateWatermark"),
    themes: {
      STANDARD: readTheme("STANDARD"),
      SPECIAL: readTheme("SPECIAL"),
      ESTIMATE: readTheme("ESTIMATE"),
    },
  });

  await saveInvoiceTemplateConfig(normalized);

  revalidatePath("/admin/settings");
  revalidatePath("/admin/invoices");
}

async function saveComplianceDoc(formData: FormData) {
  "use server";
  await requireRole("ADMIN");

  const docId = String(formData.get("docId") ?? "");
  if (!isComplianceDocId(docId)) {
    return;
  }

  await saveComplianceDocLocalesConfig(docId, {
    en: {
      title: String(formData.get("titleEn") ?? ""),
      summary: String(formData.get("summaryEn") ?? ""),
      body: String(formData.get("bodyEn") ?? ""),
      effectiveDate: String(formData.get("effectiveDateEn") ?? ""),
    },
    es: {
      title: String(formData.get("titleEs") ?? ""),
      summary: String(formData.get("summaryEs") ?? ""),
      body: String(formData.get("bodyEs") ?? ""),
      effectiveDate: String(formData.get("effectiveDateEs") ?? ""),
    },
  });

  revalidatePath("/admin/settings");
  revalidatePath("/legal");
  revalidatePath("/");
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
  const complianceDocQuery = getFirstSearchValue(resolvedSearchParams?.complianceDoc);

  const [t, socialLinks, landingConfig, emailTemplates, invoiceTemplate, complianceContent] =
    await Promise.all([
    getTranslations(),
    getSiteSocialLinks(),
    getSiteLandingConfig(),
    getEmailTemplatesConfig(),
    getInvoiceTemplateConfig(),
    getComplianceContentConfig(),
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
  const selectedComplianceDocId = isComplianceDocId(complianceDocQuery)
    ? complianceDocQuery
    : COMPLIANCE_DOC_IDS[0];
  const selectedComplianceMeta = COMPLIANCE_DOC_DEFINITIONS[selectedComplianceDocId];
  const selectedCompliance = complianceContent[selectedComplianceDocId];

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
  const showInvoiceEditor = templateMode !== "web";
  const showInvoicePreview = templateMode !== "code";
  const invoiceLayoutClass =
    showInvoiceEditor && showInvoicePreview
      ? "grid gap-6 2xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]"
      : "space-y-6";

  return (
    <AppShell
      title={t("admin.settings.title")}
      subtitle={t("admin.settings.subtitle")}
      role="ADMIN"
    >
      <section className="space-y-4 sm:space-y-6">
        <div className="app-card p-3 shadow-contrast sm:p-4">
          <div className="ui-segment flex w-full flex-nowrap gap-1 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
            {SETTINGS_TABS.map((tab) => {
              const params = new URLSearchParams({ tab: tab.id });
              if (tab.id === "email-templates") {
                params.set("template", selectedTemplateId);
                params.set("kind", templateKind);
                params.set("mode", templateMode);
                params.set("invoiceTheme", invoiceThemePreview);
              }
              if (tab.id === "compliance") {
                params.set("complianceDoc", selectedComplianceDocId);
              }
              const isActive = currentTab === tab.id;

              return (
                <Link
                  key={tab.id}
                  href={`/admin/settings?${params.toString()}`}
                  className={`ui-segment-item shrink-0 text-xs sm:text-sm ${isActive ? "is-active" : ""}`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </div>

        {currentTab === "social" ? (
          <div className="app-card p-4 shadow-contrast sm:p-6">
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
              <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500">{t("admin.settings.social.footerHint")}</p>
                <FormSubmitButton
                  idleLabel={t("admin.settings.social.actions.save")}
                  pendingLabel={t("common.feedback.saving")}
                  successLabel={t("common.feedback.saved")}
                  className="w-full px-5 py-2.5 sm:w-auto"
                />
              </div>
            </form>
          </div>
        ) : null}

        {currentTab === "landing" ? (
          <div className="app-card p-4 shadow-contrast sm:p-6">
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

              <div className="grid gap-4 xl:grid-cols-2">
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

              <div className="flex justify-stretch sm:justify-end">
                <FormSubmitButton
                  idleLabel="Save landing configuration"
                  pendingLabel={t("common.feedback.saving")}
                  successLabel={t("common.feedback.saved")}
                  className="w-full px-5 py-2.5 sm:w-auto"
                />
              </div>
            </form>
          </div>
        ) : null}

        {currentTab === "email-templates" ? (
          <div className="space-y-6">
            <div className="app-card p-4 shadow-contrast sm:p-5">
              <div className="grid gap-3 xl:grid-cols-2 xl:items-center">
                <div className="overflow-x-auto pb-1">
                  <div className="ui-segment inline-flex min-w-max">
                  <Link
                    href={buildTemplateHref({ kind: "email" })}
                    className={`ui-segment-item shrink-0 ${templateKind === "email" ? "is-active" : ""}`}
                  >
                    Email templates
                  </Link>
                  <Link
                    href={buildTemplateHref({ kind: "invoice" })}
                    className={`ui-segment-item shrink-0 ${templateKind === "invoice" ? "is-active" : ""}`}
                  >
                    Invoice template
                  </Link>
                  </div>
                </div>

                <div className="overflow-x-auto pb-1 lg:justify-self-end">
                  <div className="ui-segment inline-flex min-w-max">
                  <Link
                    href={buildTemplateHref({ mode: "code" })}
                    className={`ui-segment-item shrink-0 ${templateMode === "code" ? "is-active" : ""}`}
                  >
                    Editor
                  </Link>
                  <Link
                    href={buildTemplateHref({ mode: "web" })}
                    className={`ui-segment-item shrink-0 ${templateMode === "web" ? "is-active" : ""}`}
                  >
                    Vista final
                  </Link>
                  <Link
                    href={buildTemplateHref({ mode: "split" })}
                    className={`ui-segment-item shrink-0 ${templateMode === "split" ? "is-active" : ""}`}
                  >
                    Ambas
                  </Link>
                  </div>
                </div>
              </div>

              <p className="mt-3 text-xs text-slate-500">
                No necesitas programar: edita texto/campos y el sistema genera el diseno final.
              </p>

              {templateKind === "invoice" ? (
                <div className="mt-3 flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center">
                  <span>Preview theme:</span>
                  <div className="overflow-x-auto pb-1">
                    <div className="ui-segment inline-flex min-w-max">
                    <Link
                      href={buildTemplateHref({ invoiceTheme: "STANDARD" })}
                      className={`ui-segment-item shrink-0 ${
                        invoiceThemePreview === "STANDARD" ? "is-active" : ""
                      }`}
                    >
                      Standard
                    </Link>
                    <Link
                      href={buildTemplateHref({ invoiceTheme: "SPECIAL" })}
                      className={`ui-segment-item shrink-0 ${
                        invoiceThemePreview === "SPECIAL" ? "is-active" : ""
                      }`}
                    >
                      Special
                    </Link>
                    <Link
                      href={buildTemplateHref({ invoiceTheme: "ESTIMATE" })}
                      className={`ui-segment-item shrink-0 ${
                        invoiceThemePreview === "ESTIMATE" ? "is-active" : ""
                      }`}
                    >
                      Estimate
                    </Link>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {templateKind === "email" ? (
              <div className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)]">
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
                    <div className="app-card p-4 shadow-contrast sm:p-6">
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
                            Mensaje del email (texto)
                          </span>
                          <textarea
                            name="text"
                            defaultValue={selectedTemplate.text}
                            rows={10}
                            className="app-input mt-2 w-full px-4 py-3 text-sm"
                          />
                        </label>
                        <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                          El diseno HTML se genera automaticamente con estilo premium.
                        </p>

                        <div className="flex justify-stretch sm:justify-end">
                          <FormSubmitButton
                            idleLabel="Save email template"
                            pendingLabel={t("common.feedback.saving")}
                            successLabel={t("common.feedback.saved")}
                            className="w-full px-5 py-2.5 sm:w-auto"
                          />
                        </div>
                      </form>
                    </div>
                  ) : null}

                  {templateMode !== "code" ? (
                    <div className="app-card p-4 shadow-contrast sm:p-6">
                      <h3 className="text-base font-semibold">Vista final del email</h3>
                      <p className="mt-2 text-sm text-slate-600">
                        Asi se vera exactamente en la bandeja y el contenido del correo.
                      </p>
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Inbox preview
                        </p>
                        <div className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">
                          <p className="font-semibold">From: AcostasPool &lt;no-reply@acostaspool.com&gt;</p>
                          <p className="mt-1">Subject: {selectedTemplatePreview.subject}</p>
                        </div>
                      </div>
                      <iframe
                        title={`preview-${selectedTemplateId}`}
                        className="mt-4 h-[440px] w-full rounded-xl border border-slate-200 bg-white sm:h-[620px]"
                        sandbox=""
                        srcDoc={`<!doctype html><html><body style="margin:0;padding:16px;background:#f8fafc;">${selectedTemplatePreview.html}</body></html>`}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className={invoiceLayoutClass}>
                {showInvoiceEditor ? (
                  <div className="app-card p-4 shadow-contrast sm:p-6">
                    <h2 className="text-lg font-semibold">Invoice template (admin-friendly)</h2>
                    <p className="mt-2 text-sm text-slate-600">
                      Configura datos de empresa, etiquetas y clausulas sin editar codigo.
                    </p>
                    <form action={saveInvoiceTemplate} className="mt-5 space-y-5">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold text-slate-900">Empresa</h3>
                          <p className="text-[11px] text-slate-500">
                            Datos que se muestran en el encabezado del invoice.
                          </p>
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <label className="block">
                          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Company name
                          </span>
                          <input
                            name="companyName"
                            defaultValue={invoiceTemplate.companyName}
                            className="app-input mt-2 w-full px-4 py-3 text-sm"
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Header subtitle
                          </span>
                          <input
                            name="headerSubtitle"
                            defaultValue={invoiceTemplate.headerSubtitle}
                            className="app-input mt-2 w-full px-4 py-3 text-sm"
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Phone
                          </span>
                          <input
                            name="companyPhone"
                            defaultValue={invoiceTemplate.companyPhone}
                            className="app-input mt-2 w-full px-4 py-3 text-sm"
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Email
                          </span>
                          <input
                            name="companyEmail"
                            defaultValue={invoiceTemplate.companyEmail}
                            className="app-input mt-2 w-full px-4 py-3 text-sm"
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Website
                          </span>
                          <input
                            name="companyWebsite"
                            defaultValue={invoiceTemplate.companyWebsite}
                            className="app-input mt-2 w-full px-4 py-3 text-sm"
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Tax ID
                          </span>
                          <input
                            name="companyTaxId"
                            defaultValue={invoiceTemplate.companyTaxId}
                            className="app-input mt-2 w-full px-4 py-3 text-sm"
                          />
                        </label>
                        <label className="block sm:col-span-2">
                          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Address line 1
                          </span>
                          <input
                            name="companyAddressLine1"
                            defaultValue={invoiceTemplate.companyAddressLine1}
                            className="app-input mt-2 w-full px-4 py-3 text-sm"
                          />
                        </label>
                        <label className="block sm:col-span-2">
                          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Address line 2
                          </span>
                          <input
                            name="companyAddressLine2"
                            defaultValue={invoiceTemplate.companyAddressLine2}
                            className="app-input mt-2 w-full px-4 py-3 text-sm"
                          />
                        </label>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold text-slate-900">Etiquetas del documento</h3>
                          <p className="text-[11px] text-slate-500">
                            Nombres visibles dentro de la factura.
                          </p>
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <label className="block">
                          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Bill to label
                          </span>
                          <input
                            name="billToLabel"
                            defaultValue={invoiceTemplate.billToLabel}
                            className="app-input mt-2 w-full px-4 py-3 text-sm"
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Description column label
                          </span>
                          <input
                            name="tableDescriptionLabel"
                            defaultValue={invoiceTemplate.tableDescriptionLabel}
                            className="app-input mt-2 w-full px-4 py-3 text-sm"
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Amount column label
                          </span>
                          <input
                            name="tableAmountLabel"
                            defaultValue={invoiceTemplate.tableAmountLabel}
                            className="app-input mt-2 w-full px-4 py-3 text-sm"
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Invoice number label
                          </span>
                          <input
                            name="invoiceNumberLabel"
                            defaultValue={invoiceTemplate.invoiceNumberLabel}
                            className="app-input mt-2 w-full px-4 py-3 text-sm"
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Issue date label
                          </span>
                          <input
                            name="issueDateLabel"
                            defaultValue={invoiceTemplate.issueDateLabel}
                            className="app-input mt-2 w-full px-4 py-3 text-sm"
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Subtotal label
                          </span>
                          <input
                            name="subtotalLabel"
                            defaultValue={invoiceTemplate.subtotalLabel}
                            className="app-input mt-2 w-full px-4 py-3 text-sm"
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Tax label
                          </span>
                          <input
                            name="taxLabel"
                            defaultValue={invoiceTemplate.taxLabel}
                            className="app-input mt-2 w-full px-4 py-3 text-sm"
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Total label
                          </span>
                          <input
                            name="totalLabel"
                            defaultValue={invoiceTemplate.totalLabel}
                            className="app-input mt-2 w-full px-4 py-3 text-sm"
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Notes label
                          </span>
                          <input
                            name="notesLabel"
                            defaultValue={invoiceTemplate.notesLabel}
                            className="app-input mt-2 w-full px-4 py-3 text-sm"
                          />
                        </label>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <h3 className="text-sm font-semibold text-slate-900">Footer y clausulas</h3>
                        <div className="mt-3 space-y-3">
                          <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                              Footer note
                            </span>
                            <input
                              name="footerNote"
                              defaultValue={invoiceTemplate.footerNote}
                              className="app-input mt-2 w-full px-4 py-3 text-sm"
                            />
                          </label>
                          <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                              Clauses title
                            </span>
                            <input
                              name="clausesTitle"
                              defaultValue={invoiceTemplate.clausesTitle}
                              className="app-input mt-2 w-full px-4 py-3 text-sm"
                            />
                          </label>
                          <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                              Legal clauses (one per line, small footer text)
                            </span>
                            <textarea
                              name="legalClauses"
                              defaultValue={invoiceTemplate.legalClauses.join("\n")}
                              rows={4}
                              className="app-input mt-2 w-full px-4 py-3 text-sm"
                            />
                          </label>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold text-slate-900">Tema visual</h3>
                          <p className="text-[11px] text-slate-500">
                            Colores y labels por tipo de invoice.
                          </p>
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {(["STANDARD", "SPECIAL", "ESTIMATE"] as const).map((theme) => (
                            <div
                              key={theme}
                              className="rounded-xl border border-slate-200 bg-white p-3"
                            >
                              <p className="text-xs font-semibold text-slate-700">{theme}</p>
                              <label className="mt-2 block">
                                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                                  Label
                                </span>
                                <input
                                  name={`${theme}_label`}
                                  defaultValue={invoiceTemplate.themes[theme].label}
                                  className="app-input mt-1 w-full px-3 py-2 text-xs"
                                />
                              </label>
                              <label className="mt-2 block">
                                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                                  Brand color
                                </span>
                                <input
                                  name={`${theme}_brandHex`}
                                  defaultValue={invoiceTemplate.themes[theme].brandHex}
                                  className="app-input mt-1 w-full px-3 py-2 text-xs"
                                />
                              </label>
                              <label className="mt-2 block">
                                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                                  Accent color
                                </span>
                                <input
                                  name={`${theme}_accentHex`}
                                  defaultValue={invoiceTemplate.themes[theme].accentHex}
                                  className="app-input mt-1 w-full px-3 py-2 text-xs"
                                />
                              </label>
                              <label className="mt-2 block">
                                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                                  Light background
                                </span>
                                <input
                                  name={`${theme}_lightHex`}
                                  defaultValue={invoiceTemplate.themes[theme].lightHex}
                                  className="app-input mt-1 w-full px-3 py-2 text-xs"
                                />
                              </label>
                              <label className="mt-2 block">
                                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                                  Watermark text
                                </span>
                                <input
                                  name={`${theme}_watermarkText`}
                                  defaultValue={invoiceTemplate.themes[theme].watermarkText ?? ""}
                                  className="app-input mt-1 w-full px-3 py-2 text-xs"
                                />
                              </label>
                            </div>
                          ))}
                        </div>
                        <label className="mt-3 inline-flex items-center gap-2 text-xs text-slate-600">
                          <input
                            type="checkbox"
                            name="showEstimateWatermark"
                            defaultChecked={invoiceTemplate.showEstimateWatermark}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          Show estimate watermark
                        </label>
                      </div>

                      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                        <p className="text-xs text-slate-500">
                          Los line items se mantienen en el editor de invoices y no se modifican aqui.
                        </p>
                        <FormSubmitButton
                          idleLabel="Guardar template de invoice"
                          pendingLabel={t("common.feedback.saving")}
                          successLabel={t("common.feedback.saved")}
                          className="w-full px-5 py-2.5 sm:w-auto"
                        />
                      </div>
                    </form>
                  </div>
                ) : null}

                {showInvoicePreview ? (
                  <div className="app-card p-4 shadow-contrast sm:p-6 xl:sticky xl:top-24 xl:h-fit">
                    <h3 className="text-base font-semibold">Vista final del invoice</h3>
                    <p className="mt-2 text-sm text-slate-600">
                      Preview real de como se ve en pagina/PDF incluyendo clausulas pequenas.
                    </p>
                    <iframe
                      title={`invoice-template-preview-${invoiceThemePreview}`}
                      className="mt-4 h-[520px] w-full rounded-xl border border-slate-200 bg-white sm:h-[680px]"
                      sandbox=""
                      srcDoc={invoiceTemplatePreview}
                    />
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ) : null}

        {currentTab === "compliance" ? (
          <div className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)]">
            <div className="app-card p-4 shadow-contrast">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
                Compliance documents
              </h2>
              <div className="mt-3 space-y-2">
                {COMPLIANCE_DOC_IDS.map((docId) => {
                  const definition = COMPLIANCE_DOC_DEFINITIONS[docId];
                  const isActive = selectedComplianceDocId === docId;
                  return (
                    <Link
                      key={docId}
                      href={`/admin/settings?tab=compliance&complianceDoc=${docId}`}
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
              <div className="app-card p-4 shadow-contrast sm:p-6">
                <h2 className="text-lg font-semibold">
                  Compliance editor: {selectedComplianceMeta.label}
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Edit public legal pages shown in landing footer and under /legal.
                </p>

                <form action={saveComplianceDoc} className="mt-5 space-y-6">
                  <input type="hidden" name="docId" value={selectedComplianceDocId} />

                  <div className="grid gap-5 xl:grid-cols-2">
                    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <h3 className="text-sm font-semibold text-slate-900">English</h3>
                      <div className="mt-3 space-y-3">
                        <label className="block">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Title
                          </span>
                          <input
                            name="titleEn"
                            defaultValue={selectedCompliance.en.title}
                            className="app-input mt-2 w-full px-4 py-3 text-sm"
                          />
                        </label>
                        <label className="block">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Summary
                          </span>
                          <textarea
                            name="summaryEn"
                            defaultValue={selectedCompliance.en.summary}
                            rows={3}
                            className="app-input mt-2 w-full px-4 py-3 text-sm"
                          />
                        </label>
                        <label className="block">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Effective date
                          </span>
                          <input
                            name="effectiveDateEn"
                            defaultValue={selectedCompliance.en.effectiveDate}
                            className="app-input mt-2 w-full px-4 py-3 text-sm"
                            placeholder="YYYY-MM-DD"
                          />
                        </label>
                        <label className="block">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Body
                          </span>
                          <textarea
                            name="bodyEn"
                            defaultValue={selectedCompliance.en.body}
                            rows={18}
                            className="app-input mt-2 w-full px-4 py-3 font-mono text-xs"
                          />
                        </label>
                      </div>
                    </section>

                    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <h3 className="text-sm font-semibold text-slate-900">Spanish</h3>
                      <div className="mt-3 space-y-3">
                        <label className="block">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Title
                          </span>
                          <input
                            name="titleEs"
                            defaultValue={selectedCompliance.es.title}
                            className="app-input mt-2 w-full px-4 py-3 text-sm"
                          />
                        </label>
                        <label className="block">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Summary
                          </span>
                          <textarea
                            name="summaryEs"
                            defaultValue={selectedCompliance.es.summary}
                            rows={3}
                            className="app-input mt-2 w-full px-4 py-3 text-sm"
                          />
                        </label>
                        <label className="block">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Effective date
                          </span>
                          <input
                            name="effectiveDateEs"
                            defaultValue={selectedCompliance.es.effectiveDate}
                            className="app-input mt-2 w-full px-4 py-3 text-sm"
                            placeholder="YYYY-MM-DD"
                          />
                        </label>
                        <label className="block">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Body
                          </span>
                          <textarea
                            name="bodyEs"
                            defaultValue={selectedCompliance.es.body}
                            rows={18}
                            className="app-input mt-2 w-full px-4 py-3 font-mono text-xs"
                          />
                        </label>
                      </div>
                    </section>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                    <div className="text-xs text-slate-500 break-words">
                      Public pages:
                      <a
                        href="/legal"
                        target="_blank"
                        rel="noreferrer"
                        className="ml-1 inline-block font-semibold text-sky-700 hover:text-sky-800"
                      >
                        /legal
                      </a>
                      <span className="mx-1">|</span>
                      <a
                        href={`/legal/${selectedComplianceMeta.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block font-semibold text-sky-700 hover:text-sky-800"
                      >
                        /legal/{selectedComplianceMeta.slug}
                      </a>
                    </div>
                    <FormSubmitButton
                      idleLabel="Save compliance document"
                      pendingLabel={t("common.feedback.saving")}
                      successLabel={t("common.feedback.saved")}
                      className="w-full px-5 py-2.5 sm:w-auto"
                    />
                  </div>
                </form>
              </div>
            </div>
          </div>
        ) : null}

        {currentTab === "tiers" ? (
          <div className="app-card p-4 shadow-contrast sm:p-6">
            <h2 className="text-lg font-semibold">{t("admin.settings.tiers.title")}</h2>
            <p className="mt-3 text-sm text-slate-600">{t("admin.settings.tiers.subtitle")}</p>
            <div className="mt-4">
              <ServiceTiersManager />
            </div>
          </div>
        ) : null}

        {currentTab === "notifications" ? (
          <div className="app-card p-4 shadow-contrast sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{t("admin.settings.notifications.title")}</h2>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                Sin codigo
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-600">
              {t("admin.settings.notifications.subtitle")}
            </p>
            <NotificationPreferences />
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}
