// Cachet et signature de l'entreprise apposés sur les reçus.
// L'image est stockée en privé et servie par /api/signature (administrateurs et propriétaires connectés uniquement) :
// elle n'a pas d'adresse publique, contrairement au logo.

export const SIGNATURE_FOLDER = "signature"
const SIGNATURE_PREFIX = `private/${SIGNATURE_FOLDER}/`

export function isSignatureKey(key: string) {
  return key.startsWith(SIGNATURE_PREFIX) && /^[\w./-]+$/.test(key) && !key.includes("..")
}

/** Adresse de l'image : la clé fait partie de l'URL, le navigateur recharge donc l'image dès qu'elle est remplacée. */
export function signatureUrl(key: string) {
  return `/api/signature?key=${encodeURIComponent(key)}`
}
