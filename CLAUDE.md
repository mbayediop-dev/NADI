@AGENTS.md

# NADI Group — gestion de lotissement

Application web responsive (pas d'app mobile) composée de trois espaces :

| Espace | Routes | Accès |
| --- | --- | --- |
| Site public (landing, plan interactif, réservation) | `src/app/(site)/` | libre |
| Espace client (propriétaires) | `src/app/espace-client/` | téléphone + code OTP SMS |
| Administration (responsable NADI) | `src/app/admin/` | e-mail + mot de passe |

## Stack

- Next.js 16 (App Router, **Cache Components activé**, `proxy.ts` au lieu de `middleware.ts`), React 19, TypeScript
- Tailwind CSS v4 + shadcn/ui (style `radix-nova`, composants dans `src/components/ui`, import `cn` depuis `@/lib/utils`)
- Prisma 7 + PostgreSQL hébergé sur **Supabase** (client généré dans `src/generated/prisma`, adaptateur `@prisma/adapter-pg` ; `DATABASE_URL` = pooler transaction pour l'app, `DIRECT_URL` = pooler session pour la CLI Prisma). Fichiers dans Supabase Storage (`STORAGE_DRIVER=supabase`, bucket privé, clé `service_role` côté serveur)
- recharts (graphiques), @tanstack/react-table v8, exceljs, react-zoom-pan-pinch, motion, date-fns (locale `fr`), zod v4, jose

## Commandes

```bash
npm run dev            # serveur de dev
npm run typecheck      # tsc --noEmit
npm run db:migrate     # nouvelle migration Prisma
npm run db:seed        # ⚠️ réinitialise la base avec les données de démo
npm run plan:generate  # régénère public/plan/site-plan.svg
```

## Règles Next.js 16 / Cache Components (importantes)

- Toute lecture de données (BD, `cookies()`, `searchParams`, `params`) doit être **dans un composant enfant enveloppé par `<Suspense>`**. Patron de page :
  ```tsx
  export default function Page({ searchParams }: PageProps<"/admin/ventes">) {
    return (<><PageHeader title="Ventes" /><Suspense fallback={<Skeleton />}><Content searchParams={searchParams} /></Suspense></>)
  }
  async function Content({ searchParams }) { await requireAdmin(); const sp = await searchParams; … }
  ```
- `new Date()`, `Date.now()`, `Math.random()` sont **interdits dans la coquille statique** (y compris dans les composants client rendus hors d'un sous-arbre dynamique). Ils sont permis après une lecture dynamique (requête BD, `requireAdmin()`, `connection()`) ou dans `useEffect`.
- `usePathname()` / `useSearchParams()` dans un composant client ⇒ l'envelopper dans `<Suspense>`.
- `params`, `searchParams`, `cookies()`, `headers()` sont asynchrones. Types globaux : `PageProps<"/route">`, `LayoutProps<"/route">`, `RouteContext<"/route">` (générés par `npx next typegen`).
- Pas de `export const runtime` ni `dynamic = "force-dynamic"`.

## Conventions

- **Interface en français**, code (identifiants) en anglais. Montants en FCFA entiers (`Float` en base, toujours arrondis).
- Accès aux données : `db` (`@/lib/db`), paramètres via `getSettings()` (`@/lib/settings`).
- Authentification : pages → `requireAdmin(role?)` / `requireBuyer()` ; actions serveur → `assertAdmin("ADMIN")` (les `VIEWER` sont en lecture seule).
- Actions serveur : fichier `actions.ts` (`"use server"`) à côté de la route, enveloppées dans `run()` et renvoyant `ActionResult` (`@/lib/action`). Erreurs affichables : `throw new UserError("…")`. Côté client : `useServerAction()` (`@/hooks/use-server-action`) gère toasts + `router.refresh()`.
- Journal : `logActivity()` pour toute action métier. SMS : `sendSms(to, body, kind)` (`@/lib/sms`).
- Calculs financiers **uniquement** via `@/lib/finance` (`resolvePlan`, `buildSchedule`, `summarizeSale`) : les versements s'imputent dans l'ordre des échéances.
- Statut `SOLD` d'un terrain : posé uniquement par la création d'une vente ; l'annulation d'une vente remet le terrain `AVAILABLE`.
- Fichiers : `/api/admin/upload` (client : `uploadFile()`), clés `public/…` servies par `/api/files/…`, clés `private/…` uniquement via `/api/documents/[id]` (contrôle d'accès).
- Libellés et couleurs de statut : `@/lib/labels`. Formatage : `@/lib/format` (`formatMoney`, `formatDate`, `formatArea`…), téléphones : `@/lib/phone` (E.164).

## Design system

- Couleurs : `primary` (pin profond), `gold` / `gold-strong` (accent), `sand`, `pine-deep`, statuts `status-available|reserved|sold|unavailable` (+ `-strong` pour le texte).
- Polices : Manrope (`font-sans`), Source Serif 4 (`font-display`, titres du site public et logotype « NADI »).
- Site public : maquette de référence fournie par le client (en-tête blanc, hero photo pleine largeur voilée à gauche + chiffres clés + encart « Un cadre de vie idéal », « Le domaine » avec 4 points forts + plan interactif, cartes de terrains en carrousel, actualités du chantier en carrousel, financement en 4 cartes, « Pourquoi choisir » photo/vidéo + engagements, bandeau contact vert avec formulaire en fenêtre, pied de page clair). Arrondis nets (`--radius: 0.5rem`, boutons `rounded-md`).
- Images du site : réglables dans Admin → Paramètres → Site (`heroImageUrl`, `processImageUrl` pour la section « Pourquoi choisir », `lotImages` dont les deux premières servent de vignettes au hero, `aboutVideoUrl` lien YouTube/Vimeo). Textes : `heroTitle` accepte « | » pour séparer le titre de sa seconde ligne, `amenities` alimente l'encart du hero, `highlights` les points forts du domaine. Les fichiers de `public/images/demo/` sont des visuels provisoires extraits de la maquette, à remplacer par de vraies photos.
- Composants partagés : `PageHeader`, `StatCard` (`components/admin`), `DataTable` + `SortHeader`, `ToneBadge`, `LotStatusBadge`, `PaymentPlanSummary`, `ScheduleTable`, `Receipt`, `MoneyInput`, `PhoneInput`, `FileDropzone`, `PlanViewer` + `PlanLegend` (`components/plan`), `Carousel` + `SectionHeading` / `SectionLink` (`components/site`).
- Mobile d'abord : toutes les vues doivent fonctionner à 360 px de large.
