export const MAIN_MAX_EDGE = 2048;
export const THUMBNAIL_MAX_EDGE = 640;
export const MAIN_QUALITY = 0.82;
export const THUMBNAIL_QUALITY = 0.8;

export function fitWithin(width: number, height: number, maxEdge: number): { width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

// GIFs would lose their animation and SVGs their vectors, so only raster photos are re-encoded.
export function isResizableImage(type: string): boolean {
  return type.startsWith("image/") && type !== "image/gif" && type !== "image/svg+xml";
}

export async function resizeImage(file: Blob, maxEdge: number, quality: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const { width, height } = fitWithin(bitmap.width, bitmap.height, maxEdge);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Canvas is unavailable");
  }
  // JPEG has no alpha, so paint white under transparent pixels instead of letting them turn black.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Image encoding failed"))), "image/jpeg", quality);
  });
}
