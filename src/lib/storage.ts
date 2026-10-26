import "server-only"
import { createReadStream } from "node:fs"
import { mkdir, rm, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import { Readable } from "node:stream"
import { randomUUID } from "node:crypto"
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { env } from "@/lib/env"

/**
 * Stockage des fichiers.
 * - Les clés commençant par « public/ » sont servies librement via /api/files/…
 * - Les clés « private/ » ne sont accessibles qu'au travers de /api/documents/[id] (contrôle d'accès).
 * Pilotes : local (disque), supabase (Supabase Storage) ou s3 (tout service compatible S3).
 */

export type StoredObject = { key: string; size: number; contentType: string }
export type ObjectStream = { body: ReadableStream; size: number; contentType: string; range?: { start: number; end: number } }

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

export function guessMime(filename: string, fallback = "application/octet-stream") {
  return MIME_BY_EXT[path.extname(filename).toLowerCase()] ?? fallback
}

function safeName(filename: string) {
  const ext = path.extname(filename).toLowerCase().replace(/[^.a-z0-9]/g, "")
  const base = path
    .basename(filename, path.extname(filename))
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
  return `${base || "fichier"}${ext}`
}

export function makeKey(scope: "public" | "private", folder: string, filename: string) {
  return `${scope}/${folder}/${randomUUID().slice(0, 8)}-${safeName(filename)}`
}

export function publicUrl(key: string) {
  return `/api/files/${key}`
}

// ─────────────────────────────────────────────────────────────
// Pilote local (disque)
// ─────────────────────────────────────────────────────────────

// Dossier choisi à l'exécution : exclu de l'analyse statique des fichiers à embarquer
const localRoot = () => path.resolve(/*turbopackIgnore: true*/ process.cwd(), env.storageLocalDir)

function localPath(key: string) {
  const full = path.resolve(localRoot(), key)
  if (!full.startsWith(localRoot() + path.sep)) throw new Error("Clé de fichier invalide")
  return full
}

// ─────────────────────────────────────────────────────────────
// Pilote S3 (Amazon S3, Cloudflare R2, Supabase Storage, MinIO…)
// ─────────────────────────────────────────────────────────────

let s3: S3Client | null = null
function s3Client() {
  if (!s3) {
    s3 = new S3Client({
      region: process.env.S3_REGION ?? "auto",
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: !!process.env.S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
      },
    })
  }
  return s3
}
const bucket = () => {
  const name = process.env.S3_BUCKET
  if (!name) throw new Error("S3_BUCKET manquant")
  return name
}

// ─────────────────────────────────────────────────────────────
// Pilote Supabase Storage (API REST, clé « service_role » côté serveur uniquement)
// ─────────────────────────────────────────────────────────────

function supabaseConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "")
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "nadi"
  if (!url || !key) throw new Error("SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis avec STORAGE_DRIVER=supabase")
  return { url, key, bucket }
}

/** Chemin d'objet encodé segment par segment (les « / » sont conservés). */
function objectPath(key: string) {
  return key.split("/").map(encodeURIComponent).join("/")
}

async function supabaseFetch(path: string, init: RequestInit = {}) {
  const { url, key } = supabaseConfig()
  const headers = new Headers(init.headers)
  headers.set("Authorization", `Bearer ${key}`)
  headers.set("apikey", key)
  return fetch(`${url}/storage/v1${path}`, { ...init, headers })
}

// ─────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────

export async function putObject(key: string, data: Buffer, contentType: string): Promise<StoredObject> {
  if (env.storageDriver === "supabase") {
    const res = await supabaseFetch(`/object/${supabaseConfig().bucket}/${objectPath(key)}`, {
      method: "POST",
      headers: { "Content-Type": contentType, "x-upsert": "true", "Cache-Control": "31536000" },
      body: new Uint8Array(data),
    })
    if (!res.ok) throw new Error(`Supabase Storage : envoi refusé (${res.status} ${(await res.text()).slice(0, 200)})`)
  } else if (env.storageDriver === "s3") {
    await s3Client().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: data, ContentType: contentType }))
  } else {
    const file = localPath(key)
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, data)
  }
  return { key, size: data.byteLength, contentType }
}

export async function saveUpload(file: File, scope: "public" | "private", folder: string): Promise<StoredObject> {
  const key = makeKey(scope, folder, file.name)
  const contentType = file.type || guessMime(file.name)
  return putObject(key, Buffer.from(await file.arrayBuffer()), contentType)
}

