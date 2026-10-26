import { Download, FileText } from "lucide-react"
import { DOCUMENT_CATEGORY } from "@/lib/labels"
import type { PublicDocument } from "@/lib/queries/public"
import type { DocumentCategory } from "@/generated/prisma/enums"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Container, SectionHeading } from "@/components/site/section-heading"
import { Reveal } from "@/components/site/reveal"
import { frenchText } from "@/components/site/typography"

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`
}

export function DocumentsSection({ documents }: { documents: PublicDocument[] }) {
  if (documents.length === 0) return null
  return (
    <section className="py-20 sm:py-24">
      <Container>
        <SectionHeading eyebrow="Documents" title="Les documents du projet, en libre accès." description="Consultez les pièces essentielles avant de réserver. D'autres documents sont réservés aux propriétaires dans leur espace." />
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc, i) => (
            <Reveal as="li" key={doc.id} delay={i * 0.05}>
              <a
                href={`/api/documents/${doc.id}?download`}
                className="group flex items-center gap-4 rounded-lg border bg-card p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-md bg-status-sold/10 text-status-sold-strong">
                  <FileText className="size-6" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{doc.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {DOCUMENT_CATEGORY[doc.category as DocumentCategory] ?? "Document"} · {doc.mimeType === "application/pdf" ? "PDF" : "Fichier"} · {formatSize(doc.size)}
                  </span>
                </span>
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Download className="size-4" />
                </span>
              </a>
            </Reveal>
          ))}
        </ul>
      </Container>
    </section>
  )
}

export function FaqSection({ faq }: { faq: { q: string; a: string }[] }) {
  if (faq.length === 0) return null
  return (
    <section id="faq" className="scroll-mt-20 border-t bg-sand/40 py-20 sm:py-28">
      <Container className="grid items-start gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
        <SectionHeading className="lg:sticky lg:top-28" eyebrow="Questions fréquentes" title="Tout ce que vous devez savoir avant de vous lancer." />
        <Reveal delay={0.05}>
          <Accordion type="single" collapsible className="space-y-3">
            {faq.map((item, i) => (
              <AccordionItem key={i} value={`q${i}`} className="rounded-lg border bg-card px-5 shadow-xs data-[state=open]:shadow-md">
                <AccordionTrigger className="py-4 text-base font-semibold hover:no-underline">{frenchText(item.q)}</AccordionTrigger>
                <AccordionContent className="pb-4 text-[0.95rem] leading-relaxed text-muted-foreground">{frenchText(item.a)}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </Container>
    </section>
  )
}
