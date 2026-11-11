// Taille maximale d'un fichier téléversé — partagée par le navigateur et le serveur.
// 50 Mo par défaut : c'est la limite du bucket Supabase Storage (offre gratuite). Si la limite du bucket est relevée
// (Supabase → Storage → Settings), ajuster NEXT_PUBLIC_UPLOAD_MAX_MB en conséquence.
const configured = Number(process.env.NEXT_PUBLIC_UPLOAD_MAX_MB)

export const UPLOAD_MAX_MB = Number.isFinite(configured) && configured > 0 ? configured : 50
export const UPLOAD_MAX_BYTES = UPLOAD_MAX_MB * 1024 * 1024
export const UPLOAD_TOO_LARGE = `Fichier trop volumineux (${UPLOAD_MAX_MB} Mo maximum)`