export async function deleteObject(key: string | null | undefined) {
  if (!key) return
  try {
    if (env.storageDriver === "supabase") {
      const res = await supabaseFetch(`/object/${supabaseConfig().bucket}/${objectPath(key)}`, { method: "DELETE" })
      if (!res.ok && res.status !== 404) throw new Error(`statut ${res.status}`)
    } else if (env.storageDriver === "s3") {
      await s3Client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }))
    } else {
      await rm(localPath(key), { force: true })
    }
  } catch (error) {
    console.error("[storage] suppression impossible", key, error)
  }
}

/** Lecture (avec prise en charge des requêtes partielles « Range », nécessaires à la vidéo sur iOS). */
export async function getObject(key: string, rangeHeader?: string | null): Promise<ObjectStream | null> {
  const contentType = guessMime(key)
  if (env.storageDriver === "supabase") {
    const res = await supabaseFetch(`/object/authenticated/${supabaseConfig().bucket}/${objectPath(key)}`, {
      headers: rangeHeader ? { Range: rangeHeader } : undefined,
    })
    if (!res.ok || !res.body) return null
    const contentRange = res.headers.get("content-range")
    let range: ObjectStream["range"]
    let size = Number(res.headers.get("content-length") ?? 0)
    if (res.status === 206 && contentRange) {
      const [span, total] = contentRange.replace(/^bytes /, "").split("/")
      const [start, end] = span.split("-").map(Number)
      range = { start, end }
      size = Number(total)
    }
    return { body: res.body, size, contentType: res.headers.get("content-type") ?? contentType, range }
  }
  if (env.storageDriver === "s3") {
    try {
      const res = await s3Client().send(
        new GetObjectCommand({ Bucket: bucket(), Key: key, Range: rangeHeader ?? undefined }),
      )
      if (!res.Body) return null
      const body = res.Body.transformToWebStream()
      const total = res.ContentRange ? Number(res.ContentRange.split("/")[1]) : Number(res.ContentLength ?? 0)
      let range: ObjectStream["range"]
      if (res.ContentRange) {
        const [start, end] = res.ContentRange.replace(/^bytes /, "").split("/")[0].split("-").map(Number)
        range = { start, end }
      }
      return { body, size: total, contentType: res.ContentType ?? contentType, range }
    } catch {
      return null
    }
  }

  const file = localPath(key)
  const info = await stat(file).catch(() => null)
  if (!info?.isFile()) return null
  const size = info.size
  const parsed = parseRange(rangeHeader, size)
  const stream = createReadStream(file, parsed ? { start: parsed.start, end: parsed.end } : undefined)
  return {
    body: Readable.toWeb(stream) as ReadableStream,
    size,
    contentType,
    range: parsed ?? undefined,
  }
}

function parseRange(header: string | null | undefined, size: number) {
  const match = header?.match(/^bytes=(\d*)-(\d*)$/)
  if (!match) return null
  let start = match[1] ? Number(match[1]) : NaN
  let end = match[2] ? Number(match[2]) : size - 1
  if (Number.isNaN(start)) {
    start = size - end
    end = size - 1
  }
  if (start < 0 || start >= size || end < start) return null
  return { start, end: Math.min(end, size - 1) }
}

/** Construit la réponse HTTP pour un objet (200 ou 206). */
export function objectResponse(object: ObjectStream, opts: { filename?: string; inline?: boolean; cache?: string } = {}) {
  const headers = new Headers({
    "Content-Type": object.contentType,
    "Accept-Ranges": "bytes",
    "Cache-Control": opts.cache ?? "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  })
  if (object.contentType === "image/svg+xml") headers.set("Content-Security-Policy", "script-src 'none'")
  if (opts.filename) {
    headers.set(
      "Content-Disposition",
      `${opts.inline === false ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(opts.filename)}`,
    )
  }
  if (object.range) {
    headers.set("Content-Range", `bytes ${object.range.start}-${object.range.end}/${object.size}`)
    headers.set("Content-Length", String(object.range.end - object.range.start + 1))
    return new Response(object.body, { status: 206, headers })
  }
  headers.set("Content-Length", String(object.size))
  return new Response(object.body, { status: 200, headers })
}
