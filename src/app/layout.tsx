import type { Metadata, Viewport } from "next"
import { Manrope, Source_Serif_4 } from "next/font/google"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import "./globals.css"

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
})

const serif = Source_Serif_4({
  variable: "--font-serif",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz"],
})

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: {
    default: "NADI Group — Terrains viabilisés",
    template: "%s · NADI Group",
  },
  description:
    "Choisissez votre terrain viabilisé sur le site NADI Group : plan interactif, prix, modalités de paiement échelonné et suivi de l'avancement des travaux.",
  applicationName: "NADI Group",
  openGraph: { type: "website", locale: "fr_FR", siteName: "NADI Group" },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf9f5" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1a18" },
  ],
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" suppressHydrationWarning className={`${manrope.variable} ${serif.variable} antialiased`}>
      <body className="min-h-dvh">
        <TooltipProvider delayDuration={200}>
          {children}
          <Toaster position="top-center" richColors closeButton />
        </TooltipProvider>
      </body>
    </html>
  )
}
