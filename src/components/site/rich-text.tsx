import { Fragment } from "react"
import { frenchText } from "@/components/site/typography"

/** Texte simple avec **gras** et paragraphes (lignes vides). */
export function RichText({ text, className, strongClassName = "font-semibold text-foreground" }: { text: string; className?: string; strongClassName?: string }) {
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim())
  return (
    <>
      {paragraphs.map((para, i) => (
        <p key={i} className={className}>
          {para.split(/(\*\*[^*]+\*\*)/g).map((chunk, j) =>
            chunk.startsWith("**") && chunk.endsWith("**") ? (
              <strong key={j} className={strongClassName}>
                {frenchText(chunk.slice(2, -2))}
              </strong>
            ) : (
              <Fragment key={j}>{frenchText(chunk)}</Fragment>
            ),
          )}
        </p>
      ))}
    </>
  )
}
