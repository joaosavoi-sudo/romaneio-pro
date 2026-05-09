import { supabase } from './supabase'

const BUCKET = 'anexos-obra'

export async function uploadAnexo(obraId, file) {
  const ext = file.name.split('.').pop()
  const path = `obras/${obraId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  })
  if (error) throw error
  return {
    storage_path: path,
    mime_type: file.type,
    tamanho_bytes: file.size,
  }
}

export async function getSignedUrl(storagePath, expiresIn = 3600) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, expiresIn)
  if (error) return null
  return data?.signedUrl
}

export async function deleteAnexoStorage(storagePath) {
  await supabase.storage.from(BUCKET).remove([storagePath])
}

export function isImage(mimeType) {
  return mimeType?.startsWith('image/')
}

export function isPdf(mimeType) {
  return mimeType === 'application/pdf'
}

export function formatBytes(bytes) {
  if (!bytes) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
