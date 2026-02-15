const SAFE_SEGMENT_PATTERN = /[^a-zA-Z0-9-_]/g;
const SAFE_FILE_BASENAME_PATTERN = /[^a-zA-Z0-9-_.]/g;
const SAFE_FILE_EXTENSION_PATTERN = /[^a-zA-Z0-9]/g;

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

function slugifyName(value: string, fallback: string) {
  const normalized = value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || fallback;
}

function getFileExtension(originalName: string, fallback: string) {
  const extIndex = originalName.lastIndexOf(".");
  if (extIndex === -1) {
    return fallback;
  }
  const extension = originalName
    .slice(extIndex + 1)
    .toLowerCase()
    .replace(SAFE_FILE_EXTENSION_PATTERN, "");
  return extension || fallback;
}

function getAvatarRoleSegment(role: string) {
  if (role === "TECH") return "tech";
  if (role === "CUSTOMER") return "client";
  return "admin";
}

export function buildAvatarAssetPath(
  role: string,
  fullName: string,
  originalName: string
) {
  const now = new Date();
  const roleSegment = getAvatarRoleSegment(role);
  const baseName = slugifyName(fullName, "user");
  const extension = getFileExtension(originalName, "jpg");
  return `avatars/${roleSegment}/${baseName}-${now.getTime()}.${extension}`;
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
