import { escapeHtml, type EmailTemplateLocale } from "@/lib/email-templates";
import { formatInBusinessTimeZone } from "@/lib/timezone";

const INTL_LOCALE_BY_TEMPLATE_LOCALE: Record<EmailTemplateLocale, string> = {
  EN: "en-US",
  ES: "es-US",
};
/** Mismo formato que el correo inmediato de trabajo completado (api/jobs/[id]/photos). */
const DATE_TIME_LABEL_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};
/** Fecha de ruta de los digests: MM/dd/yyyy. */
const ROUTE_DATE_LABEL_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "2-digit",
  day: "2-digit",
  year: "numeric",
};
const DEFAULT_TEMPLATE_LOCALE: EmailTemplateLocale = "EN";
const ROUTE_DATE_LOCALE = INTL_LOCALE_BY_TEMPLATE_LOCALE.EN;

/** Nombre mostrado cuando el trabajo completado no tiene técnico ni el payload lo indica. */
export const DEFAULT_TECHNICIAN_NAME = "Equipo de servicio";

export function formatDateTimeLabel(
  date: Date,
  locale: EmailTemplateLocale = DEFAULT_TEMPLATE_LOCALE
): string {
  return formatInBusinessTimeZone(
    date,
    INTL_LOCALE_BY_TEMPLATE_LOCALE[locale],
    DATE_TIME_LABEL_OPTIONS
  );
}

export function formatRouteDateLabel(date: Date): string {
  return formatInBusinessTimeZone(date, ROUTE_DATE_LOCALE, ROUTE_DATE_LABEL_OPTIONS);
}

export function buildIndexedLinesText(lines: readonly string[]): string {
  return lines.map((line, index) => `${index + 1}. ${line}`).join("\n");
}

export function buildIndexedLinesHtml(lines: readonly string[]): string {
  return lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("");
}
