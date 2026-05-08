// Magic byte signatures for allowed file types
const MAGIC: Record<string, number[]> = {
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  jpg: [0xff, 0xd8, 0xff],
  zip: [0x50, 0x4b, 0x03, 0x04],
}

export type AllowedFileType = keyof typeof MAGIC

export function validateMagicBytes(
  buffer: Buffer,
  allowedTypes: AllowedFileType[]
): AllowedFileType | null {
  for (const type of allowedTypes) {
    const signature = MAGIC[type]
    if (buffer.length < signature.length) continue
    if (signature.every((byte, i) => buffer[i] === byte)) return type
  }
  return null
}

// PNG: signature (8B) + chunk length (4B) + "IHDR" (4B) = 16B offset → width (4B), height (4B)
export function readPngDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 24) return null
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  }
}

export const MAX_TEMPLATE_SIZE_BYTES = 10 * 1024 * 1024  // 10 MB
