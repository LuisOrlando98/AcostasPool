export type InvoiceTemplateTheme = "STANDARD" | "SPECIAL" | "ESTIMATE";
export type InvoiceTemplateLocale = "EN" | "ES";

export type InvoiceTemplateThemeConfig = {
  label: string;
  brandHex: string;
  accentHex: string;
  lightHex: string;
  watermarkText?: string;
};

export type InvoiceTemplateConfig = {
  companyName: string;
  companyPhone: string;
  companyEmail: string;
  companyWebsite: string;
  companyAddressLine1: string;
  companyAddressLine2: string;
  companyTaxId: string;
  headerSubtitle: string;
  footerNote: string;
  invoiceNumberLabel: string;
  issueDateLabel: string;
  billToLabel: string;
  notesLabel: string;
  tableDescriptionLabel: string;
  tableAmountLabel: string;
  subtotalLabel: string;
  taxLabel: string;
  totalLabel: string;
  clausesTitle: string;
  legalClauses: string[];
  showEstimateWatermark: boolean;
  themes: Record<InvoiceTemplateTheme, InvoiceTemplateThemeConfig>;
};

type InvoiceTemplateLocaleCopy = {
  htmlLang: "en" | "es";
  intlLocale: "en-US" | "es-US";
  serviceFallbackLabel: string;
  headerSubtitle: string;
  footerNote: string;
  invoiceNumberLabel: string;
  issueDateLabel: string;
  billToLabel: string;
  notesLabel: string;
  tableDescriptionLabel: string;
  tableAmountLabel: string;
  subtotalLabel: string;
  taxLabel: string;
  totalLabel: string;
  clausesTitle: string;
  legalClauses: string[];
  standardThemeLabel: string;
  specialThemeLabel: string;
  estimateThemeLabel: string;
  estimateWatermarkText: string;
  issuedByLabel: string;
  qtyLabel: string;
  unitPriceLabel: string;
  invoiceSummaryLabel: string;
  paymentMethodsLabel: string;
  paymentMethodLabel: string;
  paymentMethodsInline: string;
  paymentMethodLine: string;
  paymentAcceptLine: string;
  ownerRoleLabel: string;
  noLineItemsLabel: string;
  noAdditionalNotesLabel: string;
  paymentTermsPrefix: string;
  paymentTermsFallback: string;
  thankYouFallback: string;
};

