import { hasDotSegment } from "@/lib/storage/paths";

/**
 * Clasificación pura de claves de almacenamiento.
 *
 * Este módulo no importa Node ni Prisma a propósito: lo comparten el bundle de
 * cliente (`getAssetUrl`), el object-store y la ruta `/api/files`, de modo que
 * exista una única definición de "qué es cada archivo" y "quién es su dueño
 * según la ruta".
 *
 * Formatos históricos que deben seguir funcionando (ver README de la revisión):
 * - Ruta relativa del driver local: `/invoices/2026/09/<customerId>/INV-1.pdf`
 * - URL absoluta S3 virtual-hosted: `https://<bucket>.s3.<region>.amazonaws.com/<key>`
 * - URL absoluta de CDN: `<NEXT_PUBLIC_CDN_URL>/<key>`
 * - URL absoluta path-style: `https://s3.amazonaws.com/<bucket>/<key>`
 */

export const ASSET_RESOURCE_CLASSES = [
  "invoice",
  "job-photo",
  "customer-document",
  "repository",
  "avatar",
  "unknown",
] as const;

export type AssetResourceClass = (typeof ASSET_RESOURCE_CLASSES)[number];

export type AssetKeyInfo = {
  /** Clase de recurso deducida de la forma de la clave. */
  resource: AssetResourceClass;
  /** Clave normalizada (sin barra inicial, sin host, sin bucket). */
  key: string;
  /** Customer dueño según la ruta, cuando la ruta lo codifica. */
  customerId: string | null;
  /** Job dueño según la ruta legacy `uploads/jobs/<jobId>/...`. */
  jobId: string | null;
};

const ASSET_API_BASE = "/api/files";
const AVATAR_PREFIX = "avatars/";
const INVOICE_PREFIX = "invoices/";
const CUSTOMERS_PREFIX = "uploads/customers/";
const LEGACY_JOBS_PREFIX = "uploads/jobs/";
const REPOSITORY_SEGMENT = "repository";
const DOCUMENTS_SEGMENT = "documents";
const REPOSITORY_JOB_PHOTO_PREFIX = "files/jobs/";
const INVOICE_SEGMENT_COUNT = 5;
const INVOICE_CUSTOMER_SEGMENT_INDEX = 3;
const CUSTOMER_SEGMENT_INDEX = 2;
const CUSTOMER_KIND_SEGMENT_INDEX = 3;
const LEGACY_JOB_SEGMENT_INDEX = 2;
/** `uploads/customers/<id>/<kind>`: minimo para saber de quien es y de que tipo. */
const MIN_CUSTOMER_KIND_SEGMENTS = 4;

function readConfiguredBucket() {
  // En el bundle de cliente `process.env` solo contiene NEXT_PUBLIC_*, así que
  // esta lectura devuelve undefined en el navegador sin romper nada.
  return process.env.AWS_S3_BUCKET?.trim() ?? "";
}

/**
 * Convierte cualquier valor histórico (ruta relativa o URL absoluta) en la clave
 * de almacenamiento canónica. Lanza igual que la normalización original del
 * object-store para no cambiar el contrato de los llamantes existentes.
 */
export function normalizeStorageKey(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("Storage path is required");
  }

  const withoutHost =
    trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? new URL(trimmed).pathname
      : trimmed;

  const slashed = withoutHost.replace(/\\/g, "/").replace(/^\/+/, "");
  const bucket = readConfiguredBucket();
  const withoutBucket =
    bucket && slashed.startsWith(`${bucket}/`)
      ? slashed.slice(bucket.length + 1)
      : slashed;

  if (!withoutBucket || hasDotSegment(withoutBucket)) {
    throw new Error("Invalid storage path");
  }
  return withoutBucket;
}

/** Variante no lanzadora para contextos de UI, donde un valor inválido es "sin archivo". */
export function toStorageKey(value?: string | null) {
  if (!value) {
    return null;
  }
  try {
    return normalizeStorageKey(value);
  } catch {
    return null;
  }
}

function buildInfo(
  resource: AssetResourceClass,
  key: string,
  owners?: { customerId?: string | null; jobId?: string | null }
): AssetKeyInfo {
  return {
    resource,
    key,
    customerId: owners?.customerId ?? null,
    jobId: owners?.jobId ?? null,
  };
}

function classifyCustomerKey(key: string, segments: readonly string[]): AssetKeyInfo {
  const customerId = segments[CUSTOMER_SEGMENT_INDEX] ?? "";
  const kind = segments[CUSTOMER_KIND_SEGMENT_INDEX] ?? "";
  if (!customerId || segments.length < MIN_CUSTOMER_KIND_SEGMENTS) {
    return buildInfo("unknown", key);
  }

  if (kind === DOCUMENTS_SEGMENT) {
    return buildInfo("customer-document", key, { customerId });
  }

  if (kind !== REPOSITORY_SEGMENT) {
    return buildInfo("unknown", key);
  }

  const repositoryPath = segments.slice(CUSTOMER_KIND_SEGMENT_INDEX + 1).join("/");
  if (repositoryPath.startsWith(REPOSITORY_JOB_PHOTO_PREFIX)) {
    return buildInfo("job-photo", key, { customerId });
  }
  return buildInfo("repository", key, { customerId });
}

/** Deduce clase y dueño a partir de la forma de la clave. Nunca consulta la BD. */
export function classifyAssetKey(key: string): AssetKeyInfo {
  if (key.startsWith(AVATAR_PREFIX)) {
    return buildInfo("avatar", key);
  }

  const segments = key.split("/").filter(Boolean);

  if (key.startsWith(INVOICE_PREFIX)) {
    const customerId =
      segments.length === INVOICE_SEGMENT_COUNT
        ? (segments[INVOICE_CUSTOMER_SEGMENT_INDEX] ?? null)
        : null;
    return buildInfo("invoice", key, { customerId });
  }

  if (key.startsWith(LEGACY_JOBS_PREFIX)) {
    const jobId = segments[LEGACY_JOB_SEGMENT_INDEX] ?? "";
    return jobId ? buildInfo("job-photo", key, { jobId }) : buildInfo("unknown", key);
  }

  if (key.startsWith(CUSTOMERS_PREFIX)) {
    return classifyCustomerKey(key, segments);
  }

  return buildInfo("unknown", key);
}

/**
 * true para los recursos que exigen autorización: facturas, documentos, fotos de
 * trabajos y repositorio de clientes. Los avatares siguen siendo públicos
 * (baja sensibilidad) y las claves desconocidas se tratan como estáticos actuales.
 */
export function isPrivateAssetKey(key: string) {
  const { resource } = classifyAssetKey(key);
  return resource !== "avatar" && resource !== "unknown";
}

/** Ruta de la API autenticada que sirve una clave privada. */
export function buildAssetApiPath(key: string) {
  const encoded = key
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${ASSET_API_BASE}/${encoded}`;
}

/** Nombre de archivo sugerido para Content-Disposition. */
export function getAssetFileName(key: string) {
  return key.split("/").filter(Boolean).pop() ?? "download";
}
