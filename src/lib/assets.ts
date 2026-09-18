import {
  buildAssetApiPath,
  isPrivateAssetKey,
  toStorageKey,
} from "@/lib/storage/asset-keys";

/**
 * URL con la que la UI abre un archivo almacenado.
 *
 * Los recursos con control de acceso (facturas, documentos de cliente, fotos de
 * trabajos y repositorio) se sirven por `/api/files/<key>`, que exige sesión y
 * autoriza por rol. Acepta los tres formatos que conviven en BD: clave desnuda,
 * ruta relativa (`/invoices/...`, `/uploads/...`) y URL absoluta de S3 o CDN; de
 * cualquiera de ellos extrae la clave, así que los datos históricos siguen
 * funcionando sin migración.
 *
 * Los avatares siguen siendo públicos: son de baja sensibilidad, se cachean de
 * forma agresiva y aparecen en cada render del shell, por lo que pasarlos por la
 * API solo añadiría latencia.
 */
export const getAssetUrl = (path?: string | null) => {
  if (!path) {
    return "";
  }

  const key = toStorageKey(path);
  if (key && isPrivateAssetKey(key)) {
    return buildAssetApiPath(key);
  }

  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const base = process.env.NEXT_PUBLIC_CDN_URL;
  if (!base) {
    return path;
  }
  const trimmedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${trimmedBase}${suffix}`;
};
