/**
 * Client-side image compression using Canvas API.
 * Resizes to max 400x400, converts to WebP (fallback JPEG), targets ≤200KB.
 */

const MAX_DIMENSION = 400;
const MAX_SIZE_BYTES = 200 * 1024; // 200 KB
const INITIAL_QUALITY = 0.85;
const MIN_QUALITY = 0.4;
const QUALITY_STEP = 0.1;

const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

export function isAcceptedImageType(file: File): boolean {
  return ACCEPTED_TYPES.includes(file.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Impossible de charger l'image"));
    img.src = URL.createObjectURL(file);
  });
}

function resizeToCanvas(img: HTMLImageElement): HTMLCanvasElement {
  let { width, height } = img;
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, width, height);
  return canvas;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Compression échouée"))),
      type,
      quality,
    );
  });
}

let _supportsWebP: boolean | null = null;
function supportsWebP(): boolean {
  if (_supportsWebP === null) {
    try {
      const c = document.createElement("canvas");
      c.width = 1;
      c.height = 1;
      _supportsWebP = c.toDataURL("image/webp").startsWith("data:image/webp");
    } catch {
      _supportsWebP = false;
    }
  }
  return _supportsWebP;
}

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Extracts a cropped region from an image source using Canvas.
 * Returns the cropped square as a Blob ready for compression.
 */
export async function cropImage(
  imageSrc: string,
  cropAreaPixels: CropArea,
): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Impossible de charger l'image"));
    image.src = imageSrc;
  });

  const canvas = document.createElement("canvas");
  canvas.width = cropAreaPixels.width;
  canvas.height = cropAreaPixels.height;
  const ctx = canvas.getContext("2d")!;

  ctx.drawImage(
    img,
    cropAreaPixels.x,
    cropAreaPixels.y,
    cropAreaPixels.width,
    cropAreaPixels.height,
    0,
    0,
    cropAreaPixels.width,
    cropAreaPixels.height,
  );

  return canvasToBlob(canvas, "image/png", 1);
}

export async function compressImage(file: File): Promise<{
  blob: Blob;
  mimeType: string;
  extension: string;
}> {
  const img = await loadImage(file);
  const canvas = resizeToCanvas(img);
  URL.revokeObjectURL(img.src);

  const mimeType = supportsWebP() ? "image/webp" : "image/jpeg";
  const extension = supportsWebP() ? "webp" : "jpg";

  let quality = INITIAL_QUALITY;
  let blob = await canvasToBlob(canvas, mimeType, quality);

  while (blob.size > MAX_SIZE_BYTES && quality > MIN_QUALITY) {
    quality -= QUALITY_STEP;
    blob = await canvasToBlob(canvas, mimeType, quality);
  }

  return { blob, mimeType, extension };
}
