import { Mail, MessageCircle, Phone } from "lucide-react"
import { formatPhone, whatsappLink } from "@/lib/phone"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export type CompanyContact = { company: string; phone: string; whatsapp: string; email: string }

/** Boutons de contact NADI Group (WhatsApp, appel, e-mail). */
export function ContactButtons({
  contact,
  message,
  variant = "outline",
  className,
  showEmail = false,
}: {
  contact: CompanyContact
  message?: string
  variant?: "outline" | "default" | "light"
  className?: string
  showEmail?: boolean
}) {
  const light = variant === "light"
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {contact.whatsapp && (
        <Button
          asChild
          size="lg"
          variant={light ? "default" : variant}
          className={cn("h-10 rounded-xl", light && "bg-white text-status-sold-strong hover:bg-white/90")}
        >
          <a href={whatsappLink(contact.whatsapp, message)} target="_blank" rel="noreferrer">
            <MessageCircle />
            WhatsApp
          </a>
        </Button>
      )}
      {contact.phone && (
        <Button
          asChild
          size="lg"
          variant={light ? "outline" : "outline"}
          className={cn("h-10 rounded-xl", light && "border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white")}
        >
          <a href={`tel:${contact.phone}`}>
            <Phone />
            {light ? "Appeler" : formatPhone(contact.phone)}
          </a>
        </Button>
      )}
      {showEmail && contact.email && (
        <Button asChild size="lg" variant="outline" className="h-10 rounded-xl">
          <a href={`mailto:${contact.email}`}>
            <Mail />
            {contact.email}
          </a>
        </Button>
      )}
    </div>
  )
}
