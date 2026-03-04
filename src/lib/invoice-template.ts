export type InvoiceTemplateTheme = "STANDARD" | "SPECIAL" | "ESTIMATE";

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

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

export const DEFAULT_INVOICE_TEMPLATE: InvoiceTemplateConfig = {
  companyName: "ACOSTASPOOL",
  companyPhone: "+1 (305) 555-0199",
  companyEmail: "support@acostaspool.com",
  companyWebsite: "www.acostaspool.com",
  companyAddressLine1: "Miami, Florida",
  companyAddressLine2: "United States",
  companyTaxId: "Tax ID: 00-0000000",
  headerSubtitle: "Service Administration System",
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
      brandHex: "#2F4A88",
      accentHex: "#8FA5D4",
      lightHex: "#EEF2FB",
      watermarkText: "",
    },
    SPECIAL: {
      label: "SPECIAL INVOICE",
      brandHex: "#2b1f14",
      accentHex: "#d2a640",
      lightHex: "#fcf7ec",
      watermarkText: "",
    },
    ESTIMATE: {
      label: "ESTIMATE",
      brandHex: "#4b5966",
      accentHex: "#728396",
      lightHex: "#f3f6f9",
      watermarkText: "ESTIMATE",
    },
  },
};

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

function money(value: number) {
  return `$${value.toFixed(2)}`;
}

