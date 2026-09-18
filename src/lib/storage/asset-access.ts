import { prisma } from "@/lib/db";
import {
  classifyAssetKey,
  toStorageKey,
  type AssetKeyInfo,
  type AssetResourceClass,
} from "@/lib/storage/asset-keys";

/**
 * Autorización de descarga de archivos almacenados.
 *
 * Reglas (H1/H4 de la revisión de seguridad):
 * - ADMIN: todo recurso conocido.
 * - CUSTOMER: solo recursos de su propio `customerId`. Las facturas, los
 *   documentos y las fotos de trabajos se resuelven consultando la BD por el
 *   valor guardado (`Invoice.pdfUrl`, `CustomerDocument.fileUrl`,
 *   `JobPhoto.url`), porque ahí conviven rutas relativas históricas y URLs
 *   absolutas de S3/CDN. El repositorio se resuelve por prefijo de ruta.
 * - TECH: fotos de trabajos asignados a él, y su propio avatar.
 * - Avatares: cualquier usuario autenticado (baja sensibilidad, siguen siendo
 *   públicos en el CDN).
 */

export type AssetAccessSession = {
  sub: string;
  role: string;
};

export type AssetAccessReason =
  | "ok"
  | "invalid-key"
  | "unauthenticated"
  | "unknown-resource"
  | "forbidden";

export type AssetAccessDecision = {
  allowed: boolean;
  resource: AssetResourceClass;
  key: string;
  reason: AssetAccessReason;
};

const ADMIN_ROLE = "ADMIN";
const CUSTOMER_ROLE = "CUSTOMER";
const TECH_ROLE = "TECH";

function decide(
  allowed: boolean,
  info: Pick<AssetKeyInfo, "resource" | "key">,
  reason: AssetAccessReason
): AssetAccessDecision {
  return { allowed, resource: info.resource, key: info.key, reason };
}

/**
 * Coincide con el valor guardado en BD tanto si es la clave desnuda como si es
 * una ruta relativa (`/uploads/...`) o una URL absoluta de S3/CDN terminada en
 * esa clave.
 */
function storedValueMatchers(key: string) {
  return [{ equals: key }, { endsWith: `/${key}` }];
}

async function findInvoiceCustomerId(key: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { OR: storedValueMatchers(key).map((match) => ({ pdfUrl: match })) },
    select: { customerId: true },
  });
  return invoice?.customerId ?? null;
}

async function findDocumentCustomerId(key: string) {
  const document = await prisma.customerDocument.findFirst({
    where: { OR: storedValueMatchers(key).map((match) => ({ fileUrl: match })) },
    select: { customerId: true },
  });
  return document?.customerId ?? null;
}

type JobPhotoOwner = {
  customerId: string;
  technicianUserId: string | null;
  visibleToCustomer: boolean;
};

async function findJobPhotoOwner(info: AssetKeyInfo): Promise<JobPhotoOwner | null> {
  const photo = await prisma.jobPhoto.findFirst({
    where: { OR: storedValueMatchers(info.key).map((match) => ({ url: match })) },
    select: {
      visibleToCustomer: true,
      job: {
        select: {
          customerId: true,
          technician: { select: { userId: true } },
        },
      },
    },
  });
  if (photo) {
    return {
      customerId: photo.job.customerId,
      technicianUserId: photo.job.technician?.userId ?? null,
      visibleToCustomer: photo.visibleToCustomer,
    };
  }

  // Ruta legacy `uploads/jobs/<jobId>/...`: el archivo puede existir sin fila.
  if (!info.jobId) {
    return null;
  }
  const job = await prisma.job.findUnique({
    where: { id: info.jobId },
    select: { customerId: true, technician: { select: { userId: true } } },
  });
  if (!job) {
    return null;
  }
  return {
    customerId: job.customerId,
    technicianUserId: job.technician?.userId ?? null,
    visibleToCustomer: true,
  };
}

async function findCustomerIdForUser(userId: string) {
  const customer = await prisma.customer.findUnique({
    where: { userId },
    select: { id: true },
  });
  return customer?.id ?? null;
}

async function resolveCustomerAccess(
  session: AssetAccessSession,
  info: AssetKeyInfo
): Promise<AssetAccessDecision> {
  const customerId = await findCustomerIdForUser(session.sub);
  if (!customerId) {
    return decide(false, info, "forbidden");
  }

  if (info.resource === "repository") {
    return decide(info.customerId === customerId, info, "forbidden");
  }

  if (info.resource === "invoice") {
    const owner = await findInvoiceCustomerId(info.key);
    return decide(owner === customerId, info, "forbidden");
  }

  if (info.resource === "customer-document") {
    const owner = await findDocumentCustomerId(info.key);
    return decide(owner === customerId, info, "forbidden");
  }

  if (info.resource === "job-photo") {
    const owner = await findJobPhotoOwner(info);
    if (owner) {
      const allowed = owner.customerId === customerId && owner.visibleToCustomer;
      return decide(allowed, info, "forbidden");
    }
    // Sin fila en BD la foto sigue siendo un archivo del repositorio del cliente.
    return decide(info.customerId === customerId, info, "forbidden");
  }

  return decide(false, info, "forbidden");
}

async function resolveTechAccess(
  session: AssetAccessSession,
  info: AssetKeyInfo
): Promise<AssetAccessDecision> {
  if (info.resource !== "job-photo") {
    return decide(false, info, "forbidden");
  }
  const owner = await findJobPhotoOwner(info);
  if (!owner?.technicianUserId) {
    return decide(false, info, "forbidden");
  }
  return decide(owner.technicianUserId === session.sub, info, "forbidden");
}

/**
 * Decide si `session` puede descargar `rawKey`. Acepta la clave desnuda o
 * cualquiera de los formatos históricos guardados en BD.
 */
export async function resolveAssetAccess(
  session: AssetAccessSession | null,
  rawKey: string
): Promise<AssetAccessDecision> {
  const key = toStorageKey(rawKey);
  if (!key) {
    return { allowed: false, resource: "unknown", key: "", reason: "invalid-key" };
  }

  const info = classifyAssetKey(key);
  if (!session) {
    return decide(false, info, "unauthenticated");
  }
  if (info.resource === "unknown") {
    return decide(false, info, "unknown-resource");
  }
  if (info.resource === "avatar") {
    return decide(true, info, "ok");
  }
  if (session.role === ADMIN_ROLE) {
    return decide(true, info, "ok");
  }
  if (session.role === CUSTOMER_ROLE) {
    const decision = await resolveCustomerAccess(session, info);
    return decision.allowed ? decide(true, info, "ok") : decision;
  }
  if (session.role === TECH_ROLE) {
    const decision = await resolveTechAccess(session, info);
    return decision.allowed ? decide(true, info, "ok") : decision;
  }

  return decide(false, info, "forbidden");
}
