import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { useEffect, useState } from 'react'

const FOLDER = 'fotograflar'
const MAX_EDGE = 1600
const JPEG_QUALITY = 0.82
const JPEG_PREFIX = 'data:image/jpeg;base64,'
const EXTENSION = '.jpg'

const photoFile = (id: string) => ({ path: `${FOLDER}/${id}${EXTENSION}`, directory: Directory.Data })

const writePhoto = (id: string, base64: string) =>
  Filesystem.writeFile({ ...photoFile(id), data: base64, recursive: true })

const readDataUrl = async (id: string) => {
  const { data } = await Filesystem.readFile(photoFile(id))
  return `${JPEG_PREFIX}${data as string}`
}

/** Fotoğrafı küçültüp cihaza yazar, id döndürür. */
export const savePhoto = async (file: File) => {
  const url = URL.createObjectURL(file)
  try {
    // <img> telefon fotoğraflarının yön bilgisine uyar, createImageBitmap her yerde uymaz.
    const image = new Image()
    image.src = url
    await image.decode()
    const scale = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(image.naturalWidth * scale)
    canvas.height = Math.round(image.naturalHeight * scale)
    canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height)
    const id = crypto.randomUUID()
    await writePhoto(id, canvas.toDataURL('image/jpeg', JPEG_QUALITY).slice(JPEG_PREFIX.length))
    return id
  } finally {
    URL.revokeObjectURL(url)
  }
}

export const deletePhoto = (id: string) => Filesystem.deleteFile(photoFile(id)).catch(() => undefined)

/** iPhone'da dosya doğrudan gösterilir, galeri belleğe base64 olarak yüklenmez. */
const photoUrl = async (id: string) => {
  if (!Capacitor.isNativePlatform()) return readDataUrl(id)
  const { uri } = await Filesystem.getUri(photoFile(id))
  return Capacitor.convertFileSrc(uri)
}

export const usePhotoUrl = (id: string) => {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    photoUrl(id)
      .then((next) => {
        if (active) setUrl(next)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [id])
  return url
}

export const exportPhotos = async () => {
  const photos: Record<string, string> = {}
  const listing = await Filesystem.readdir({ path: FOLDER, directory: Directory.Data }).catch(() => null)
  for (const { name } of listing?.files ?? []) {
    const id = name.slice(0, -EXTENSION.length)
    photos[id] = await readDataUrl(id)
  }
  return photos
}

export const clearPhotos = () =>
  Filesystem.rmdir({ path: FOLDER, directory: Directory.Data, recursive: true }).catch(() => undefined)

export const replacePhotos = async (photos: Record<string, string>) => {
  await clearPhotos()
  for (const [id, dataUrl] of Object.entries(photos)) await writePhoto(id, dataUrl.split(',')[1])
}

/**
 * iPhone'da paylaşım sayfasını açar, tarayıcıda dosyayı indirir. Kullanıcı
 * paylaşım sayfasını kapatırsa false döner.
 */
export const saveBackupFile = async (filename: string, content: string, type = 'application/json') => {
  if (!Capacitor.isNativePlatform()) {
    const url = URL.createObjectURL(new Blob([content], { type }))
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
    return true
  }
  const { uri } = await Filesystem.writeFile({
    path: filename,
    data: content,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
  })
  return Share.share({ files: [uri] }).then(
    () => true,
    () => false,
  )
}
