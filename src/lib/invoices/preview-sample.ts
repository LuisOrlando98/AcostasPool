import type {
  InvoiceTemplateConfig,
  InvoiceTemplateLocale,
  InvoiceTemplateTheme,
} from "@/lib/invoice-template";
import type { InvoiceLineItem, InvoicePdfRenderInput } from "@/lib/invoices/pdf";

/** Route that streams the sample invoice PDF used by the settings preview. */
export const INVOICE_PREVIEW_ROUTE_PATH = "/api/admin/settings/invoice-preview";
/** Query parameter carrying the invoice theme to preview. */
export const INVOICE_PREVIEW_THEME_PARAM = "theme";

const DEFAULT_INVOICE_PREVIEW_THEME: InvoiceTemplateTheme = "STANDARD";
const INVOICE_PREVIEW_TAX_RATE = 0.07;
const INVOICE_PREVIEW_NUMBER = "INV-2026-1042";
const INVOICE_PREVIEW_ISSUE_DATE_ISO = "2026-03-03T00:00:00.000Z";
const INVOICE_PREVIEW_NOTES = "Service completed and balanced. Thank you for trusting us.";
const INVOICE_PREVIEW_CUSTOMER = {
  name: "Sample Customer",
  address: "123 Palm Ave, Miami, FL 33101",
  email: "customer@example.com",
  phone: "+1 (786) 555-0199",
} as const;
const INVOICE_PREVIEW_ITEMS: readonly InvoiceLineItem[] = [
  { label: "Weekly cleaning", quantity: 1, unitPrice: 125, amount: 125 },
  { label: "Chemicals and supplies", quantity: 2, unitPrice: 24.25, amount: 48.5 },
];

export type InvoicePreviewSampleOptions = {
  locale: InvoiceTemplateLocale;
  theme: InvoiceTemplateTheme;
  template: InvoiceTemplateConfig;
};

export function resolveInvoicePreviewTheme(
  value: string | null | undefined
): InvoiceTemplateTheme {
  if (value === "SPECIAL" || value === "ESTIMATE") {
    return value;
  }
  return DEFAULT_INVOICE_PREVIEW_THEME;
}

export function buildInvoicePreviewSample({
  locale,
  theme,
  template,
}: InvoicePreviewSampleOptions): InvoicePdfRenderInput {
  const items = INVOICE_PREVIEW_ITEMS.map((item) => ({ ...item }));
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const tax = subtotal * INVOICE_PREVIEW_TAX_RATE;

  return {
    invoiceNumber: INVOICE_PREVIEW_NUMBER,
    issueDate: new Date(INVOICE_PREVIEW_ISSUE_DATE_ISO),
    customerName: INVOICE_PREVIEW_CUSTOMER.name,
    customerAddress: INVOICE_PREVIEW_CUSTOMER.address,
    customerEmail: INVOICE_PREVIEW_CUSTOMER.email,
    customerPhone: INVOICE_PREVIEW_CUSTOMER.phone,
    items,
    subtotal,
    tax,
    total: subtotal + tax,
    notes: INVOICE_PREVIEW_NOTES,
    locale,
    theme,
    template,
  };
}