const INVOICE_TEMPLATE_LOCALE_COPY: Record<InvoiceTemplateLocale, InvoiceTemplateLocaleCopy> = {
  EN: {
    htmlLang: "en",
    intlLocale: "en-US",
    serviceFallbackLabel: "Service",
    headerSubtitle: "REPAIR AND MAINTENANCE",
    footerNote: "Thank you for trusting AcostasPool.",
    invoiceNumberLabel: "Invoice #",
    issueDateLabel: "Issue date",
    billToLabel: "Bill To",
    notesLabel: "Notes",
    tableDescriptionLabel: "Description",
    tableAmountLabel: "Amount",
    subtotalLabel: "Subtotal",
    taxLabel: "Tax",
    totalLabel: "Total",
    clausesTitle: "Terms and clauses",
    legalClauses: [
      "Payment is due upon receipt unless otherwise agreed in writing.",
      "Late balances may incur service hold and applicable fees.",
      "This document reflects services rendered and approved.",
    ],
    standardThemeLabel: "INVOICE",
    specialThemeLabel: "SPECIAL INVOICE",
    estimateThemeLabel: "ESTIMATE",
    estimateWatermarkText: "ESTIMATE",
    issuedByLabel: "Issued By",
    qtyLabel: "Qty",
    unitPriceLabel: "Unit Price",
    invoiceSummaryLabel: "Invoice Summary",
    paymentMethodsLabel: "Payment Methods",
    paymentMethodLabel: "Payment Method:",
    paymentMethodsInline: "Credit | Debit | ACH | Check | Zelle | Cash",
    paymentMethodLine: "Credit / Debit / ACH / Check",
    paymentAcceptLine: "We accept: Visa, MasterCard, Zelle, Cash",
    ownerRoleLabel: "President / Owner",
    noLineItemsLabel: "No line items",
    noAdditionalNotesLabel: "No additional notes.",
    paymentTermsPrefix: "Payment authorization consent",
    paymentTermsFallback: "Payment is due upon receipt unless otherwise agreed in writing.",
    thankYouFallback: "Thank you for trusting AcostasPool.",
  },
  ES: {
    htmlLang: "es",
    intlLocale: "es-US",
    serviceFallbackLabel: "Servicio",
    headerSubtitle: "REPARACION Y MANTENIMIENTO",
    footerNote: "Gracias por confiar en AcostasPool.",
    invoiceNumberLabel: "Factura #",
    issueDateLabel: "Fecha de emision",
    billToLabel: "Facturar a",
    notesLabel: "Notas",
    tableDescriptionLabel: "Descripcion",
    tableAmountLabel: "Monto",
    subtotalLabel: "Subtotal",
    taxLabel: "Impuesto",
    totalLabel: "Total",
    clausesTitle: "Terminos y clausulas",
    legalClauses: [
      "El pago vence al recibir esta factura salvo acuerdo por escrito.",
      "Los saldos vencidos pueden generar suspension del servicio y cargos aplicables.",
      "Este documento refleja los servicios realizados y aprobados.",
    ],
    standardThemeLabel: "FACTURA",
    specialThemeLabel: "FACTURA ESPECIAL",
    estimateThemeLabel: "ESTIMADO",
    estimateWatermarkText: "ESTIMADO",
    issuedByLabel: "Emitido por",
    qtyLabel: "Cant.",
    unitPriceLabel: "Precio Unit.",
    invoiceSummaryLabel: "Resumen de factura",
    paymentMethodsLabel: "Metodos de pago",
    paymentMethodLabel: "Metodo de pago:",
    paymentMethodsInline: "Credito | Debito | ACH | Cheque | Zelle | Efectivo",
    paymentMethodLine: "Credito / Debito / ACH / Cheque",
    paymentAcceptLine: "Aceptamos: Visa, MasterCard, Zelle, Efectivo",
    ownerRoleLabel: "Presidente / Propietario",
    noLineItemsLabel: "Sin conceptos",
    noAdditionalNotesLabel: "Sin notas adicionales.",
    paymentTermsPrefix: "Consentimiento de autorizacion de pago",
    paymentTermsFallback: "El pago vence al recibir esta factura salvo acuerdo por escrito.",
    thankYouFallback: "Gracias por confiar en AcostasPool.",
  },
};

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

export const DEFAULT_INVOICE_TEMPLATE: InvoiceTemplateConfig = {
  companyName: "ACOSTASPOOL",
  companyPhone: "+1 (305) 555-0199",
  companyEmail: "support@acostaspool.com",
  companyWebsite: "www.acostaspool.com",
  companyAddressLine1: "Miami, Florida",
  companyAddressLine2: "United States",
  companyTaxId: "Tax ID: 00-0000000",
  headerSubtitle: "REPAIR AND MAINTENANCE",
  footerNote: "Thank you for trusting AcostasPool.",
  invoiceNumberLabel: "Invoice #",
  issueDateLabel: "Issue date",
  billToLabel: "Bill To",
  notesLabel: "Notes",
  tableDescriptionLabel: "Description",
  tableAmountLabel: "Amount",
  subtotalLabel: "Subtotal",
  taxLabel: "Tax",
  totalLabel: "Total",
  clausesTitle: "Terms and clauses",
  legalClauses: [
    "Payment is due upon receipt unless otherwise agreed in writing.",
    "Late balances may incur service hold and applicable fees.",
    "This document reflects services rendered and approved.",
  ],
  showEstimateWatermark: true,
  themes: {
    STANDARD: {
      label: "INVOICE",
      brandHex: "#304B88",
      accentHex: "#FFFFFF",
      lightHex: "#EAF0FB",
      watermarkText: "",
    },
    SPECIAL: {
      label: "SPECIAL INVOICE",
      brandHex: "#304B88",
      accentHex: "#FFFFFF",
      lightHex: "#EAF0FB",
      watermarkText: "",
    },
    ESTIMATE: {
      label: "ESTIMATE",
      brandHex: "#304B88",
      accentHex: "#FFFFFF",
      lightHex: "#EAF0FB",
      watermarkText: "ESTIMATE",
    },
  },
};

