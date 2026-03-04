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
  <td colspan="5" class="empty-row">No line items</td>
</tr>`;

  const watermark =
    theme === "ESTIMATE" &&
    template.showEstimateWatermark &&
    resolvedTheme.watermarkText
      ? `<div class="watermark">${escapeHtml(resolvedTheme.watermarkText)}</div>`
      : "";

  const notesContent = compactLine(input.notes) || compactLine(template.footerNote);
  const clausesMarkup = template.legalClauses
    .slice(0, 6)
    .map((clause) => `<li>${escapeHtml(clause)}</li>`)
    .join("");

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
        --soft: #f4f7fd;
        --line: #d5deea;
        --line-strong: #b8c7db;
        --text: #0f1e30;
        --muted: #58708a;
        --ink: #20344c;
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
        background: #e2e8f2;
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

      .sheet::before {
        content: "";
        position: absolute;
        inset: 0;
        background:
          radial-gradient(circle at 90% -5%, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0) 34%),
          radial-gradient(circle at 8% 104%, rgba(48, 75, 136, 0.06) 0%, rgba(48, 75, 136, 0) 35%);
        pointer-events: none;
      }

      .header {
        background: linear-gradient(135deg, var(--brand) 0%, #263f74 100%);
        color: #ffffff;
        padding: 28px 44px 26px;
        border-bottom: 4px solid rgba(255, 255, 255, 0.92);
      }

      .header-grid {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 24px;
        align-items: start;
      }

      .brand-lockup {
        width: 336px;
        text-align: center;
      }

      .brand-word {
        margin: 0;
        font-weight: 800;
        font-size: 60px;
        letter-spacing: 0.024em;
        line-height: 0.9;
        text-transform: uppercase;
      }

      .brand-word + .brand-word {
        margin-top: 2px;
      }

      .brand-rule {
        margin-top: 10px;
        height: 5px;
        background: #ffffff;
      }

      .brand-subtitle {
        margin-top: 9px;
        font-size: 15px;
        letter-spacing: 0.24em;
        font-weight: 400;
        text-transform: uppercase;
      }

      .invoice-head {
        text-align: right;
      }

      .invoice-label {
        margin: 0;
        font-size: 42px;
        line-height: 1;
        letter-spacing: 0.03em;
        font-weight: 800;
        text-transform: uppercase;
      }

      .invoice-meta {
        margin-top: 11px;
        font-size: 14px;
        font-weight: 600;
        color: rgba(236, 245, 255, 0.98);
        display: grid;
        gap: 5px;
      }

      .invoice-meta p {
        margin: 0;
      }

      .invoice-body {
        position: relative;
        z-index: 1;
        padding: 22px 42px 30px;
      }

      .info-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }

      .info-card {
        border: 1px solid var(--line-strong);
        border-radius: 14px;
        background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
        padding: 13px 14px 14px;
      }

      .card-title {
        margin: 0;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.13em;
        text-transform: uppercase;
        color: var(--muted);
      }

      .card-line {
        margin: 6px 0 0;
        color: var(--muted);
        font-size: 12px;
        line-height: 1.32;
        word-break: break-word;
      }

      .card-line-strong {
        color: var(--ink);
        font-size: 17px;
        line-height: 1.2;
        margin-top: 9px;
        font-weight: 700;
      }

      .surface {
        margin-top: 14px;
        border: 1px solid var(--line);
        border-radius: 14px;
        overflow: hidden;
        background: #ffffff;
      }

      .items {
        width: 100%;
        border-collapse: collapse;
        margin: 0;
        font-size: 12px;
      }

      .items thead tr {
        background: linear-gradient(180deg, var(--light) 0%, #f7faff 100%);
      }

      .items th {
        border-bottom: 1px solid var(--line-strong);
        color: var(--brand);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        font-size: 11px;
        font-weight: 800;
        padding: 10px 10px;
      }

      .items td {
        border-bottom: 1px solid #e7eef7;
        padding: 10px 10px;
        font-size: 12px;
        color: var(--ink);
      }

      .items tbody tr:nth-child(even) td {
        background: #fbfdff;
      }

      .col-index {
        width: 42px;
        text-align: center;
      }

      .col-description {
        width: auto;
      }

      .col-qty {
        width: 68px;
        text-align: center;
      }

      .col-money {
        width: 120px;
        text-align: right;
        white-space: nowrap;
      }

      .col-money-strong {
        font-weight: 800;
      }

      .empty-row {
        text-align: center;
        padding: 14px 12px;
        color: #6f8299;
      }

      .finance-grid {
        margin-top: 14px;
        display: flex;
        justify-content: flex-end;
      }

      .totals {
        border: 1px solid var(--line-strong);
        border-radius: 14px;
        background: #fbfdff;
        padding: 12px 14px;
      }

      .totals-title {
        margin: 0 0 10px;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.12em;
        color: var(--muted);
        text-transform: uppercase;
      }

      .totals-row {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin: 0;
        color: var(--muted);
        font-size: 13px;
      }

      .totals-row + .totals-row {
        margin-top: 7px;
      }

      .totals-row strong {
        color: var(--ink);
        font-weight: 700;
      }

      .totals-row-total strong {
        color: var(--brand);
        font-size: 28px;
        letter-spacing: 0.01em;
        font-weight: 800;
      }

      .totals-row-total span {
        color: var(--brand);
        font-size: 22px;
        font-weight: 800;
      }

      .detail-grid {
        margin-top: 14px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }

      .detail-card {
        border: 1px solid var(--line-strong);
        border-radius: 14px;
        background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
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
        font-size: 12px;
        color: var(--ink);
        line-height: 1.35;
      }

      .detail-sub {
        margin: 5px 0 0;
        font-size: 11px;
        color: #61768d;
        line-height: 1.35;
      }

      .footer {
        margin-top: 16px;
        border-top: 1px solid var(--line);
        padding-top: 11px;
      }

      .footer-title {
        margin: 0;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--muted);
      }

      .footer-list {
        margin: 7px 0 0;
        padding-left: 18px;
      }

      .footer-list li {
        margin: 3px 0 0;
        font-size: 10px;
        line-height: 1.42;
        color: #60748a;
      }

      .signature-row {
        margin-top: 16px;
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 12px;
        align-items: end;
      }

      .signature-line {
        border-top: 1px solid #9fb0c6;
        padding-top: 4px;
        font-size: 10px;
        color: #5f738a;
      }

      .signature-issuer {
        text-align: right;
      }

      .signature-name {
        margin: 0;
        font-size: 12px;
        font-weight: 700;
        color: var(--ink);
      }

      .signature-role {
        margin: 2px 0 0;
        font-size: 10px;
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
        color: rgba(48, 75, 136, 0.13);
        text-shadow: 0 0 1px rgba(70, 83, 98, 0.05);
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

        <div class="surface">
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
        </div>

        <div class="finance-grid">
          <aside class="totals">
            <p class="totals-title">Invoice Summary</p>
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
          <ul class="footer-list">${clausesMarkup}</ul>

          <div class="signature-row">
            <div class="signature-line">Authorized signature</div>
            <div class="signature-issuer">
              <p class="signature-name">${escapeHtml(template.companyName)}</p>
              <p class="signature-role">Billing Team</p>
            </div>
          </div>
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
