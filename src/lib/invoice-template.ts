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
      brandHex: "#0d3b56",
      accentHex: "#0e7aa6",
      lightHex: "#f3f8fc",
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
    .replace(/"/g, "&quot;");
}

export function renderInvoiceTemplatePreview(
  template: InvoiceTemplateConfig,
  theme: InvoiceTemplateTheme
) {
  const resolvedTheme = template.themes[theme];
  const items = [
    { label: "Weekly cleaning", quantity: 1, unitPrice: 125, amount: 125 },
    { label: "Chemicals and supplies", quantity: 2, unitPrice: 24.25, amount: 48.5 },
  ];
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const tax = subtotal * 0.07;
  const total = subtotal + tax;

  const itemRows = items
    .map(
      (item, index) => `<tr>
  <td style="text-align:center;">${index + 1}</td>
  <td>${escapeHtml(item.label)}</td>
  <td style="text-align:center;">${item.quantity}</td>
  <td style="text-align:right;">$${item.unitPrice.toFixed(2)}</td>
  <td style="text-align:right;">$${item.amount.toFixed(2)}</td>
</tr>`
    )
    .join("");

  const billToLines = [
    "Sample Customer",
    "123 Palm Ave, Miami, FL 33101",
    "customer@example.com",
    "+1 (786) 555-0199",
  ];
  const issuedByLines = [
    template.companyName,
    [template.companyAddressLine1, template.companyAddressLine2]
      .map((line) => line.trim())
      .filter(Boolean)
      .join(", "),
    template.companyEmail,
    template.companyPhone,
  ].filter(Boolean);

  const watermark =
    theme === "ESTIMATE" &&
    template.showEstimateWatermark &&
    resolvedTheme.watermarkText
      ? `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;">
          <span style="font:700 66px/1.1 Arial,sans-serif;opacity:.08;transform:rotate(-14deg);color:${resolvedTheme.brandHex};">
            ${escapeHtml(resolvedTheme.watermarkText)}
          </span>
        </div>`
      : "";

  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#e9eef5;font-family:Arial,sans-serif;color:#0f172a;">
    <article style="position:relative;max-width:880px;margin:0 auto;border:1px solid #d6e0ec;border-radius:18px;overflow:hidden;background:#ffffff;box-shadow:0 14px 28px rgba(15,23,42,.12);">
      <header style="background:${resolvedTheme.brandHex};padding:24px 28px 26px;border-bottom:6px solid ${resolvedTheme.accentHex};">
        <div style="display:flex;justify-content:space-between;gap:24px;align-items:flex-start;">
          <div>
            <img src="/h-logo.png" alt="AcostasPool" style="display:block;max-width:190px;height:auto;" />
          </div>
          <div style="text-align:right;">
            <p style="margin:0;color:#ffffff;font:700 28px/1.05 Arial,sans-serif;">${escapeHtml(
              resolvedTheme.label
            )}</p>
            <p style="margin:6px 0 0;color:#dbe7f3;font-size:12px;">${escapeHtml(
              template.invoiceNumberLabel
            )}: INV-2026-1042</p>
            <p style="margin:4px 0 0;color:#dbe7f3;font-size:12px;">${escapeHtml(
              template.issueDateLabel
            )}: 03/03/2026</p>
          </div>
        </div>
      </header>
      <section style="padding:20px 28px 22px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
          <div style="border:1px solid #dde6f2;border-radius:12px;background:#f9fcff;padding:12px 13px;">
            <p style="margin:0;font:700 11px/1.2 Arial,sans-serif;color:#5f6f81;text-transform:uppercase;letter-spacing:.09em;">${escapeHtml(
              template.billToLabel
            )}</p>
            ${billToLines
              .map((line, index) =>
                index === 0
                  ? `<p style="margin:${index === 0 ? "10px" : "6px"} 0 0;font:700 15px/1.25 Arial,sans-serif;color:#0f172a;">${escapeHtml(line)}</p>`
                  : `<p style="margin:6px 0 0;color:#475569;font-size:13px;">${escapeHtml(line)}</p>`
              )
              .join("")}
          </div>
          <div style="border:1px solid #dde6f2;border-radius:12px;background:#f9fcff;padding:12px 13px;">
            <p style="margin:0;font:700 11px/1.2 Arial,sans-serif;color:#5f6f81;text-transform:uppercase;letter-spacing:.09em;">Issued By</p>
            ${issuedByLines
              .map((line, index) =>
                index === 0
                  ? `<p style="margin:${index === 0 ? "10px" : "6px"} 0 0;font:700 15px/1.25 Arial,sans-serif;color:#0f172a;">${escapeHtml(line)}</p>`
                  : `<p style="margin:6px 0 0;color:#475569;font-size:13px;">${escapeHtml(line)}</p>`
              )
              .join("")}
          </div>
        </div>

        <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:13px;">
          <thead>
            <tr style="background:${resolvedTheme.lightHex};border:1px solid #dbe5f0;">
              <th style="text-align:center;padding:10px 8px;color:${resolvedTheme.brandHex};font-weight:700;border:1px solid #dbe5f0;width:42px;">#</th>
              <th style="text-align:left;padding:10px 12px;color:${resolvedTheme.brandHex};font-weight:700;border:1px solid #dbe5f0;">${escapeHtml(
                template.tableDescriptionLabel
              )}</th>
              <th style="text-align:center;padding:10px 8px;color:${resolvedTheme.brandHex};font-weight:700;border:1px solid #dbe5f0;width:64px;">Qty</th>
              <th style="text-align:right;padding:10px 12px;color:${resolvedTheme.brandHex};font-weight:700;border:1px solid #dbe5f0;width:120px;">Unit Price</th>
              <th style="text-align:right;padding:10px 12px;color:${resolvedTheme.brandHex};font-weight:700;border:1px solid #dbe5f0;width:120px;">${escapeHtml(
                template.tableAmountLabel
              )}</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows}
          </tbody>
        </table>

        <div style="margin-top:16px;display:grid;justify-content:end;">
          <p style="margin:0;color:#475569;font-size:13px;">${escapeHtml(template.subtotalLabel)}: <strong>$${subtotal.toFixed(2)}</strong></p>
          <p style="margin:7px 0 0;color:#475569;font-size:13px;">${escapeHtml(template.taxLabel)} (7%): <strong>$${tax.toFixed(2)}</strong></p>
          <p style="margin:9px 0 0;color:${resolvedTheme.brandHex};font:700 16px/1.2 Arial,sans-serif;">${escapeHtml(template.totalLabel)}: $${total.toFixed(2)}</p>
        </div>

        <div style="margin-top:16px;display:grid;grid-template-columns:1fr 1fr;gap:14px;">
          <div style="padding:12px 14px;border-radius:12px;background:#f8fbff;border:1px solid #dde6f2;">
            <p style="margin:0 0 6px;color:#5f6f81;font:700 12px/1.2 Arial,sans-serif;text-transform:uppercase;letter-spacing:.08em;">Payment Method</p>
            <p style="margin:0;color:#0f172a;font-size:13px;">Credit | Debit | ACH | Check</p>
            <p style="margin:6px 0 0;color:#64748b;font-size:12px;">We accept: Visa, MasterCard, Zelle and Cash</p>
          </div>
          <div style="padding:12px 14px;border-radius:12px;background:#f8fbff;border:1px solid #dde6f2;">
            <p style="margin:0 0 6px;color:#5f6f81;font:700 12px/1.2 Arial,sans-serif;text-transform:uppercase;letter-spacing:.08em;">${escapeHtml(
              template.notesLabel
            )}</p>
            <p style="margin:0;color:#64748b;font-size:13px;">Service completed and balanced. Thank you for trusting us.</p>
          </div>
        </div>
      </section>
      <footer style="padding:14px 28px;border-top:1px solid #dbe5f0;background:#f8fafc;color:#64748b;font-size:12px;">
        <p style="margin:0 0 6px;font-size:12px;color:#5c6e83;">${escapeHtml(template.footerNote)}</p>
        <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#718096;">${escapeHtml(
          template.clausesTitle
        )}</p>
        ${template.legalClauses
          .map(
            (clause) =>
              `<p style="margin:0 0 2px;font-size:9px;line-height:1.4;color:#8a97a8;">${escapeHtml(
                clause
              )}</p>`
          )
          .join("")}
      </footer>
      ${watermark}
    </article>
  </body>
</html>`;
}