export function resolveInvoiceTemplateLocale(value: unknown): InvoiceTemplateLocale {
  return value === "ES" ? "ES" : "EN";
}

export function getInvoiceTemplateLocaleCopy(
  locale: InvoiceTemplateLocale
): InvoiceTemplateLocaleCopy {
  return INVOICE_TEMPLATE_LOCALE_COPY[locale];
}

export function localizeInvoiceTemplate(
  template: InvoiceTemplateConfig,
  locale: InvoiceTemplateLocale
): InvoiceTemplateConfig {
  const copy = getInvoiceTemplateLocaleCopy(locale);
  return {
    ...template,
    headerSubtitle: copy.headerSubtitle,
    footerNote: copy.footerNote,
    invoiceNumberLabel: copy.invoiceNumberLabel,
    issueDateLabel: copy.issueDateLabel,
    billToLabel: copy.billToLabel,
    notesLabel: copy.notesLabel,
    tableDescriptionLabel: copy.tableDescriptionLabel,
    tableAmountLabel: copy.tableAmountLabel,
    subtotalLabel: copy.subtotalLabel,
    taxLabel: copy.taxLabel,
    totalLabel: copy.totalLabel,
    clausesTitle: copy.clausesTitle,
    legalClauses: copy.legalClauses,
    themes: {
      STANDARD: {
        ...template.themes.STANDARD,
        label: copy.standardThemeLabel,
      },
      SPECIAL: {
        ...template.themes.SPECIAL,
        label: copy.specialThemeLabel,
      },
      ESTIMATE: {
        ...template.themes.ESTIMATE,
        label: copy.estimateThemeLabel,
        watermarkText: copy.estimateWatermarkText,
      },
    },
  };
}

function normalizeText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeOptionalText(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }
  return value.trim();
}

function normalizeClauses(value: unknown, fallback: string[]) {
  if (Array.isArray(value)) {
    const cleaned = value
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter(Boolean);
    return cleaned.length > 0 ? cleaned : fallback;
  }

  if (typeof value === "string") {
    const cleaned = value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    return cleaned.length > 0 ? cleaned : fallback;
  }

  return fallback;
}

function normalizeHex(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }
  const normalized = value.trim();
  return HEX_PATTERN.test(normalized) ? normalized.toUpperCase() : fallback;
}

function normalizeThemeConfig(
  value: unknown,
  fallback: InvoiceTemplateThemeConfig
): InvoiceTemplateThemeConfig {
  if (!value || typeof value !== "object") {
    return fallback;
  }
  const source = value as Partial<InvoiceTemplateThemeConfig>;
  return {
    label: normalizeText(source.label, fallback.label),
    brandHex: normalizeHex(source.brandHex, fallback.brandHex),
    accentHex: normalizeHex(source.accentHex, fallback.accentHex),
    lightHex: normalizeHex(source.lightHex, fallback.lightHex),
    watermarkText:
      typeof source.watermarkText === "string"
        ? source.watermarkText.trim()
        : fallback.watermarkText ?? "",
  };
}

