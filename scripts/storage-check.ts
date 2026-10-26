// Vérifie la configuration du stockage des fichiers (STORAGE_DRIVER) : envoi, lecture (y compris partielle) et suppression d'un objet test.
// Usage : npm run storage:check
import "dotenv/config"
import { deleteObject, getObject, putObject } from "../src/lib/storage"

async function main() {
  const driver = process.env.STORAGE_DRIVER ?? "local"
  const key = `public/tests/verification-${Date.now()}.txt`
  const payload = Buffer.from("NADI Group — test de stockage : 0123456789")
  console.log(`→ Pilote « ${driver} » : envoi de ${key}`)
  await putObject(key, payload, "text/plain")

  const full = await getObject(key)
  if (!full) throw new Error("Objet introuvable après envoi")
  const text = Buffer.from(await new Response(full.body).arrayBuffer()).toString()
  if (text !== payload.toString()) throw new Error(`Contenu inattendu : ${text}`)
  console.log(`✓ Lecture complète (${full.size} octets, ${full.contentType})`)

  const partial = await getObject(key, "bytes=0-9")
  if (!partial?.range) throw new Error("Les requêtes partielles (Range) ne sont pas prises en charge")
  const chunk = Buffer.from(await new Response(partial.body).arrayBuffer()).toString()
  console.log(`✓ Lecture partielle octets ${partial.range.start}-${partial.range.end} sur ${partial.size} : « ${chunk} »`)

  await deleteObject(key)
  if (await getObject(key)) throw new Error("L'objet existe encore après suppression")
  console.log("✓ Suppression")
  console.log("Stockage opérationnel.")
}

main().catch((error) => {
  console.error("✗", error instanceof Error ? error.message : error)
  process.exit(1)
})
