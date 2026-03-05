import Link from "next/link";
import { revalidatePath } from "next/cache";
import AppShell from "@/components/layout/AppShell";
import NotificationPreferences from "@/components/settings/NotificationPreferences";
import ServiceTiersManager from "@/components/settings/ServiceTiersManager";
import DocumentPreviewModal from "@/components/settings/DocumentPreviewModal";
import FormSubmitButton from "@/components/ui/FormSubmitButton";
import {
  EMAIL_TEMPLATE_DEFINITIONS,
  EMAIL_TEMPLATE_IDS,
  isEmailTemplateId,
  renderEmailTemplate,
  resolveEmailTemplateLocale,
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
import { getRequestLocale, getTranslations } from "@/i18n/server";

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

const SETTINGS_TAB_IDS: SettingsTabId[] = [
  "social",
  "landing",
  "email-templates",
  "compliance",
  "tiers",
  "notifications",
];

function SettingsTabIcon({ tabId }: { tabId: SettingsTabId }) {
  if (tabId === "social") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        <circle cx="12" cy="12" r="3.5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 7.5C6.3 5 9 3.8 12 3.8S17.7 5 20 7.5M4 16.5C6.3 19 9 20.2 12 20.2s5.7-1.2 8-3.7" />
      </svg>
    );
  }
  if (tabId === "landing") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
        <path strokeLinecap="round" d="M8 9.5h8M8 13h5" />
      </svg>
    );
  }
  if (tabId === "email-templates") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6.5h16v11H4z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 8l8 6 8-6" />
      </svg>
    );
  }
  if (tabId === "compliance") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 4.5h10l2 2v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2Z" />
        <path strokeLinecap="round" d="M9 10h6M9 13h6" />
      </svg>
    );
  }
  if (tabId === "tiers") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        <rect x="4" y="5" width="16" height="4" rx="1.5" />
        <rect x="4" y="10" width="12" height="4" rx="1.5" />
        <rect x="4" y="15" width="8" height="4" rx="1.5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.5v5l3 2" />
      <circle cx="12" cy="12" r="8.5" />
    </svg>
  );
}

function SocialNetworkIcon({ network }: { network: "instagram" | "facebook" | "whatsapp" | "x" | "youtube" | "tiktok" }) {
  if (network === "instagram") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        <rect x="4" y="4" width="16" height="16" rx="5" />
        <circle cx="12" cy="12" r="3.3" />
        <circle cx="16.7" cy="7.3" r="0.9" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (network === "facebook") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M13.6 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.3-1.6 1.6-1.6h1.7V3.5c-.3 0-1.3-.1-2.5-.1-2.5 0-4.1 1.5-4.1 4.3v2.4H8V13h2.3v8h3.3Z" />
      </svg>
    );
  }
  if (network === "whatsapp") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M12.1 3.8a8.2 8.2 0 0 0-7 12.4L4 20.2l4.2-1.1a8.2 8.2 0 1 0 3.9-15.3Zm0 14.9c-1.3 0-2.5-.3-3.6-1l-.3-.2-2.5.7.7-2.4-.2-.3a6.8 6.8 0 1 1 5.9 3.2Zm3.7-4.8c-.2-.1-1.2-.6-1.4-.7-.2-.1-.3-.1-.5.1l-.4.5c-.1.2-.3.2-.5.1-.9-.4-1.7-1.2-2.1-2.1-.1-.2 0-.4.1-.5l.3-.3.1-.2c.1-.1.1-.3 0-.4l-.6-1.4c-.1-.2-.3-.3-.5-.3h-.4c-.1 0-.3.1-.4.2-.5.5-.8 1.1-.8 1.8 0 .2.1.5.2.8.5 1.2 1.4 2.4 2.5 3.2 1.1.8 2.3 1.3 3.5 1.4.4 0 .8-.1 1.2-.3.5-.3.9-.8 1-1.4l.1-.7c0-.2-.1-.3-.3-.4Z" />
      </svg>
    );
  }
  if (network === "x") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M18.6 4h2.7l-5.9 6.8 6.9 9.2h-5.4l-4.2-5.5-4.8 5.5H5.2l6.3-7.3L4.9 4h5.5l3.8 5 4.4-5Z" />
      </svg>
    );
  }
  if (network === "youtube") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M21.6 8.2a2.8 2.8 0 0 0-2-2c-1.8-.5-7.6-.5-7.6-.5s-5.8 0-7.6.5a2.8 2.8 0 0 0-2 2C2 10 2 12 2 12s0 2 .4 3.8a2.8 2.8 0 0 0 2 2c1.8.5 7.6.5 7.6.5s5.8 0 7.6-.5a2.8 2.8 0 0 0 2-2c.4-1.8.4-3.8.4-3.8s0-2-.4-3.8Zm-11.5 6V9.8l4.6 2.2-4.6 2.2Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M17.2 8.1a3.7 3.7 0 0 1-2.3-.8v5.8a4.6 4.6 0 1 1-4.6-4.6h.4V11h-.4a2.1 2.1 0 1 0 2.1 2.1V3.8h2.5c.2 1.4 1.3 2.5 2.7 2.7v1.6Z" />
    </svg>
  );
}

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
  const adminLocale = resolveEmailTemplateLocale(await getRequestLocale());

  await saveEmailTemplateConfig(templateId, {
    subject: String(formData.get("subject") ?? ""),
    text: String(formData.get("text") ?? ""),
    html: "",
  }, adminLocale);

  revalidatePath("/admin/settings");
}