export function normalizeInvoiceTemplateConfig(value: unknown): InvoiceTemplateConfig {
  if (!value || typeof value !== "object") {
    return DEFAULT_INVOICE_TEMPLATE;
  }

  const source = value as Partial<InvoiceTemplateConfig> & {
    themes?: Partial<Record<InvoiceTemplateTheme, InvoiceTemplateThemeConfig>>;
  };
  const sourceThemes: Partial<Record<InvoiceTemplateTheme, InvoiceTemplateThemeConfig>> =
    source.themes ?? {};

  return {
    companyName: normalizeText(source.companyName, DEFAULT_INVOICE_TEMPLATE.companyName),
    companyPhone: normalizeOptionalText(
      source.companyPhone,
      DEFAULT_INVOICE_TEMPLATE.companyPhone
    ),
    companyEmail: normalizeOptionalText(
      source.companyEmail,
      DEFAULT_INVOICE_TEMPLATE.companyEmail
    ),
    companyWebsite: normalizeOptionalText(
      source.companyWebsite,
      DEFAULT_INVOICE_TEMPLATE.companyWebsite
    ),
    companyAddressLine1: normalizeOptionalText(
      source.companyAddressLine1,
      DEFAULT_INVOICE_TEMPLATE.companyAddressLine1
    ),
    companyAddressLine2: normalizeOptionalText(
      source.companyAddressLine2,
      DEFAULT_INVOICE_TEMPLATE.companyAddressLine2
    ),
    companyTaxId: normalizeOptionalText(
      source.companyTaxId,
      DEFAULT_INVOICE_TEMPLATE.companyTaxId
    ),
    headerSubtitle: normalizeText(
      source.headerSubtitle,
      DEFAULT_INVOICE_TEMPLATE.headerSubtitle
    ),
    footerNote: normalizeText(source.footerNote, DEFAULT_INVOICE_TEMPLATE.footerNote),
    invoiceNumberLabel: normalizeText(
      source.invoiceNumberLabel,
      DEFAULT_INVOICE_TEMPLATE.invoiceNumberLabel
    ),
    issueDateLabel: normalizeText(
      source.issueDateLabel,
      DEFAULT_INVOICE_TEMPLATE.issueDateLabel
    ),
    billToLabel: normalizeText(source.billToLabel, DEFAULT_INVOICE_TEMPLATE.billToLabel),
    notesLabel: normalizeText(source.notesLabel, DEFAULT_INVOICE_TEMPLATE.notesLabel),
    tableDescriptionLabel: normalizeText(
      source.tableDescriptionLabel,
      DEFAULT_INVOICE_TEMPLATE.tableDescriptionLabel
    ),
    tableAmountLabel: normalizeText(
      source.tableAmountLabel,
      DEFAULT_INVOICE_TEMPLATE.tableAmountLabel
    ),
    subtotalLabel: normalizeText(source.subtotalLabel, DEFAULT_INVOICE_TEMPLATE.subtotalLabel),
    taxLabel: normalizeText(source.taxLabel, DEFAULT_INVOICE_TEMPLATE.taxLabel),
    totalLabel: normalizeText(source.totalLabel, DEFAULT_INVOICE_TEMPLATE.totalLabel),
    clausesTitle: normalizeText(source.clausesTitle, DEFAULT_INVOICE_TEMPLATE.clausesTitle),
    legalClauses: normalizeClauses(
      source.legalClauses,
      DEFAULT_INVOICE_TEMPLATE.legalClauses
    ),
    showEstimateWatermark:
      typeof source.showEstimateWatermark === "boolean"
        ? source.showEstimateWatermark
        : DEFAULT_INVOICE_TEMPLATE.showEstimateWatermark,
    themes: {
      STANDARD: normalizeThemeConfig(
        sourceThemes.STANDARD,
        DEFAULT_INVOICE_TEMPLATE.themes.STANDARD
      ),
      SPECIAL: normalizeThemeConfig(
        sourceThemes.SPECIAL,
        DEFAULT_INVOICE_TEMPLATE.themes.SPECIAL
      ),
      ESTIMATE: normalizeThemeConfig(
        sourceThemes.ESTIMATE,
        DEFAULT_INVOICE_TEMPLATE.themes.ESTIMATE
      ),
    },
  };
}

