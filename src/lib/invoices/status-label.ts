import { INVOICE_STATUSES } from "@/lib/constants";

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

type TranslateKey = (key: string) => string;

export const INVOICE_STATUS_KEYS: Readonly<Record<InvoiceStatus, string>> = {
  DRAFT: "invoices.status.draft",
  SENT: "invoices.status.sent",
  PAID: "invoices.status.paid",
  OVERDUE: "invoices.status.overdue",
};

function isInvoiceStatus(value: string): value is InvoiceStatus {
  return (INVOICE_STATUSES as readonly string[]).includes(value);
}

/**
 * Etiqueta traducida de un estado de factura (`invoices.status.*`). Un estado
 * vacío devuelve "" y uno desconocido se muestra tal cual, como
 * `getJobStatusLabel`.
 */
export function getInvoiceStatusLabel(
  status: string | null | undefined,
  t: TranslateKey
): string {
  if (!status) {
    return "";
  }
  return isInvoiceStatus(status) ? t(INVOICE_STATUS_KEYS[status]) : status;
}
