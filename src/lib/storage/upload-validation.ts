/**
 * Lista blanca de tipos aceptados en las subidas de administración
 * (repositorio de clientes y documentos de cliente).
 *
 * El criterio es de denegación por defecto: solo se aceptan las extensiones
 * listadas, el tipo declarado por el navegador nunca se usa para guardar (se
 * sustituye por el canónico de la extensión) y, cuando el formato tiene una
 * firma conocida, los primeros bytes tienen que coincidir. Así un `.svg`
 * renombrado a `.png` no entra, y un `.pdf` que en realidad es HTML tampoco.
 */

const MAGIC_PREFIX_LENGTH = 16;
const TEXT_SNIFF_LENGTH = 512;
const UNSUPPORTED_TYPE_STATUS = 415;

/**
 * Bytes que basta leer para validar un archivo. Permite comprobar el tipo antes
 * de cargar el archivo entero en memoria y antes de escribir nada.
 */
export const UPLOAD_SIGNATURE_SAMPLE_BYTES = TEXT_SNIFF_LENGTH;

const ALLOWED_CONTENT_TYPE_BY_EXTENSION: Readonly<Record<string, string>> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  csv: "text/csv",
  txt: "text/plain",
  zip: "application/zip",
};

const BLOCKED_CONTENT_TYPES: ReadonlySet<string> = new Set([
  "text/html",
  "application/xhtml+xml",
  "image/svg+xml",
  "application/xml",
  "text/xml",
  "application/javascript",
  "text/javascript",
  "application/ecmascript",
  "application/x-msdownload",
  "application/x-msdos-program",
  "application/x-sh",
  "application/x-httpd-php",
]);

const ALLOWED_EXTENSIONS_LABEL =
  "PDF, images (JPG, JPEG, PNG, WEBP, GIF, HEIC, HEIF), Office (DOC, DOCX, XLS, XLSX, PPT, PPTX), CSV, TXT, ZIP";

const HTML_LIKE_MARKERS = ["<!doctype", "<html", "<script", "<?xml", "<svg"] as const;

type SignatureCheck = (head: Buffer) => boolean;

const startsWithBytes = (bytes: readonly number[]): SignatureCheck => {
  return (head) => bytes.every((byte, index) => head[index] === byte);
};

const startsWithAscii = (prefixes: readonly string[]): SignatureCheck => {
  return (head) => prefixes.some((prefix) => head.toString("latin1").startsWith(prefix));
};

const ZIP_SIGNATURE = startsWithAscii(["PK", "PK", "PK"]);
const OLE_SIGNATURE = startsWithBytes([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

const ISO_BMFF_BRAND_OFFSET = 4;
const ISO_BMFF_BRAND_LENGTH = 8;
const HEIF_BRANDS: ReadonlySet<string> = new Set([
  "heic",
  "heix",
  "hevc",
  "hevx",
  "heim",
  "heis",
  "mif1",
  "msf1",
  "avif",
]);

const isHeifSignature: SignatureCheck = (head) => {
  const box = head
    .subarray(ISO_BMFF_BRAND_OFFSET, ISO_BMFF_BRAND_OFFSET + ISO_BMFF_BRAND_LENGTH)
    .toString("latin1");
  if (!box.startsWith("ftyp")) {
    return false;
  }
  return HEIF_BRANDS.has(box.slice(4, 8));
};

const isWebpSignature: SignatureCheck = (head) => {
  const text = head.toString("latin1");
  return text.startsWith("RIFF") && text.slice(8, 12) === "WEBP";
};

const SIGNATURE_BY_EXTENSION: Readonly<Record<string, SignatureCheck>> = {
  pdf: startsWithAscii(["%PDF"]),
  jpg: startsWithBytes([0xff, 0xd8, 0xff]),
  jpeg: startsWithBytes([0xff, 0xd8, 0xff]),
  png: startsWithBytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  gif: startsWithAscii(["GIF87a", "GIF89a"]),
  webp: isWebpSignature,
  heic: isHeifSignature,
  heif: isHeifSignature,
  zip: ZIP_SIGNATURE,
  docx: ZIP_SIGNATURE,
  xlsx: ZIP_SIGNATURE,
  pptx: ZIP_SIGNATURE,
  doc: OLE_SIGNATURE,
  xls: OLE_SIGNATURE,
  ppt: OLE_SIGNATURE,
};

/** Extensiones de texto plano: sin firma, pero no pueden contener marcado activo. */
const TEXT_EXTENSIONS: ReadonlySet<string> = new Set(["csv", "txt"]);

export type UploadValidationResult =
  | { ok: true; extension: string; contentType: string }
  | { ok: false; status: number; error: string };

export function getUploadFileExtension(fileName: string) {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex <= 0) {
    return "";
  }
  return fileName
    .slice(dotIndex + 1)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function unsupported(fileName: string, extension: string): UploadValidationResult {
  const shown = extension ? `.${extension}` : "without extension";
  return {
    ok: false,
    status: UNSUPPORTED_TYPE_STATUS,
    error: `File "${fileName}" has an unsupported type (${shown}). Allowed: ${ALLOWED_EXTENSIONS_LABEL}.`,
  };
}

function mismatched(fileName: string, extension: string): UploadValidationResult {
  return {
    ok: false,
    status: UNSUPPORTED_TYPE_STATUS,
    error: `File "${fileName}" does not match its extension (.${extension}). Upload the original file.`,
  };
}

function looksLikeMarkup(bytes: Buffer) {
  const head = bytes.subarray(0, TEXT_SNIFF_LENGTH).toString("utf8").trimStart().toLowerCase();
  return HTML_LIKE_MARKERS.some((marker) => head.startsWith(marker));
}

/**
 * Valida nombre, tipo declarado y bytes. `bytes` puede ser solo la cabecera del
 * archivo (`UPLOAD_SIGNATURE_SAMPLE_BYTES`). Devuelve el content-type canónico
 * con el que debe guardarse (nunca el declarado por el cliente).
 */
export function validateUploadFile(input: {
  fileName: string;
  declaredType?: string | null;
  bytes: Buffer;
}): UploadValidationResult {
  const { fileName, declaredType, bytes } = input;
  const extension = getUploadFileExtension(fileName);
  const contentType = ALLOWED_CONTENT_TYPE_BY_EXTENSION[extension];
  if (!contentType) {
    return unsupported(fileName, extension);
  }

  const normalizedDeclared = (declaredType ?? "").split(";")[0].trim().toLowerCase();
  if (normalizedDeclared && BLOCKED_CONTENT_TYPES.has(normalizedDeclared)) {
    return unsupported(fileName, extension);
  }

  if (bytes.length === 0) {
    return { ok: false, status: 400, error: `File "${fileName}" is empty.` };
  }

  const signature = SIGNATURE_BY_EXTENSION[extension];
  if (signature && !signature(bytes.subarray(0, MAGIC_PREFIX_LENGTH))) {
    return mismatched(fileName, extension);
  }

  if (TEXT_EXTENSIONS.has(extension) && looksLikeMarkup(bytes)) {
    return mismatched(fileName, extension);
  }

  return { ok: true, extension, contentType };
}
