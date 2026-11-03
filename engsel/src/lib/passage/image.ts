export const PASSAGE_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

export const PASSAGE_IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

const MEDIA_TYPES: Record<string, string> = {
  "image/png": "image/png",
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  "image/webp": "image/webp",
  "image/gif": "image/gif",
};

export function passageImageMediaType(file: { type: string; name: string }) {
  const fromType = MEDIA_TYPES[file.type.toLowerCase()];
  if (fromType) return fromType;

  const name = file.name.toLowerCase();
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".gif")) return "image/gif";
  return null;
}
