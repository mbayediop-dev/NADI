/** Pages imprimables de l'administration (reçus, relevés) : sans barre latérale. */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-muted/50 px-4 py-6 print:bg-white print:p-0 sm:py-10">{children}</div>
}
