"use client"

export type UploadedFile = { key: string; url: string | null; size: number; mimeType: string; filename: string }

/** Téléverse un fichier vers /api/admin/upload avec suivi de progression. */
export function uploadFile(
  file: File,
  opts: { scope: "public" | "private"; folder: string; onProgress?: (ratio: number) => void },
): Promise<UploadedFile> {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    form.append("file", file)
    form.append("scope", opts.scope)
    form.append("folder", opts.folder)
    const xhr = new XMLHttpRequest()
    xhr.open("POST", "/api/admin/upload")
    xhr.upload.onprogress = (e) => e.lengthComputable && opts.onProgress?.(e.loaded / e.total)
    xhr.onload = () => {
      let body: { error?: string } & Partial<UploadedFile> = {}
      try {
        body = JSON.parse(xhr.responseText)
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300 && body.key) resolve(body as UploadedFile)
      else reject(new Error(body.error ?? "Échec du téléversement"))
    }
    xhr.onerror = () => reject(new Error("Erreur réseau pendant le téléversement"))
    xhr.send(form)
  })
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`
}
