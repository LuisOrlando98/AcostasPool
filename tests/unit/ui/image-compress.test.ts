import { describe, expect, it } from "vitest";
import {
  COMPRESSED_MIME_TYPE,
  DEFAULT_MAX_DIMENSION,
  DEFAULT_MIN_BYTES_TO_COMPRESS,
  DEFAULT_QUALITY,
  compressImage,
  compressImages,
  computeScaledSize,
  isSmallerResult,
  shouldCompress,
} from "@/lib/ui/image-compress";

const KILOBYTE = 1024;

function createFile(name: string, sizeBytes: number, type = "image/jpeg") {
  return new File([new Uint8Array(sizeBytes)], name, { type, lastModified: 1_700_000_000_000 });
}

describe("computeScaledSize", () => {
  it("keeps images whose longest side already fits", () => {
    // Arrange
    const size = { width: 1200, height: 800 };

    // Act
    const scaled = computeScaledSize(size, DEFAULT_MAX_DIMENSION);

    // Assert
    expect(scaled).toEqual(size);
  });

  it("scales landscape images down to the max dimension keeping the ratio", () => {
    expect(computeScaledSize({ width: 4000, height: 3000 }, 1600)).toEqual({
      width: 1600,
      height: 1200,
    });
  });

  it("scales portrait images by their height", () => {
    expect(computeScaledSize({ width: 3000, height: 4000 }, 1600)).toEqual({
      width: 1200,
      height: 1600,
    });
  });

  it("never returns a zero-sized dimension", () => {
    expect(computeScaledSize({ width: 10_000, height: 1 }, 100)).toEqual({
      width: 100,
      height: 1,
    });
  });

  it("returns degenerate sizes untouched", () => {
    expect(computeScaledSize({ width: 0, height: 0 }, 100)).toEqual({ width: 0, height: 0 });
  });
});

describe("shouldCompress", () => {
  it("skips files already below the threshold", () => {
    expect(shouldCompress({ type: "image/jpeg", size: 100 * KILOBYTE }, 600 * KILOBYTE)).toBe(
      false
    );
  });

  it("compresses large images", () => {
    expect(shouldCompress({ type: "image/png", size: 2 * KILOBYTE * KILOBYTE }, 600 * KILOBYTE)).toBe(
      true
    );
  });

  it("ignores non-image files regardless of size", () => {
    expect(shouldCompress({ type: "application/pdf", size: 5 * KILOBYTE * KILOBYTE }, 1)).toBe(
      false
    );
  });
});

describe("isSmallerResult", () => {
  it("accepts only results that actually save bytes", () => {
    expect(isSmallerResult(1000, 999)).toBe(true);
    expect(isSmallerResult(1000, 1000)).toBe(false);
    expect(isSmallerResult(1000, 1200)).toBe(false);
    expect(isSmallerResult(1000, 0)).toBe(false);
  });
});

describe("compressImage", () => {
  it("returns the same File when it is already small", async () => {
    const file = createFile("small.jpg", 10 * KILOBYTE);

    const result = await compressImage(file);

    expect(result).toBe(file);
  });

  it("falls back to the original when the browser cannot decode images", async () => {
    // Node has no createImageBitmap/canvas: the fallback path must keep the file.
    const file = createFile("big.jpg", DEFAULT_MIN_BYTES_TO_COMPRESS + 1);

    const result = await compressImage(file, { maxDimension: 800, quality: 0.5 });

    expect(result).toBe(file);
    expect(result.name).toBe("big.jpg");
  });

  it("exposes production defaults aligned with the upload form", () => {
    expect(DEFAULT_MAX_DIMENSION).toBe(1600);
    expect(DEFAULT_QUALITY).toBe(0.82);
    expect(DEFAULT_MIN_BYTES_TO_COMPRESS).toBe(600 * KILOBYTE);
    expect(COMPRESSED_MIME_TYPE).toBe("image/jpeg");
  });
});

describe("compressImages", () => {
  it("preserves order and returns a new array", async () => {
    const first = createFile("a.jpg", KILOBYTE);
    const second = createFile("b.jpg", KILOBYTE);
    const input = [first, second];

    const result = await compressImages(input);

    expect(result).toEqual([first, second]);
    expect(result).not.toBe(input);
  });

  it("returns an empty array for no files", async () => {
    await expect(compressImages([])).resolves.toEqual([]);
  });
});
