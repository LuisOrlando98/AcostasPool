/**
 * Compresión de fotos en el cliente antes de subirlas (evidencias del técnico).
 *
 * Decodifica con `createImageBitmap`, reduce el lado mayor a `maxDimension` y
 * recodifica como JPEG en un canvas. Cualquier fallo (HEIC u otros formatos que
 * el navegador no decodifica, falta de memoria, canvas no disponible) devuelve
 * el archivo original: subir sin comprimir siempre es preferible a no subir.
 *
 * Limitaciones conocidas: la recodificación descarta los metadatos EXIF (GPS,
 * fecha de captura) y la transparencia de los PNG se aplana sobre blanco.
 */

export type CompressImageOptions = {
  /** Lado mayor máximo del resultado, en píxeles. Nunca se amplía la imagen. */
  readonly maxDimension?: number;
  /** Calidad JPEG entre 0 y 1. */
  readonly quality?: number;
  /** Por debajo de este tamaño el archivo ya es pequeño y se devuelve tal cual. */
  readonly minBytesToCompress?: number;
};

export type ImageSize = {
  readonly width: number;
  readonly height: number;
};

const KILOBYTE = 1024;

export const DEFAULT_MAX_DIMENSION = 1600;
export const DEFAULT_QUALITY = 0.82;
export const DEFAULT_MIN_BYTES_TO_COMPRESS = 600 * KILOBYTE;
export const COMPRESSED_MIME_TYPE = "image/jpeg";

const CANVAS_BACKGROUND = "#ffffff";

/** Escala proporcional para que el lado mayor no supere `maxDimension`. */
export function computeScaledSize(size: ImageSize, maxDimension: number): ImageSize {
  const longestSide = Math.max(size.width, size.height);
  if (longestSide <= 0 || longestSide <= maxDimension) {
    return size;
  }
  const ratio = maxDimension / longestSide;
  return {
    width: Math.max(1, Math.round(size.width * ratio)),
    height: Math.max(1, Math.round(size.height * ratio)),
  };
}

/** Solo se recomprimen imágenes que superan el umbral de tamaño. */
export function shouldCompress(
  file: Pick<File, "type" | "size">,
  minBytesToCompress: number
): boolean {
  return file.type.startsWith("image/") && file.size >= minBytesToCompress;
}

/** El resultado solo sustituye al original si de verdad ahorra bytes. */
export function isSmallerResult(originalBytes: number, resultBytes: number): boolean {
  return resultBytes > 0 && resultBytes < originalBytes;
}

function isCanvasEncodingAvailable(): boolean {
  if (typeof createImageBitmap !== "function") {
    return false;
  }
  return typeof OffscreenCanvas !== "undefined" || typeof document !== "undefined";
}

type DrawingSurface = {
  readonly context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
  readonly toBlob: (quality: number) => Promise<Blob | null>;
};

function createDrawingSurface(size: ImageSize): DrawingSurface | null {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(size.width, size.height);
    const context = canvas.getContext("2d");
    if (!context) {
      return null;
    }
    return {
      context,
      toBlob: (quality) => canvas.convertToBlob({ type: COMPRESSED_MIME_TYPE, quality }),
    };
  }
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }
  return {
    context,
    toBlob: (quality) =>
      new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, COMPRESSED_MIME_TYPE, quality)
      ),
  };
}

async function encodeScaledJpeg(
  file: File,
  maxDimension: number,
  quality: number
): Promise<Blob | null> {
  // `from-image` aplica la orientación EXIF para que la foto no salga girada.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const target = computeScaledSize(
      { width: bitmap.width, height: bitmap.height },
      maxDimension
    );
    const surface = createDrawingSurface(target);
    if (!surface) {
      return null;
    }
    surface.context.fillStyle = CANVAS_BACKGROUND;
    surface.context.fillRect(0, 0, target.width, target.height);
    surface.context.drawImage(bitmap, 0, 0, target.width, target.height);
    return await surface.toBlob(quality);
  } finally {
    // Libera cuanto antes la memoria del bitmap (crítico en móviles antiguos).
    bitmap.close();
  }
}

/**
 * Devuelve una versión JPEG reducida del archivo, conservando su nombre, o el
 * archivo original si no compensa o si el navegador no puede procesarlo.
 */
export async function compressImage(
  file: File,
  options: CompressImageOptions = {}
): Promise<File> {
  const {
    maxDimension = DEFAULT_MAX_DIMENSION,
    quality = DEFAULT_QUALITY,
    minBytesToCompress = DEFAULT_MIN_BYTES_TO_COMPRESS,
  } = options;

  if (!shouldCompress(file, minBytesToCompress) || !isCanvasEncodingAvailable()) {
    return file;
  }

  try {
    const blob = await encodeScaledJpeg(file, maxDimension, quality);
    if (!blob || !isSmallerResult(file.size, blob.size)) {
      return file;
    }
    return new File([blob], file.name, {
      type: COMPRESSED_MIME_TYPE,
      lastModified: file.lastModified,
    });
  } catch {
    // HEIC/formatos no decodificables o falta de memoria: se sube el original.
    return file;
  }
}

/**
 * Comprime en serie (no en paralelo) para no disparar el uso de memoria al
 * decodificar varias fotos de cámara a la vez.
 */
export function compressImages(
  files: readonly File[],
  options: CompressImageOptions = {}
): Promise<File[]> {
  return files.reduce<Promise<File[]>>(
    async (previous, file) => [...(await previous), await compressImage(file, options)],
    Promise.resolve([])
  );
}
