const SAFE_SEGMENT_PATTERN = /[^a-zA-Z0-9-_]/g;
const SAFE_FILE_BASENAME_PATTERN = /[^a-zA-Z0-9-_.]/g;

function sanitizeSegment(value: string, fallback: string) {
  const normalized = value.trim().replace(SAFE_SEGMENT_PATTERN, "_");
  return normalized || fallback;
}

function toYearMonth(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}/${month}`;
}

function buildFileName(originalName: string, now: Date) {
  const safeBaseName = originalName
    .trim()
    .replace(SAFE_FILE_BASENAME_PATTERN, "_")
    .replace(/^_+|_+$/g, "");
  const fallback = `${now.getTime()}`;
  return `${now.getTime()}-${safeBaseName || fallback}`;
}

export function buildAvatarAssetPath(userId: string, originalName: string) {
  const now = new Date();
  return `uploads/avatars/${sanitizeSegment(userId, "user")}/${toYearMonth(now)}/${buildFileName(originalName, now)}`;
}

export function buildJobPhotoAssetPath(jobId: string, originalName: string) {
  const now = new Date();
  return `uploads/jobs/${sanitizeSegment(jobId, "job")}/${toYearMonth(now)}/${buildFileName(originalName, now)}`;
}

export function buildInvoicePdfAssetPath(
  customerId: string,
  invoiceNumber: string,
  issueDate: Date
) {
  const safeCustomer = sanitizeSegment(customerId, "customer");
  const safeInvoice = sanitizeSegment(invoiceNumber, "invoice");
  return `invoices/${toYearMonth(issueDate)}/${safeCustomer}/${safeInvoice}.pdf`;
}
