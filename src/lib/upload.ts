import sharp from 'sharp'

export const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE_MB || '10') * 1024 * 1024

const TARGET_SIZE_BYTES = parseInt(process.env.IMAGE_COMPRESS_KB || '200') * 1024
const MAX_DIMENSION = 1920

/**
 * Compress image buffer to ~200KB JPEG
 * - Auto-rotate ตาม EXIF (แก้รูปหมุนจากมือถือ)
 * - Resize ให้ไม่เกิน 1920×1920 px (คง aspect ratio)
 */
export async function compressImage(buffer: Buffer): Promise<Buffer> {
  let quality = 82
  const base = sharp(buffer).rotate().resize(MAX_DIMENSION, MAX_DIMENSION, {
    fit: 'inside',
    withoutEnlargement: true,
  })

  let result = await base.clone().jpeg({ quality }).toBuffer()

  while (result.length > TARGET_SIZE_BYTES && quality > 40) {
    quality -= 8
    result = await base.clone().jpeg({ quality }).toBuffer()
  }

  return result
}

export function generateFilename(originalName: string, forcedExt?: string): string {
  const ext = forcedExt ?? (originalName.includes('.') ? '.' + originalName.split('.').pop() : '')
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  return `${timestamp}-${random}${ext}`
}

/** Upload image buffer to ImgBB — returns public URL or null */
export async function uploadImage(buffer: Buffer): Promise<string | null> {
  const apiKey = process.env.IMGBB_API_KEY
  if (!apiKey) return null
  try {
    const base64 = buffer.toString('base64')
    const form = new URLSearchParams()
    form.append('key', apiKey)
    form.append('image', base64)

    const res = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      body: form,
    })
    if (!res.ok) return null
    const data = await res.json()
    return data?.data?.url ?? null
  } catch {
    return null
  }
}