async function saveInvoiceTemplate(formData: FormData) {
  "use server";
  await requireRole("ADMIN");

  const read = (key: string) => String(formData.get(key) ?? "").trim();
  const readBool = (key: string) => String(formData.get(key) ?? "") === "on";
  const current = await getInvoiceTemplateConfig();
  const pick = (key: string, currentValue: string) => {
    const value = read(key);
    return value || currentValue;
  };

  const legalClauses = read("legalClauses")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const normalized = normalizeInvoiceTemplateConfig({
    companyName: pick("companyName", current.companyName),
    companyPhone: pick("companyPhone", current.companyPhone),
    companyEmail: pick("companyEmail", current.companyEmail),
    companyWebsite: pick("companyWebsite", current.companyWebsite),
    companyAddressLine1: pick("companyAddressLine1", current.companyAddressLine1),
    companyAddressLine2: pick("companyAddressLine2", current.companyAddressLine2),
    companyTaxId: pick("companyTaxId", current.companyTaxId),
    headerSubtitle: pick("headerSubtitle", current.headerSubtitle),
    footerNote: pick("footerNote", current.footerNote),
    invoiceNumberLabel: current.invoiceNumberLabel,
    issueDateLabel: current.issueDateLabel,
    billToLabel: current.billToLabel,
    notesLabel: current.notesLabel,
    tableDescriptionLabel: current.tableDescriptionLabel,
    tableAmountLabel: current.tableAmountLabel,
    subtotalLabel: current.subtotalLabel,
    taxLabel: current.taxLabel,
    totalLabel: current.totalLabel,
    clausesTitle: pick("clausesTitle", current.clausesTitle),
    legalClauses: legalClauses.length > 0 ? legalClauses : current.legalClauses,
    showEstimateWatermark: readBool("showEstimateWatermark"),
    themes: current.themes,
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
  const adminLocale = resolveEmailTemplateLocale(await getRequestLocale());
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
    getEmailTemplatesConfig(adminLocale),
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
  const settingsTabs = SETTINGS_TAB_IDS.map((id) => ({
    id,
    label: t(`admin.settings.tabs.${id}.label`),
    hint: t(`admin.settings.tabs.${id}.hint`),
  }));

  const socialFields = [
    {
      key: "instagramUrl",
      label: t("admin.settings.social.fields.instagram"),
      placeholder: "https://instagram.com/...",
      hint: t("admin.settings.social.hints.instagram"),
      value: socialLinks.instagramUrl ?? "",
      icon: "instagram",
      iconTone: "from-fuchsia-500 via-pink-500 to-amber-400",
    },
    {
      key: "facebookUrl",
      label: t("admin.settings.social.fields.facebook"),
      placeholder: "https://facebook.com/...",
      hint: t("admin.settings.social.hints.facebook"),
      value: socialLinks.facebookUrl ?? "",
      icon: "facebook",
      iconTone: "from-blue-600 to-blue-500",
    },
    {
      key: "whatsappUrl",
      label: t("admin.settings.social.fields.whatsapp"),
      placeholder: "+13055550199 / https://wa.me/13055550199",
      hint: t("admin.settings.social.hints.whatsapp"),
      value: socialLinks.whatsappUrl ?? "",
      icon: "whatsapp",
      iconTone: "from-emerald-500 to-green-500",
    },
    {
      key: "xUrl",
      label: t("admin.settings.social.fields.x"),
      placeholder: "https://x.com/...",
      hint: t("admin.settings.social.hints.x"),
      value: socialLinks.xUrl ?? "",
      icon: "x",
      iconTone: "from-slate-900 to-slate-700",
    },
    {
      key: "youtubeUrl",
      label: t("admin.settings.social.fields.youtube"),
      placeholder: "https://youtube.com/@...",
      hint: t("admin.settings.social.hints.youtube"),
      value: socialLinks.youtubeUrl ?? "",
      icon: "youtube",
      iconTone: "from-red-600 to-rose-500",
    },
    {
      key: "tiktokUrl",
      label: t("admin.settings.social.fields.tiktok"),
      placeholder: "https://tiktok.com/@...",
      hint: t("admin.settings.social.hints.tiktok"),
      value: socialLinks.tiktokUrl ?? "",
      icon: "tiktok",
      iconTone: "from-black to-slate-700",
    },
  ] as const;

  const localeSections: Array<{ key: "en" | "es"; label: string }> = [
    { key: "en", label: t("admin.settings.landing.locale.en") },
    { key: "es", label: t("admin.settings.landing.locale.es") },
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
        <div className="settings-top-nav app-card p-3 shadow-contrast sm:p-4">
          <div className="settings-top-nav-grid">
            {settingsTabs.map((tab) => {
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
                  className={`settings-top-nav-item ${isActive ? "is-active" : ""}`}
                >
                  <span className="settings-top-nav-icon">
                    <SettingsTabIcon tabId={tab.id} />
                  </span>
                  <span className="settings-top-nav-text">
                    <span className="settings-top-nav-label">{tab.label}</span>
                    <span className="settings-top-nav-hint">{tab.hint}</span>
                  </span>
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
                    className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-3 shadow-sm transition hover:border-sky-200 hover:shadow-md"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br text-white ${field.iconTone}`}
                      >
                        <SocialNetworkIcon network={field.icon} />
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
            <h2 className="text-lg font-semibold">{t("admin.settings.landing.title")}</h2>
            <p className="mt-2 text-sm text-slate-600">
              {t("admin.settings.landing.subtitle")}
            </p>
            <form action={saveLandingConfiguration} className="mt-5 space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {t("admin.settings.landing.video.label")}
                </label>
                <input
                  name="landingYoutubeUrl"
                  defaultValue={landingConfig.youtubeUrl ?? ""}
                  className="app-input mt-2 w-full px-4 py-3 text-sm"
                  placeholder={t("admin.settings.landing.video.placeholder")}
                />
                <p className="mt-2 text-[11px] text-slate-500">
                  {t("admin.settings.landing.video.hint")}
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
                            {t("admin.settings.landing.fields.badge")}
                          </span>
                          <input
                            name={`promoBadge${suffix}`}
                            defaultValue={localePromo.badge}
                            className="app-input mt-2 w-full px-4 py-3 text-sm"
                          />
                        </label>
                        <label className="block">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            {t("admin.settings.landing.fields.title")}
                          </span>
                          <input
                            name={`promoTitle${suffix}`}
                            defaultValue={localePromo.title}
                            className="app-input mt-2 w-full px-4 py-3 text-sm"
                          />
                        </label>
                        <label className="block">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            {t("admin.settings.landing.fields.detail")}
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
                            {t("admin.settings.landing.fields.note")}
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
                            {t("admin.settings.landing.fields.action")}
                          </span>
                          <input
                            name={`promoAction${suffix}`}
                            defaultValue={localePromo.action}
                            className="app-input mt-2 w-full px-4 py-3 text-sm"
                          />
                        </label>
                        <label className="block">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            {t("admin.settings.landing.fields.cta")}
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
                  idleLabel={t("admin.settings.landing.actions.save")}
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
              <div className="settings-template-toolbar">
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {t("admin.settings.templates.family")}
                  </p>
                  <div className="settings-template-grid settings-template-grid-2 sm:grid-cols-2">
                    <Link
                      href={buildTemplateHref({ kind: "email" })}
                      className={`settings-template-option ${templateKind === "email" ? "is-active" : ""}`}
                    >
                      <span className="settings-template-option-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6.5h16v11H4z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 8l8 6 8-6" />
                        </svg>
                      </span>
                      <span className="settings-template-option-copy">
                        <span className="settings-template-option-title">{t("admin.settings.templates.email.title")}</span>
                        <span className="settings-template-option-hint">{t("admin.settings.templates.email.hint")}</span>
                      </span>
                    </Link>
                    <Link
                      href={buildTemplateHref({ kind: "invoice" })}
                      className={`settings-template-option ${templateKind === "invoice" ? "is-active" : ""}`}
                    >
                      <span className="settings-template-option-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7 4.5h10l2 2v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2Z" />
                          <path strokeLinecap="round" d="M9 10h6M9 13h6" />
                        </svg>
                      </span>
                      <span className="settings-template-option-copy">
                        <span className="settings-template-option-title">{t("admin.settings.templates.invoice.title")}</span>
                        <span className="settings-template-option-hint">{t("admin.settings.templates.invoice.hint")}</span>
                      </span>
                    </Link>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {t("admin.settings.templates.view")}
                  </p>
                  <div className="settings-template-grid settings-template-grid-3">
                    <Link
                      href={buildTemplateHref({ mode: "code" })}
                      className={`settings-template-option ${templateMode === "code" ? "is-active" : ""}`}
                    >
                      <span className="settings-template-option-title">{t("admin.settings.templates.modes.editor")}</span>
                    </Link>
                    <Link
                      href={buildTemplateHref({ mode: "web" })}
                      className={`settings-template-option ${templateMode === "web" ? "is-active" : ""}`}
                    >
                      <span className="settings-template-option-title">{t("admin.settings.templates.modes.preview")}</span>
                    </Link>
                    <Link
                      href={buildTemplateHref({ mode: "split" })}
                      className={`settings-template-option ${templateMode === "split" ? "is-active" : ""}`}
                    >
                      <span className="settings-template-option-title">{t("admin.settings.templates.modes.split")}</span>
                    </Link>
                  </div>
                </div>
              </div>

              <p className="mt-3 text-xs text-slate-500">
                {t("admin.settings.templates.noCode")}
              </p>

              {templateKind === "invoice" ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {t("admin.settings.templates.previewTheme")}
                  </p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    <Link
                      href={buildTemplateHref({ invoiceTheme: "STANDARD" })}
                      className={`settings-template-option ${
                        invoiceThemePreview === "STANDARD" ? "is-active" : ""
                      }`}
                    >
                      {t("admin.invoices.theme.standard")}
                    </Link>
                    <Link
                      href={buildTemplateHref({ invoiceTheme: "SPECIAL" })}
                      className={`settings-template-option ${
                        invoiceThemePreview === "SPECIAL" ? "is-active" : ""
                      }`}
                    >
                      {t("admin.invoices.theme.special")}
                    </Link>
                    <Link
                      href={buildTemplateHref({ invoiceTheme: "ESTIMATE" })}
                      className={`settings-template-option ${
                        invoiceThemePreview === "ESTIMATE" ? "is-active" : ""
                      }`}
                    >
                      {t("admin.invoices.theme.estimate")}
                    </Link>
                  </div>
                </div>
              ) : null}
            </div>

            {templateKind === "email" ? (
              <div className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)]">
                <div className="app-card p-4 shadow-contrast">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {t("admin.settings.templates.emailList")}
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
                        {t("admin.settings.templates.emailEditor", {
                          label: selectedTemplateMeta.label,
                        })}
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
                            {t("admin.settings.templates.subject")}
                          </span>
                          <input
                            name="subject"
                            defaultValue={selectedTemplate.subject}
                            className="app-input mt-2 w-full px-4 py-3 text-sm"
                          />
                        </label>

                        <label className="block">
                          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            {t("admin.settings.templates.textBody")}
                          </span>
                          <textarea
                            name="text"
                            defaultValue={selectedTemplate.text}
                            rows={10}
                            className="app-input mt-2 w-full px-4 py-3 text-sm"
                          />
                        </label>
                        <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                          {t("admin.settings.templates.htmlAuto")}
                        </p>

                        <div className="flex justify-stretch sm:justify-end">
                          <FormSubmitButton
                            idleLabel={t("admin.settings.templates.actions.saveEmail")}
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
                      <h3 className="text-base font-semibold">{t("admin.settings.templates.emailPreview.title")}</h3>
                      <p className="mt-2 text-sm text-slate-600">
                        {t("admin.settings.templates.emailPreview.subtitle")}
                      </p>
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                          {t("admin.settings.templates.emailPreview.inbox")}
                        </p>
                        <div className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">
                          <p className="font-semibold">
                            {t("admin.settings.templates.emailPreview.from")}
                          </p>
                          <p className="mt-1">{t("admin.settings.templates.subject")}: {selectedTemplatePreview.subject}</p>
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
                    <h2 className="text-lg font-semibold">{t("admin.settings.invoiceEditor.title")}</h2>
                    <p className="mt-2 text-sm text-slate-600">
                      {t("admin.settings.invoiceEditor.subtitle")}
                    </p>
                    <form action={saveInvoiceTemplate} className="mt-5 space-y-5">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold text-slate-900">{t("admin.settings.invoiceEditor.sections.company")}</h3>
                          <p className="text-[11px] text-slate-500">
                            {t("admin.settings.invoiceEditor.sections.companyHint")}
                          </p>
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <label className="block">
                          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            {t("admin.settings.invoiceEditor.fields.companyName")}
                          </span>
                          <input
                            name="companyName"
                            defaultValue={invoiceTemplate.companyName}
                            className="app-input mt-2 w-full px-4 py-3 text-sm"
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            {t("admin.settings.invoiceEditor.fields.headerSubtitle")}
                          </span>
                          <input
                            name="headerSubtitle"
                            defaultValue={invoiceTemplate.headerSubtitle}
                            className="app-input mt-2 w-full px-4 py-3 text-sm"
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            {t("admin.settings.invoiceEditor.fields.phone")}
                          </span>
                          <input
                            name="companyPhone"
                            defaultValue={invoiceTemplate.companyPhone}
                            className="app-input mt-2 w-full px-4 py-3 text-sm"
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            {t("admin.settings.invoiceEditor.fields.email")}
                          </span>
                          <input
                            name="companyEmail"
                            defaultValue={invoiceTemplate.companyEmail}
                            className="app-input mt-2 w-full px-4 py-3 text-sm"
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            {t("admin.settings.invoiceEditor.fields.website")}
                          </span>
                          <input
                            name="companyWebsite"
                            defaultValue={invoiceTemplate.companyWebsite}
                            className="app-input mt-2 w-full px-4 py-3 text-sm"
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            {t("admin.settings.invoiceEditor.fields.taxId")}
                          </span>
                          <input
                            name="companyTaxId"
                            defaultValue={invoiceTemplate.companyTaxId}
                            className="app-input mt-2 w-full px-4 py-3 text-sm"
                          />
                        </label>
                        <label className="block sm:col-span-2">
                          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            {t("admin.settings.invoiceEditor.fields.addressLine1")}
                          </span>
                          <input
                            name="companyAddressLine1"
                            defaultValue={invoiceTemplate.companyAddressLine1}
                            className="app-input mt-2 w-full px-4 py-3 text-sm"
                          />
                        </label>
                        <label className="block sm:col-span-2">
                          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            {t("admin.settings.invoiceEditor.fields.addressLine2")}
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
                        <h3 className="text-sm font-semibold text-slate-900">{t("admin.settings.invoiceEditor.sections.footer")}</h3>
                        <div className="mt-3 space-y-3">
                          <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                              {t("admin.settings.invoiceEditor.fields.footerNote")}
                            </span>
                            <input
                              name="footerNote"
                              defaultValue={invoiceTemplate.footerNote}
                              className="app-input mt-2 w-full px-4 py-3 text-sm"
                            />
                          </label>
                          <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                              {t("admin.settings.invoiceEditor.fields.clausesTitle")}
                            </span>
                            <input
                              name="clausesTitle"
                              defaultValue={invoiceTemplate.clausesTitle}
                              className="app-input mt-2 w-full px-4 py-3 text-sm"
                            />
                          </label>
                          <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                              {t("admin.settings.invoiceEditor.fields.legalClauses")}
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
                          <h3 className="text-sm font-semibold text-slate-900">{t("admin.settings.invoiceEditor.sections.watermark")}</h3>
                          <p className="text-[11px] text-slate-500">
                            {t("admin.settings.invoiceEditor.watermarkHint")}
                          </p>
                        </div>
                        <label className="mt-3 inline-flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            name="showEstimateWatermark"
                            defaultChecked={invoiceTemplate.showEstimateWatermark}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          {t("admin.settings.invoiceEditor.showWatermark")}
                        </label>
                      </div>

                      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                        <p className="text-xs text-slate-500">
                          {t("admin.settings.invoiceEditor.lineItemsHint")}
                        </p>
                        <FormSubmitButton
                          idleLabel={t("admin.settings.invoiceEditor.actions.save")}
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
                    <h3 className="text-base font-semibold">{t("admin.settings.invoiceEditor.preview.title")}</h3>
                    <p className="mt-2 text-sm text-slate-600">
                      {t("admin.settings.invoiceEditor.preview.subtitle")}
                    </p>
                    <DocumentPreviewModal
                      title={t("admin.settings.invoiceEditor.preview.modalTitle", {
                        theme: invoiceThemePreview,
                      })}
                      srcDoc={invoiceTemplatePreview}
                      previewLabel={t("admin.settings.invoiceEditor.preview.previewLabel")}
                      previewHint={t("admin.settings.invoiceEditor.preview.previewHint")}
                      openLabel={t("admin.settings.invoiceEditor.preview.open")}
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
                {t("admin.settings.compliance.listTitle")}
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
                  {t("admin.settings.compliance.editorTitle", {
                    label: selectedComplianceMeta.label,
                  })}
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  {t("admin.settings.compliance.editorSubtitle")}
                </p>

                <form action={saveComplianceDoc} className="mt-5 space-y-6">
                  <input type="hidden" name="docId" value={selectedComplianceDocId} />

                  <div className="grid gap-5 xl:grid-cols-2">
                    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <h3 className="text-sm font-semibold text-slate-900">{t("admin.settings.compliance.language.en")}</h3>
                      <div className="mt-3 space-y-3">
                        <label className="block">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            {t("admin.settings.compliance.fields.title")}
                          </span>
                          <input
                            name="titleEn"
                            defaultValue={selectedCompliance.en.title}
                            className="app-input mt-2 w-full px-4 py-3 text-sm"
                          />
                        </label>
                        <label className="block">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            {t("admin.settings.compliance.fields.summary")}
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
                            {t("admin.settings.compliance.fields.effectiveDate")}
                          </span>
                          <input
                            name="effectiveDateEn"
                            defaultValue={selectedCompliance.en.effectiveDate}
                            className="app-input mt-2 w-full px-4 py-3 text-sm"
                            placeholder={t("admin.settings.compliance.placeholders.date")}
                          />
                        </label>
                        <label className="block">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            {t("admin.settings.compliance.fields.body")}
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
                      <h3 className="text-sm font-semibold text-slate-900">{t("admin.settings.compliance.language.es")}</h3>
                      <div className="mt-3 space-y-3">
                        <label className="block">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            {t("admin.settings.compliance.fields.title")}
                          </span>
                          <input
                            name="titleEs"
                            defaultValue={selectedCompliance.es.title}
                            className="app-input mt-2 w-full px-4 py-3 text-sm"
                          />
                        </label>
                        <label className="block">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            {t("admin.settings.compliance.fields.summary")}
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
                            {t("admin.settings.compliance.fields.effectiveDate")}
                          </span>
                          <input
                            name="effectiveDateEs"
                            defaultValue={selectedCompliance.es.effectiveDate}
                            className="app-input mt-2 w-full px-4 py-3 text-sm"
                            placeholder={t("admin.settings.compliance.placeholders.date")}
                          />
                        </label>
                        <label className="block">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            {t("admin.settings.compliance.fields.body")}
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
                      {t("admin.settings.compliance.publicPages")}:
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
                      idleLabel={t("admin.settings.compliance.actions.save")}
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
                {t("admin.settings.notifications.noCode")}
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
