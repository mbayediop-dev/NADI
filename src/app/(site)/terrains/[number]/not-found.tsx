import Link from "next/link"
import { ArrowRight, MapPinOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Container } from "@/components/site/section-heading"
import { PageBand } from "@/components/site/skeletons"

export default function LotNotFound() {
  return (
    <>
      <PageBand>
        <h1 className="font-display text-4xl font-medium sm:text-5xl">Terrain introuvable</h1>
      </PageBand>
      <Container className="flex flex-col items-center py-20 text-center">
        <span className="grid size-14 place-items-center rounded-lg bg-muted text-muted-foreground">
          <MapPinOff className="size-6" />
        </span>
        <p className="mt-5 max-w-md text-muted-foreground">Ce numéro de terrain n&apos;existe pas ou n&apos;est plus en ligne. Retrouvez tous les lots sur le plan interactif.</p>
        <Button asChild className="mt-6 h-11 rounded-md px-5">
          <Link href="/terrains">
            Voir le plan des terrains
            <ArrowRight />
          </Link>
        </Button>
      </Container>
    </>
  )
}
