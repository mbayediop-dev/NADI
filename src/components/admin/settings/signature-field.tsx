"use client"

import * as React from "react"
import { ImageUp, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { cutOutInk } from "@/lib/ink-extract-client"
import { SIGNATURE_FOLDER, signatureUrl } from "@/lib/signature"
import { uploadFile } from "@/lib/upload-client"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"

/**
 * Cachet et signature apposés sur les reçus. La photo est détourée dans le navigateur (papier → transparent),
 * puis stockée en privé : `value` est la clé du fichier, pas une adresse publique.
 */
export function SignatureField({ value, onChange }: { value: string | null; onChange: (key: string | null) => void }) {
  const ref = React.useRef<HTMLInputElement>(null)
  const [cutOut, setCutOut] = React.useState(true)
  const [step, setStep] = React.useState<"idle" | "cutting" | "sending">("idle")
  const [progress, setProgress] = React.useState(0)
  const busy = step !== "idle"

  async function pick(file: File) {
    if (!file.type.startsWith("image/")) return toast.error("Choisissez une image (JPG ou PNG)")
    try {
      setStep("cutting")
      const prepared = cutOut ? await cutOutInk(file) : file
      setProgress(0)
      setStep("sending")
      const uploaded = await uploadFile(prepared, { scope: "private", folder: SIGNATURE_FOLDER, onProgress: setProgress })
      onChange(uploaded.key)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Téléversement impossible")
    } finally {
      setStep("idle")
      if (ref.current) ref.current.value = ""
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative grid h-36 w-56 shrink-0 place-items-center overflow-hidden rounded-xl border bg-white">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element -- image privée servie avec contrôle d'accès
            <img src={signatureUrl(value)} alt="Cachet et signature" className="max-h-full max-w-full object-contain p-2" />
          ) : (
            <button type="button" disabled={busy} onClick={() => ref.current?.click()} className="grid size-full place-items-center text-sm text-neutral-500 hover:bg-neutral-50">
              <span className="flex flex-col items-center gap-2">
                <ImageUp className="size-6" />
                Choisir une image
              </span>
            </button>
          )}
          {busy && (
            <div className="absolute inset-0 grid place-items-center bg-white/85 text-sm font-medium text-neutral-700">
              <span className="flex w-40 flex-col items-center gap-2">
                <Spinner />
                {step === "cutting" ? "Détourage…" : "Envoi…"}
                {step === "sending" && <Progress value={progress * 100} className="h-1.5" />}
              </span>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => ref.current?.click()}>
              <ImageUp /> {value ? "Remplacer" : "Téléverser"}
            </Button>
            {value && (
              <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={busy} onClick={() => onChange(null)}>
                <Trash2 /> Retirer
              </Button>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={cutOut} onCheckedChange={setCutOut} disabled={busy} aria-label="Supprimer le fond de la photo" />
            Supprimer le fond de la photo
          </label>
        </div>
      </div>
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])} />
    </div>
  )
}