export function renderInvoiceTemplateHtml(input: InvoiceTemplateRenderInput) {
  const { template, theme } = input;
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
  <td colspan="5" class="empty-row">No line items</td>
</tr>`;

  const watermark =
    theme === "ESTIMATE" &&
    template.showEstimateWatermark &&
    resolvedTheme.watermarkText
      ? `<div class="watermark">${escapeHtml(resolvedTheme.watermarkText)}</div>`
      : "";

  const notesContent = compactLine(input.notes) || compactLine(template.footerNote);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      @page {
        size: Letter;
        margin: 0;
      }

      :root {
        --brand: ${resolvedTheme.brandHex};
        --accent: ${resolvedTheme.accentHex};
        --light: ${resolvedTheme.lightHex};
        --paper: #ffffff;
        --soft: #f3f6fb;
        --line: #d9e3ef;
        --text: #0f1d2e;
        --muted: #4f637a;
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
        background: #e8edf4;
        color: var(--text);
        font-family: "Montserrat", "Segoe UI", "Helvetica Neue", Arial, sans-serif;
        -webkit-font-smoothing: antialiased;
        text-rendering: geometricPrecision;
      }

      .sheet {
        position: relative;
        width: 8.5in;
        min-height: 11in;
        margin: 0 auto;
        background: var(--paper);
        overflow: hidden;
      }

      .header {
        background: var(--brand);
        color: #ffffff;
        padding: 30px 46px 28px;
        border-bottom: 6px solid var(--accent);
      }

      .header-grid {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 24px;
        align-items: start;
      }

      .brand-lockup {
        width: 320px;
        text-align: center;
      }

      .brand-word {
        margin: 0;
        font-weight: 800;
        font-size: 62px;
        letter-spacing: 0.03em;
        line-height: 0.9;
        text-transform: uppercase;
      }

      .brand-word + .brand-word {
        margin-top: 2px;
      }

      .brand-rule {
        margin-top: 11px;
        height: 6px;
        background: #ffffff;
      }

      .brand-subtitle {
        margin-top: 10px;
        font-size: 16px;
        letter-spacing: 0.26em;
        font-weight: 400;
        text-transform: uppercase;
      }

      .invoice-head {
        text-align: right;
      }

      .invoice-label {
        margin: 0;
        font-size: 44px;
        line-height: 1;
        letter-spacing: 0.03em;
        font-weight: 800;
        text-transform: uppercase;
      }

      .invoice-meta {
        margin-top: 10px;
        font-size: 16px;
        font-weight: 600;
        color: rgba(236, 245, 255, 0.98);
      }

      .invoice-meta p {
        margin: 0;
      }

      .invoice-body {
        padding: 24px 46px 30px;
      }

      .info-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
      }

      .info-card {
        border: 1px solid var(--line);
        border-radius: 12px;
        background: #f8fbff;
        padding: 14px 14px 13px;
      }

      .card-title {
        margin: 0;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.13em;
        text-transform: uppercase;
        color: var(--muted);
      }

      .card-line {
        margin: 7px 0 0;
        color: var(--muted);
        font-size: 13px;
        line-height: 1.32;
        word-break: break-word;
      }

      .card-line-strong {
        color: var(--text);
        font-size: 18px;
        line-height: 1.2;
        margin-top: 10px;
        font-weight: 700;
      }

      .items {
        width: 100%;
        border-collapse: collapse;
        margin-top: 16px;
        font-size: 13px;
      }

      .items thead tr {
        background: var(--light);
      }

      .items th {
        border: 1px solid var(--line);
        color: var(--brand);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        font-size: 11px;
        font-weight: 800;
        padding: 9px 10px;
      }

      .items td {
        border-bottom: 1px solid #e8eef5;
        padding: 10px 10px;
        font-size: 13px;
      }

      .col-index {
        width: 42px;
        text-align: center;
      }

      .col-description {
        width: auto;
      }

      .col-qty {
        width: 64px;
        text-align: center;
      }

      .col-money {
        width: 132px;
        text-align: right;
        white-space: nowrap;
      }

      .col-money-strong {
        font-weight: 700;
      }

      .empty-row {
        text-align: center;
        padding: 14px 12px;
        color: #6b7f96;
      }

      .totals {
        margin-top: 14px;
        margin-left: auto;
        width: 270px;
        font-size: 14px;
      }

      .totals-row {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin: 0;
        color: var(--muted);
      }

      .totals-row + .totals-row {
        margin-top: 7px;
      }

      .totals-row strong {
        color: var(--text);
        font-weight: 700;
      }

      .totals-row-total {
        margin-top: 11px;
        font-size: 31px;
        font-weight: 800;
        color: var(--brand);
      }

      .totals-row-total strong {
        color: var(--brand);
        font-size: 35px;
        letter-spacing: 0.02em;
      }

      .detail-grid {
        margin-top: 16px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
      }

      .detail-card {
        border: 1px solid var(--line);
        border-radius: 12px;
        background: #f8fbff;
        padding: 12px 14px;
      }

      .detail-title {
        margin: 0;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--muted);
      }

      .detail-main {
        margin: 7px 0 0;
        font-size: 13px;
        color: var(--text);
        line-height: 1.35;
      }

      .detail-sub {
        margin: 6px 0 0;
        font-size: 12px;
        color: #61768d;
        line-height: 1.35;
      }

      .footer {
        margin-top: 26px;
        border-top: 1px solid var(--line);
        padding-top: 12px;
      }

      .footer-title {
        margin: 0;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--muted);
      }

      .footer-line {
        margin: 4px 0 0;
        font-size: 10.5px;
        line-height: 1.4;
        color: #60748a;
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
        color: rgba(255, 255, 255, 0.65);
        text-shadow: 0 0 1px rgba(70, 83, 98, 0.2);
        transform: rotate(-14deg);
      }
    </style>
  </head>
  <body>
    <article class="sheet">
      <header class="header">
        <div class="header-grid">
          <div class="brand-lockup">
            <p class="brand-word">Acosta&#39;s</p>
            <p class="brand-word">Pool</p>
            <div class="brand-rule"></div>
            <p class="brand-subtitle">Repair And Maintenance</p>
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
          <section class="info-card">
            <p class="card-title">${escapeHtml(template.billToLabel)}</p>
            ${customerLines
              .map((line, index) =>
                index === 0
                  ? `<p class="card-line card-line-strong">${escapeHtml(line)}</p>`
                  : `<p class="card-line">${escapeHtml(line)}</p>`
              )
              .join("")}
          </section>
          <section class="info-card">
            <p class="card-title">Issued By</p>
            ${issuedByLines
              .map((line, index) =>
                index === 0
                  ? `<p class="card-line card-line-strong">${escapeHtml(line)}</p>`
                  : `<p class="card-line">${escapeHtml(line)}</p>`
              )
              .join("")}
          </section>
        </div>

        <table class="items">
          <thead>
            <tr>
              <th>#</th>
              <th>${escapeHtml(template.tableDescriptionLabel)}</th>
              <th>Qty</th>
              <th>Unit Price</th>
              <th>${escapeHtml(template.tableAmountLabel)}</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows}
          </tbody>
        </table>

        <div class="totals">
          <p class="totals-row"><span>${escapeHtml(template.subtotalLabel)}:</span><strong>${money(
            input.subtotal
          )}</strong></p>
          <p class="totals-row"><span>${escapeHtml(template.taxLabel)} (7%):</span><strong>${money(
            input.tax
          )}</strong></p>
          <p class="totals-row totals-row-total"><span>${escapeHtml(
            template.totalLabel
          )}:</span><strong>${money(input.total)}</strong></p>
        </div>

        <div class="detail-grid">
          <section class="detail-card">
            <p class="detail-title">Payment Method</p>
            <p class="detail-main">Credit | Debit | ACH | Check</p>
            <p class="detail-sub">We accept: Visa, MasterCard, Zelle and Cash</p>
          </section>
          <section class="detail-card">
            <p class="detail-title">${escapeHtml(template.notesLabel)}</p>
            <p class="detail-main">${escapeHtml(notesContent)}</p>
          </section>
        </div>

        <footer class="footer">
          <p class="footer-title">${escapeHtml(template.clausesTitle)}</p>
          ${template.legalClauses
            .slice(0, 4)
            .map((clause) => `<p class="footer-line">${escapeHtml(clause)}</p>`)
            .join("")}
        </footer>
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