export function toPdfRgbTuple(hex: string): [number, number, number] {
  const safeHex = normalizeHex(hex, "#000000").slice(1);
  const red = Number.parseInt(safeHex.slice(0, 2), 16) / 255;
  const green = Number.parseInt(safeHex.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(safeHex.slice(4, 6), 16) / 255;
  return [red, green, blue];
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type InvoiceTemplateRenderLineItem = {
  label: string;
  quantity: number;
  unitPrice: number;
  amount: number;
};

export type InvoiceTemplateRenderInput = {
  template: InvoiceTemplateConfig;
  theme: InvoiceTemplateTheme;
  locale?: InvoiceTemplateLocale;
  invoiceNumber: string;
  issueDateLabel: string;
  customerName: string;
  customerAddress?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  items: InvoiceTemplateRenderLineItem[];
  subtotal: number;
  tax: number;
  total: number;
  notes?: string | null;
};

function compactLine(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

type InvoiceNotePair = {
  en: string;
  es: string;
};

const LOCALIZABLE_INVOICE_NOTES: InvoiceNotePair[] = [
  {
    en: "Service completed and balanced. Thank you for trusting us.",
    es: "Servicio completado y balanceado. Gracias por confiar en nosotros.",
  },
  {
    en: "Service completed and balanced.",
    es: "Servicio completado y balanceado.",
  },
  {
    en: "No additional notes.",
    es: "Sin notas adicionales.",
  },
];

function normalizeComparableNote(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function localizeInvoiceNotes(
  value: string | null | undefined,
  locale: InvoiceTemplateLocale
) {
  const clean = compactLine(value);
  if (!clean) {
    return "";
  }

  const normalized = normalizeComparableNote(clean);
  for (const pair of LOCALIZABLE_INVOICE_NOTES) {
    if (
      normalized === normalizeComparableNote(pair.en) ||
      normalized === normalizeComparableNote(pair.es)
    ) {
      return locale === "ES" ? pair.es : pair.en;
    }
  }

  return clean;
}

function money(value: number) {
  return `$${value.toFixed(2)}`;
}

export function renderInvoiceTemplateHtml(input: InvoiceTemplateRenderInput) {
  const { template, theme } = input;
  const locale = resolveInvoiceTemplateLocale(input.locale);
  const localeCopy = getInvoiceTemplateLocaleCopy(locale);
  const resolvedTheme = template.themes[theme];

  const customerLines = [
    input.customerName,
    input.customerAddress,
    input.customerEmail,
    input.customerPhone,
  ]
    .map(compactLine)
    .filter(Boolean);

  const issuerAddress = [template.companyAddressLine1, template.companyAddressLine2]
    .map(compactLine)
    .filter(Boolean)
    .join(", ");

  const issuedByLines = [
    compactLine(template.companyName),
    issuerAddress,
    compactLine(template.companyEmail),
    compactLine(template.companyPhone),
    compactLine(template.companyWebsite),
    compactLine(template.companyTaxId),
  ].filter(Boolean);

  const itemRows = input.items.length
    ? input.items
        .map(
          (item, index) => `<tr>
  <td class="col-index">${index + 1}</td>
  <td class="col-description">${escapeHtml(item.label)}</td>
  <td class="col-qty">${item.quantity}</td>
  <td class="col-money">${money(item.unitPrice)}</td>
  <td class="col-money col-money-strong">${money(item.amount)}</td>
</tr>`
        )
        .join("")
    : `<tr>
  <td colspan="5" class="empty-row">${escapeHtml(localeCopy.noLineItemsLabel)}</td>
</tr>`;

  const watermark =
    theme === "ESTIMATE" &&
    template.showEstimateWatermark &&
    resolvedTheme.watermarkText
      ? `<div class="watermark">${escapeHtml(resolvedTheme.watermarkText)}</div>`
      : "";

  const notesBody = localizeInvoiceNotes(input.notes, locale);
  const thankYouNote = compactLine(template.footerNote) || localeCopy.thankYouFallback;
  const notesDisplay = notesBody || localeCopy.noAdditionalNotesLabel;
  const paymentTerms = template.legalClauses[0]
    ? `${localeCopy.paymentTermsPrefix}: ${template.legalClauses[0]}`
    : `${localeCopy.paymentTermsPrefix}: ${localeCopy.paymentTermsFallback}`;
  const logoLineOne = "ACOSTA'S";
  const logoLineTwo = "POOL";

  return `<!doctype html>
<html lang="${localeCopy.htmlLang}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      @page {
        size: A4;
        margin: 0;
      }

      :root {
        --brand: ${resolvedTheme.brandHex};
        --accent: ${resolvedTheme.accentHex};
        --light: ${resolvedTheme.lightHex};
        --paper: #ffffff;
        --line: #d6e0ee;
        --line-strong: #b5c5da;
        --text: #142236;
        --muted: #5f738d;
        --ink-soft: #2f4868;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        padding: 0;
      }

      body {
        background: #dbe4f0;
        color: var(--text);
        font-family: "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif;
        -webkit-font-smoothing: antialiased;
        text-rendering: geometricPrecision;
      }

      .sheet {
        position: relative;
        width: 210mm;
        height: 297mm;
        margin: 0 auto;
        overflow: hidden;
        border: 2px solid rgba(48, 75, 136, 0.85);
        background:
          radial-gradient(circle at 84% -14%, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0) 32%),
          linear-gradient(180deg, rgba(239, 245, 253, 0.62) 0%, rgba(255, 255, 255, 0.94) 20%, #ffffff 100%);
      }

      .header {
        background: linear-gradient(135deg, var(--brand) 0%, #223a69 100%);
        color: #ffffff;
        padding: 18px 20px 16px;
        position: relative;
      }

      .header::after {
        content: "";
        position: absolute;
        left: 20px;
        right: 20px;
        bottom: 0;
        height: 1px;
        background: linear-gradient(90deg, rgba(255, 255, 255, 0.94) 0%, rgba(255, 255, 255, 0.52) 66%, rgba(255, 255, 255, 0.12) 100%);
      }

      .header-grid {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 10px;
        align-items: start;
      }

      .brand-lockup {
        width: 150px;
        background: rgba(24, 45, 88, 0.35);
        padding: 2px 8px 5px 6px;
        text-align: center;
        justify-self: start;
      }

      .brand-mark {
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        align-items: center;
        min-height: 0;
      }

      .brand-word {
        margin: 0;
        font-weight: 900;
        font-size: 18px;
        line-height: 0.86;
        letter-spacing: 0.015em;
        text-transform: uppercase;
      }

      .brand-word + .brand-word {
        margin-top: -2px;
      }

      .brand-rule {
        margin-top: 0;
        height: 2px;
        width: 100%;
        background: rgba(255, 255, 255, 0.95);
      }

      .brand-subtitle {
        margin-top: 2px;
        font-size: 7.4px;
        font-weight: 500;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: rgba(241, 249, 255, 0.95);
      }

      .invoice-head {
        text-align: right;
        padding-top: 0;
      }

      .invoice-label {
        margin: 0;
        font-size: 25px;
        font-weight: 900;
        line-height: 1;
        letter-spacing: 0.03em;
        text-transform: uppercase;
      }

      .invoice-meta {
        margin-top: 8px;
        font-size: 10px;
        font-weight: 600;
        color: rgba(236, 245, 255, 0.98);
        display: grid;
        gap: 3px;
      }

      .invoice-meta p {
        margin: 0;
      }

      .invoice-body {
        padding: 16px 28px 20px;
        padding-bottom: 252px;
      }

      .info-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 18px;
        padding-bottom: 11px;
        border-bottom: 1px solid var(--line);
      }

      .info-block {
        position: relative;
        padding-left: 12px;
      }

      .info-block::before {
        content: "";
        position: absolute;
        left: 0;
        top: 2px;
        bottom: 2px;
        width: 2px;
        background: linear-gradient(180deg, var(--brand) 0%, rgba(48, 75, 136, 0.22) 100%);
      }

      .block-title {
        margin: 0;
        font-size: 9px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted);
      }

      .block-line {
        margin: 3px 0 0;
        font-size: 10px;
        line-height: 1.22;
        color: var(--ink-soft);
        word-break: break-word;
      }

      .block-line-strong {
        margin-top: 5px;
        font-size: 13px;
        font-weight: 800;
        line-height: 1.2;
        color: var(--text);
      }

      .table-zone {
        margin-top: 12px;
        border-top: 2px solid var(--brand);
      }

      .items {
        width: 100%;
        border-collapse: collapse;
        font-size: 10px;
      }

      .items thead tr {
        background: linear-gradient(180deg, var(--light) 0%, #f8fbff 100%);
      }

      .items th {
        padding: 7px 7px;
        border-bottom: 1px solid var(--line-strong);
        font-size: 9px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--brand);
        text-align: left;
      }

      .items td {
        padding: 7px;
        border-bottom: 1px solid #e5edf8;
        font-size: 10px;
        color: var(--ink-soft);
      }

      .col-index {
        width: 30px;
        text-align: center;
        color: var(--muted);
      }

      .col-description {
        font-weight: 600;
        color: var(--text);
      }

      .col-qty {
        width: 52px;
        text-align: center;
      }

      .col-money {
        width: 92px;
        text-align: right;
        white-space: nowrap;
      }

      .col-money-strong {
        font-weight: 800;
      }

      .empty-row {
        text-align: center;
        padding: 10px 10px;
        color: var(--muted);
      }

      .summary-grid {
        margin-top: 10px;
        display: flex;
        justify-content: flex-end;
      }

      .totals {
        min-width: 220px;
        padding: 10px 12px 11px;
        border: 1px solid var(--line-strong);
        background: linear-gradient(180deg, #f4f8ff 0%, #ffffff 100%);
      }

      .totals-title {
        margin: 0 0 6px;
        font-size: 9px;
        font-weight: 800;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--muted);
      }

      .totals-row {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin: 0;
        font-size: 10.5px;
        color: var(--muted);
      }

      .totals-row + .totals-row {
        margin-top: 4px;
      }

      .totals-row strong {
        color: var(--text);
        font-weight: 700;
      }

      .totals-row-total {
        margin-top: 7px;
        padding-top: 6px;
        border-top: 1px solid var(--line-strong);
      }

      .totals-row-total span {
        font-size: 18px;
        font-weight: 800;
        color: var(--brand);
      }

      .totals-row-total strong {
        font-size: 26px;
        font-weight: 900;
        color: var(--brand);
      }

      .service-grid {
        margin-top: 10px;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
        padding: 10px 8px;
        border-top: 1px solid var(--line);
        border-bottom: 1px solid var(--line);
      }

      .service-title {
        margin: 0;
        font-size: 8px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--muted);
      }

      .service-main {
        margin: 4px 0 0;
        font-size: 9px;
        line-height: 1.32;
        color: var(--text);
        word-break: break-word;
      }

      .service-sub {
        margin: 4px 0 0;
        font-size: 8px;
        line-height: 1.28;
        color: var(--muted);
        word-break: break-word;
      }

      .footer {
        margin-top: 6px;
        border-top: 1px solid var(--line);
        padding-top: 8px;
      }

      .footer-head {
        margin-top: 0;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 12px;
        align-items: start;
      }

      .bottom-stack {
        position: absolute;
        left: 28px;
        right: 28px;
        bottom: 22px;
      }

      .payment-title {
        margin: 0;
        font-size: 10px;
        font-weight: 800;
        color: var(--text);
      }

      .payment-line {
        margin: 2px 0 0;
        font-size: 8px;
        color: var(--ink-soft);
        line-height: 1.3;
      }

      .owner-box {
        text-align: right;
      }

      .owner-name {
        margin: 0;
        font-size: 12px;
        font-weight: 800;
        color: var(--text);
      }

      .owner-role {
        margin: 2px 0 0;
        font-size: 9px;
        color: var(--ink-soft);
      }

      .watermark {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
        font-size: 110px;
        font-weight: 800;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: rgba(48, 75, 136, 0.13);
        text-shadow: 0 0 1px rgba(70, 83, 98, 0.05);
        transform: rotate(-28deg);
      }
    </style>
  </head>
  <body>
    <article class="sheet">
      <header class="header">
        <div class="header-grid">
          <div class="brand-lockup">
            <div class="brand-mark">
              <p class="brand-word">${escapeHtml(logoLineOne)}</p>
              <p class="brand-word">${escapeHtml(logoLineTwo)}</p>
            </div>
            <div class="brand-rule"></div>
            <p class="brand-subtitle">${escapeHtml(template.headerSubtitle)}</p>
          </div>
          <div class="invoice-head">
            <p class="invoice-label">${escapeHtml(resolvedTheme.label)}</p>
            <div class="invoice-meta">
              <p>${escapeHtml(template.invoiceNumberLabel)}: ${escapeHtml(input.invoiceNumber)}</p>
              <p>${escapeHtml(template.issueDateLabel)}: ${escapeHtml(input.issueDateLabel)}</p>
            </div>
          </div>
        </div>
      </header>

      <section class="invoice-body">
        <div class="info-grid">
          <section class="info-block">
            <p class="block-title">${escapeHtml(template.billToLabel)}</p>
            ${customerLines
              .map((line, index) =>
                index === 0
                  ? `<p class="block-line block-line-strong">${escapeHtml(line)}</p>`
                  : `<p class="block-line">${escapeHtml(line)}</p>`
              )
              .join("")}
          </section>
          <section class="info-block">
            <p class="block-title">${escapeHtml(localeCopy.issuedByLabel)}</p>
            ${issuedByLines
              .map((line, index) =>
                index === 0
                  ? `<p class="block-line block-line-strong">${escapeHtml(line)}</p>`
                  : `<p class="block-line">${escapeHtml(line)}</p>`
              )
              .join("")}
          </section>
        </div>

        <div class="table-zone">
          <table class="items">
            <thead>
              <tr>
                <th>#</th>
                <th>${escapeHtml(template.tableDescriptionLabel)}</th>
                <th>${escapeHtml(localeCopy.qtyLabel)}</th>
                <th>${escapeHtml(localeCopy.unitPriceLabel)}</th>
                <th>${escapeHtml(template.tableAmountLabel)}</th>
              </tr>
            </thead>
            <tbody>
              ${itemRows}
            </tbody>
          </table>
        </div>

        <div class="summary-grid">
          <aside class="totals">
            <p class="totals-title">${escapeHtml(localeCopy.invoiceSummaryLabel)}</p>
            <p class="totals-row"><span>${escapeHtml(template.subtotalLabel)}:</span><strong>${money(
              input.subtotal
            )}</strong></p>
            <p class="totals-row"><span>${escapeHtml(template.taxLabel)} (7%):</span><strong>${money(
              input.tax
            )}</strong></p>
            <p class="totals-row totals-row-total"><span>${escapeHtml(
              template.totalLabel
            )}:</span><strong>${money(input.total)}</strong></p>
          </aside>
        </div>

        <div class="bottom-stack">
          <div class="service-grid">
            <section>
              <p class="service-title">${escapeHtml(localeCopy.paymentMethodsLabel)}</p>
              <p class="service-main">${escapeHtml(localeCopy.paymentMethodsInline)}</p>
              <p class="service-sub">${escapeHtml(paymentTerms)}</p>
            </section>
            <section>
              <p class="service-title">${escapeHtml(template.notesLabel)}</p>
              <p class="service-main">${escapeHtml(notesDisplay)}</p>
              <p class="service-sub">${escapeHtml(thankYouNote)}</p>
            </section>
          </div>

          <footer class="footer">
            <div class="footer-head">
              <div>
                <p class="payment-title">${escapeHtml(localeCopy.paymentMethodLabel)}</p>
                <p class="payment-line">${escapeHtml(localeCopy.paymentMethodLine)}</p>
                <p class="payment-line">${escapeHtml(localeCopy.paymentAcceptLine)}</p>
              </div>
              <div class="owner-box">
                <p class="owner-name">Luis Acosta</p>
                <p class="owner-role">${escapeHtml(localeCopy.ownerRoleLabel)}</p>
              </div>
            </div>
          </footer>
        </div>
      </section>

      ${watermark}
    </article>
  </body>
</html>`;
}

export function renderInvoiceTemplatePreview(
  template: InvoiceTemplateConfig,
  theme: InvoiceTemplateTheme
) {
  const items = [
    { label: "Weekly cleaning", quantity: 1, unitPrice: 125, amount: 125 },
    { label: "Chemicals and supplies", quantity: 2, unitPrice: 24.25, amount: 48.5 },
  ];
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const tax = subtotal * 0.07;
  const total = subtotal + tax;
  return renderInvoiceTemplateHtml({
    template,
    theme,
    locale: "EN",
    invoiceNumber: "INV-2026-1042",
    issueDateLabel: "03/03/2026",
    customerName: "Sample Customer",
    customerAddress: "123 Palm Ave, Miami, FL 33101",
    customerEmail: "customer@example.com",
    customerPhone: "+1 (786) 555-0199",
    items,
    subtotal,
    tax,
    total,
    notes: "Service completed and balanced. Thank you for trusting us.",
  });
}
