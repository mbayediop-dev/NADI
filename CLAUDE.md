@AGENTS.md

# FUTURIA GROUP — gestion de lotissement (dépôt « NADI »)

Application web responsive (pas d'app mobile) : vente et gestion des terrains du lotissement, et **construction de maisons** pour les clients (voir « Construction » plus bas). Trois espaces :

| Espace | Routes | Accès |
| --- | --- | --- |
| Site public (landing, plan interactif, réservation, page « Construction ») | `src/app/(site)/` | libre |
| Espace client (propriétaires et clients d'une construction) | `src/app/espace-client/` | téléphone + code OTP SMS |
| Administration (responsable FUTURIA GROUP) | `src/app/admin/` | e-mail + mot de passe |

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
npm run db:deploy      # applique les migrations en attente — À LANCER AVANT DE POUSSER : la production (Vercel) se redéploie à chaque push et partage cette base
npm run db:seed        # ⚠️ réinitialise la base avec les données de démo
npm run plan:generate  # régénère public/plan/site-plan.svg
npm run db:check       # teste la connexion à la base (DATABASE_URL et DIRECT_URL)
npm run storage:check  # teste le stockage configuré (envoi, lecture, suppression)
npm run storage:sync   # envoie vers le stockage les fichiers référencés en base qui y manquent
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
- **La base est distante (≈ 100 ms par requête)** : jamais de boucle de requêtes dans une transaction (au-delà d'une quarantaine, Prisma abandonne — erreur `P2028` — et rien n'est enregistré). Écritures multiples : `createMany` / `updateMany`, ou une seule requête SQL (voir `updateLotAmounts` dans `terrains/actions.ts`).
- Authentification : pages → `requireAdmin(role?)` / `requireBuyer()` ; actions serveur → `assertAdmin("ADMIN")` (les `VIEWER` sont en lecture seule).
- Actions serveur : fichier `actions.ts` (`"use server"`) à côté de la route, enveloppées dans `run()` et renvoyant `ActionResult` (`@/lib/action`). Erreurs affichables : `throw new UserError("…")`. Côté client : `useServerAction()` (`@/hooks/use-server-action`) gère toasts + `router.refresh()`.
- Journal : `logActivity()` pour toute action métier. SMS : `sendSms(to, body, kind)` (`@/lib/sms`).
- Cachet et signature des reçus : `Settings.signatureKey` (Admin → Paramètres → Entreprise). La photo est détourée dans le navigateur (`cutOutInk`, `@/lib/ink-extract-client` ; algorithme pur dans `@/lib/ink-extract`), stockée en privé (`private/signature/…`) et servie par `/api/signature` aux administrateurs et aux propriétaires connectés uniquement — jamais par une adresse publique.
- Connexion de l'espace client sans SMS : `OTP_TEST_CODE` (6 chiffres) est accepté à la place du code envoyé, uniquement tant que `SMS_PROVIDER=console`. Provisoire : à retirer avant l'ouverture aux vrais propriétaires.
- Calculs financiers **uniquement** via `@/lib/finance` (`resolvePlan`, `buildSchedule`, `summarizeSale`) : les versements s'imputent dans l'ordre des échéances.
- Statut `SOLD` d'un terrain : posé uniquement par la création d'une vente ; l'annulation d'une vente remet le terrain `AVAILABLE`.
- Fichiers : `/api/admin/upload` (client : `uploadFile()`), clés `public/…` servies par `/api/files/…`, clés `private/…` uniquement via `/api/documents/[id]` (contrôle d'accès). Taille maximale : `UPLOAD_MAX_MB` (`@/lib/upload-limits`, 50 Mo = limite du bucket Supabase). Toute écriture de fichier passe par `putObject()` (`@/lib/storage`), y compris dans le seed.
- Libellés et couleurs de statut : `@/lib/labels`. Formatage : `@/lib/format` (`formatMoney`, `formatDate`, `formatArea`…), téléphones : `@/lib/phone` (E.164).

## Construction

Maisons construites par l'entreprise pour ses clients. Trois cas de terrain (`LandOrigin`) : terrain du lotissement (`COMPANY_LOT`, lié à un `Lot`), terrain du client ailleurs (`OWN_LAND`), pas encore de terrain (`NO_LAND`).

- **Parcours** (`ConstructionStatus`) : `REQUESTED` (demande) → `STUDY` → `OFFER_SENT` → `SIGNED` (offre acceptée) → `IN_PROGRESS` → `DELIVERED` ; `SUSPENDED` et `CANCELLED` à part. Versements et passage en chantier exigent un montant de contrat (`isUnderContract`, `@/lib/construction`).
- **Modèle** : `ConstructionProject` (référence `CST-…`) avec `ConstructionQuote` (offres `OFF-…`, lignes en JSON validées par `quoteItemSchema`), `ConstructionPhase` (étapes pondérées par `weight`), `ConstructionInstallment` (appels de fonds), `ConstructionPayment` (reçus `RCC-…`, série distincte des reçus de terrain), `ConstructionUpdate` + `ConstructionMedia` (journal de chantier), `Document.constructionProjectId`. `HouseModel` = catalogue des plans proposés. `Expense` = dépenses, `scope` `SITE` (lotissement) ou `PROJECT` (chantier d'un client).
- **Calculs** : uniquement via `summarizeProject` (`@/lib/construction`), qui réutilise `summarizeSale` pour les versements (imputés dans l'ordre des appels de fonds). Avancement global = moyenne des étapes pondérée (`overallProgress`). Totaux d'une offre : `quoteTotal`.
- **Acceptation d'une offre** : `respondToQuote` (`@/lib/construction-service`) fixe `contractAmount` et passe le projet à `SIGNED` ; même fonction pour l'administration (`answerQuote`) et pour le client (`answerMyQuote`).
- **Routes** : administration `admin/(app)/construction` (liste, `nouveau`, `[id]` à onglets `?onglet=suivi|offre|finances|documents`), `admin/(app)/depenses` (toutes les dépenses), `admin/(app)/modeles` (catalogue), reçu `admin/(print)/construction/versements/[id]/recu` ; espace client `espace-client/(portal)/construction` (+ `[id]`, `recus/[id]`) ; site public `(site)/construction`.
- **Ce que voit le client** : `getBuyerProject` (`@/lib/queries/construction`) est le seul point d'entrée ; il filtre déjà offres en brouillon, dépenses et publications internes (`visibleToClient`, `showExpensesToClient`), documents `PRIVATE` et notes internes. Ne jamais passer un `ProjectDetail` (administration) à un composant de l'espace client.
- **Fichiers privés** : photos du journal → `/api/construction/media/[id]`, justificatifs de dépense → `/api/construction/expenses/[id]`, documents → `/api/documents/[id]` ; chaque route vérifie que le demandeur est administrateur ou le client du projet. Ces images s'affichent avec `<img>` (pas `next/image`, qui les demanderait sans session). Dépôt d'un document par le client : `/api/espace-client/upload` (fichier et fiche créés ensemble, 15 Mo, PDF / image / Word).
- **Demandes publiques** (`createConstructionRequest`) : jamais rattachées d'office à un client existant et réponse identique que le numéro soit connu ou non (pas d'énumération des clients). Le rattachement se fait dans la fiche du projet (« Créer son espace client » → `attachBuyer`). Un client sans terrain accède à l'espace client dès qu'il a un projet non abandonné (`findOwnerByPhone`).
- Composants : `components/admin/construction/*` (administration), `components/portal/construction/*` (client), `QuoteLines` / `ExpenseBreakdown` partagés dans `components/shared/construction-bits`. Libellés : `CONSTRUCTION_STATUS`, `LAND_ORIGIN`, `QUOTE_STATUS`, `EXPENSE_CATEGORY` (`@/lib/labels`). Étapes types d'un chantier : `DEFAULT_PHASES`.
- Non couvert : relances SMS automatiques des appels de fonds (le cron ne traite que les ventes de terrains), export Excel des dépenses, PDF de l'offre.
- Sur une page à sections qui se chargent après l'en-tête, `notFound()` affiche bien la page 404 mais le code HTTP reste 200 : pour tester un contrôle d'accès, vérifier le contenu renvoyé, pas le code.

## Design system

- Marque : FUTURIA GROUP (ex-NADI Group, renommé le 18/11/2026). Nom dans les textes fixes : `BRAND.name` (`@/lib/brand`) ; nom, slogan et coordonnées affichés sur le site : `Settings` (Admin → Paramètres). Les identifiants techniques gardent « nadi » (dossier, paquet, cookies `nadi_*`, bucket, projet Supabase) : ne pas les renommer.
- Couleurs : `primary` / `pine` (marine), `pine-deep` (marine du logo, `#0B1F3A`), `gold` (orange du logo, `#F26B21`) / `gold-strong` (orange foncé, lisible en texte sur fond clair), `sand` (fond gris bleuté), statuts `status-available|reserved|sold|unavailable` (+ `-strong` pour le texte). Les noms `pine`, `gold` et `sand` datent de l'ancienne identité et sont conservés.
- Polices : Manrope (`font-sans`), Source Serif 4 (`font-display`, titres du site public).
- Logo : composant `Logo` (`components/brand/logo`), symbole F + « FUTURIA / GROUP » en tracés vectoriels (`logo-paths.ts`, police Sora convertie en courbes : ne pas retoucher à la main) ; `tone="light"` sur fond sombre. Icônes d'onglet : `src/app/favicon.ico`, `icon.svg`, `apple-icon.png`.
- Site public : maquette de référence fournie par le client (en-tête blanc, hero photo pleine largeur voilée à gauche + chiffres clés + encart « Un cadre de vie idéal », « Le domaine » avec 4 points forts + plan interactif, cartes de terrains en carrousel, actualités du chantier en carrousel, financement en 4 cartes, « Pourquoi choisir » photo/vidéo + engagements, bandeau contact vert avec formulaire en fenêtre, pied de page clair). Arrondis nets (`--radius: 0.5rem`, boutons `rounded-md`).
- Visuels de la rubrique Construction : `public/images/construction/` (rendus 3D du projet d'immeuble et photos de chantier fournis par le client), référencés dans `components/site/construction-section.tsx` ; les visuels des modèles de maisons se téléversent dans Admin → Modèles de maisons.
- Images du site : réglables dans Admin → Paramètres → Site (`heroImageUrl`, `processImageUrl` pour la section « Pourquoi choisir », `lotImages` dont les deux premières servent de vignettes au hero, `aboutVideoUrl` lien YouTube/Vimeo). Textes : `heroTitle` accepte « | » pour séparer le titre de sa seconde ligne, `amenities` alimente l'encart du hero, `highlights` les points forts du domaine. Les fichiers de `public/images/demo/` sont des recadrages de captures vidéo du terrain (netteté moyenne), à remplacer par de vraies photos dès qu'elles existent.
- Composants partagés : `PageHeader`, `StatCard` (`components/admin`), `DataTable` + `SortHeader`, `ToneBadge`, `LotStatusBadge`, `PaymentPlanSummary`, `ScheduleTable`, `Receipt`, `MoneyInput`, `PhoneInput`, `FileDropzone`, `PlanViewer` + `PlanLegend` (`components/plan`), `Carousel` + `SectionHeading` / `SectionLink` (`components/site`).
- Mobile d'abord : toutes les vues doivent fonctionner à 360 px de large.
