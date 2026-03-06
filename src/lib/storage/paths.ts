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

function toCompactName(value: string, fallback: string) {
  const clean = value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");
  return clean || fallback;
}

export function buildTechJobPhotoFileName(input: {
  date: Date;
  customerName: string;
  technicianName: string;
  index: number;
}) {
  const { date, customerName, technicianName, index } = input;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  const customer = toCompactName(customerName, "Client");
  const techToken = technicianName.trim().split(/\s+/).filter(Boolean)[0] ?? "";
  const techFirstName = toCompactName(techToken || technicianName, "Tech");
  const base = `${day}-${month}-${year}_${customer}_tech${techFirstName}`;
  if (index <= 0) {
    return `${base}.jpg`;
  }
  return `${base}_${String(index + 1).padStart(2, "0")}.jpg`;
}

export function buildCustomerJobPhotoAssetPath(
  customerId: string,
  fileName: string,
  now = new Date()
) {
  const safeCustomer = sanitizeSegment(customerId, "customer");
  const safeFileName = fileName.replace(SAFE_FILE_BASENAME_PATTERN, "_");
  return `uploads/customers/${safeCustomer}/repository/files/jobs/${toYearMonth(now)}/${safeFileName}`;
}

export function buildCustomerJobPhotoRepositoryPrefix(
  customerId: string,
  now = new Date()
) {
  const safeCustomer = sanitizeSegment(customerId, "customer");
  return `uploads/customers/${safeCustomer}/repository/files/jobs/${toYearMonth(now)}/`;
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

export function buildCustomerDocumentAssetPath(
  customerId: string,
  originalName: string
) {
  const now = new Date();
  const safeCustomer = sanitizeSegment(customerId, "customer");
  const fileName = buildFileName(originalName, now);
  return `uploads/customers/${safeCustomer}/documents/${toYearMonth(now)}/${fileName}`;
}
