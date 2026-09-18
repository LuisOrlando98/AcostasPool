import { readdir, stat } from "fs/promises";
import path from "path";
import { isPrivateAssetKey } from "@/lib/storage/asset-keys";

/**
 * Driver local con dos raíces.
 *
 * - Raíz privada (`STORAGE_LOCAL_DIR`, por defecto `<cwd>/storage/private`):
 *   destino de escritura de facturas, documentos, fotos de trabajos y
 *   repositorio de clientes. Queda fuera de `public/`, así que Next ya no los
 *   sirve como estáticos y solo se alcanzan por `/api/files`.
 * - Raíz pública (`<cwd>/public`): avatares y cualquier clave no clasificada,
 *   y además los archivos históricos privados que ya viven en
 *   `public/uploads` y `public/invoices`. Se conserva como lectura de
 *   compatibilidad para no migrar datos.
 *
 * Las lecturas prueban primero la raíz privada y caen a la pública; las
 * escrituras van siempre a la raíz que corresponde a la clase de la clave.
 */

const DEFAULT_PRIVATE_DIR = path.join("storage", "private");
const PUBLIC_DIR = "public";

export type LocalFileEntry = {
  key: string;
  size: number | null;
  lastModified: string | null;
};

export function getPrivateStorageRoot() {
  const configured = process.env.STORAGE_LOCAL_DIR?.trim();
  if (configured) {
    return path.isAbsolute(configured)
      ? configured
      : path.join(process.cwd(), configured);
  }
  return path.join(process.cwd(), DEFAULT_PRIVATE_DIR);
}

export function getPublicStorageRoot() {
  return path.join(process.cwd(), PUBLIC_DIR);
}

/**
 * Une raíz y clave verificando que el resultado no se escape de la raíz.
 * `normalizeStorageKey` ya rechaza segmentos `.`/`..`; esto es defensa en
 * profundidad frente a claves construidas por otras rutas.
 */
function resolveWithinRoot(root: string, key: string) {
  const resolvedRoot = path.resolve(root);
  const target = path.resolve(resolvedRoot, ...key.split("/").filter(Boolean));
  if (target !== resolvedRoot && !target.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error("Invalid storage path");
  }
  return target;
}

/** Raíz de escritura: privada para recursos con control de acceso. */
export function resolveLocalWritePath(key: string) {
  const root = isPrivateAssetKey(key) ? getPrivateStorageRoot() : getPublicStorageRoot();
  return resolveWithinRoot(root, key);
}

/** Rutas candidatas en orden de preferencia (privada primero, pública legacy después). */
export function resolveLocalCandidates(key: string): string[] {
  if (!isPrivateAssetKey(key)) {
    return [resolveWithinRoot(getPublicStorageRoot(), key)];
  }
  return [
    resolveWithinRoot(getPrivateStorageRoot(), key),
    resolveWithinRoot(getPublicStorageRoot(), key),
  ];
}

export async function localPathExists(absolutePath: string) {
  try {
    await stat(absolutePath);
    return true;
  } catch {
    return false;
  }
}

/** Primera ruta existente entre las candidatas, o null si el archivo no está. */
export async function findExistingLocalPath(key: string) {
  const candidates = resolveLocalCandidates(key);
  for (const candidate of candidates) {
    if (await localPathExists(candidate)) {
      return candidate;
    }
  }
  return null;
}

async function walkLocalFiles(
  rootPath: string,
  storagePrefix: string
): Promise<LocalFileEntry[]> {
  const entries = await readdir(rootPath, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry): Promise<LocalFileEntry[]> => {
      const absolute = path.join(rootPath, entry.name);
      if (entry.isDirectory()) {
        return walkLocalFiles(absolute, `${storagePrefix}${entry.name}/`);
      }
      if (!entry.isFile()) {
        return [];
      }
      const info = await stat(absolute);
      return [
        {
          key: `${storagePrefix}${entry.name}`,
          size: Number.isFinite(info.size) ? info.size : null,
          lastModified: info.mtime ? info.mtime.toISOString() : null,
        },
      ];
    })
  );
  return nested.flat();
}

/**
 * Lista un prefijo uniendo ambas raíces. Si una clave existe en las dos, gana la
 * privada (es la copia vigente tras una reescritura).
 */
export async function listLocalFiles(prefix: string): Promise<LocalFileEntry[]> {
  const roots = resolveLocalCandidates(prefix);
  const perRoot = await Promise.all(
    roots.map(async (root) => {
      if (!(await localPathExists(root))) {
        return [];
      }
      return walkLocalFiles(root, prefix);
    })
  );

  const byKey = new Map<string, LocalFileEntry>();
  for (const entry of perRoot.flat()) {
    if (!byKey.has(entry.key)) {
      byKey.set(entry.key, entry);
    }
  }
  return [...byKey.values()];
}
