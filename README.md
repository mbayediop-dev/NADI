# NADI Group — Gestion de lotissement

Application web responsive (ordinateur, tablette, mobile) pour commercialiser et gérer le site de 4 hectares de NADI Group.

- **Site public** : accueil (`/`) avec présentation du domaine, plan, terrains mis en avant, processus d'achat, avancement et contact ; page **Nos terrains** (`/terrains`) avec le plan interactif complet, les filtres, la fiche de chaque lot (surface, prix, sol, position, acompte, nombre et périodicité des versements), la réservation, les documents et la FAQ ; mentions légales et confidentialité.
- **Espace client** (`/espace-client`) : connexion par numéro de téléphone + code reçu par SMS (réservée aux propriétaires enregistrés), suivi du terrain, échéancier, versements et reçus, documents, photos et vidéos du chantier.
- **Administration** (`/admin`) : tableau de bord et statistiques, plan du site (avec éditeur des contours de lots), terrains (édition unitaire, actions groupées, import/export Excel), demandes de réservation, acheteurs, ventes (attribution d'un terrain, avec ou sans acompte, échéancier personnalisé), versements et reçus, relances SMS, avancement des travaux (photos, vidéos), documents, paramètres (entreprise, page d'accueil, modalités par défaut, champs personnalisés, SMS, utilisateurs).

## Démarrage en local

Prérequis : Node.js 20.9+ et un projet [Supabase](https://supabase.com) (base PostgreSQL + Storage).

```bash
cp .env.example .env          # puis renseigner DATABASE_URL, DIRECT_URL, SUPABASE_* et SESSION_SECRET (openssl rand -hex 32)
npm install
npm run db:deploy             # crée les tables sur Supabase
npm run db:seed               # (facultatif) données de démonstration — EFFACE la base
npm run dev                   # http://localhost:3000
```

Dans le tableau de bord Supabase : **Connect → ORMs → Prisma** donne `DATABASE_URL` (pooler, port 6543) et `DIRECT_URL`
(port 5432) ; **Project Settings → API** donne `SUPABASE_URL` et la clé `service_role` (jamais exposée au navigateur).
Le bucket Storage (`SUPABASE_STORAGE_BUCKET`, privé) doit exister dans le projet Supabase. `npm run storage:check` vérifie l'envoi, la lecture
et la suppression d'un fichier test ; `npm run db:check` vérifie la connexion à la base.

Sans Supabase, n'importe quel PostgreSQL 15+ convient (`DATABASE_URL` seul) avec `STORAGE_DRIVER=local` :
`brew services start postgresql@17 && createdb nadi`, puis `DATABASE_URL="postgresql://<votre-utilisateur>@localhost:5432/nadi?schema=public"`.

### Comptes de démonstration (après `npm run db:seed`)

| Espace | Identifiant |
| --- | --- |
| Administration | `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` (par défaut `admin@nadigroup.sn` / `Nadi2026!`) |
| Espace client | `+221 77 123 45 01` (Aminata Diop) — en mode `SMS_PROVIDER=console`, le code s'affiche à l'écran (« Mode démo ») et dans le terminal ; un code fixe de test peut être défini avec `OTP_TEST_CODE` (voir `.env.example`) |

Toutes les données de démonstration (nom du site, prix, acheteurs, actualités…) sont **fictives** et se remplacent depuis l'administration. Les photos de `public/images/demo/` sont des visuels provisoires (extraits de la maquette, en basse résolution) : remplacez-les par de vraies photos du domaine dans **Administration → Paramètres → Site et page d'accueil** et dans les actualités du chantier. Sans données de démo, la première visite de `/admin/login` propose de créer le compte du responsable.

## Mise en production

1. **Base PostgreSQL** : le projet Supabase (`DATABASE_URL` + `DIRECT_URL`), puis `npm run db:deploy`. Tout autre PostgreSQL managé (Neon, Railway, Scaleway, OVH…) fonctionne aussi.
2. **Variables** : voir `.env.example` (`APP_URL`, `SESSION_SECRET`, SMS, stockage, `CRON_SECRET`).
3. **SMS** (obligatoire pour l'espace client) :
   - `SMS_PROVIDER=orange` : Orange SMS API (Sénégal, Côte d'Ivoire…), créer une application sur developer.orange.com et acheter un bundle SMS ;
   - `SMS_PROVIDER=twilio` : compte Twilio.
4. **Fichiers** (photos, vidéos, documents) :
   - `STORAGE_DRIVER=supabase` (recommandé) : bucket privé Supabase Storage, fichiers servis par l'application avec contrôle d'accès ;
   - serveur avec disque persistant (VPS) : `STORAGE_DRIVER=local` et un `STORAGE_LOCAL_DIR` sauvegardé ;
   - `STORAGE_DRIVER=s3` : tout service compatible S3 (Cloudflare R2, Amazon S3…).

   Après un changement de pilote, `npm run storage:sync` envoie vers le nouveau stockage les fichiers référencés en base qui n'y sont pas encore
   (`npm run storage:sync -- --check` pour un simple contrôle). Taille maximale d'un envoi : `NEXT_PUBLIC_UPLOAD_MAX_MB` (50 Mo par défaut, limite du bucket Supabase).
5. **Rappels automatiques** : appeler une fois par jour
   `GET https://<votre-domaine>/api/cron/reminders` avec l'en-tête `Authorization: Bearer <CRON_SECRET>`
   (cron Vercel, cron système, ou service type cron-job.org).
6. Build et lancement : `npm run build && npm start`.

## Points d'attention

- Le statut « Vendu » d'un terrain est posé uniquement par l'enregistrement d'une vente ; l'annulation d'une vente remet le terrain en vente.
- Les versements s'imputent automatiquement dans l'ordre des échéances (acompte, puis échéance 1, 2…).
- Le plan de démonstration (`public/plan/site-plan.svg`) se remplace par le vrai plan du géomètre depuis **Administration → Plan du site** ; les contours des lots se redessinent ensuite dans l'éditeur.
- Rôles administrateurs : *Responsable* (tout, y compris les utilisateurs), *Gestionnaire* (tout sauf les utilisateurs), *Lecture seule*.

Documentation technique et conventions de code : [CLAUDE.md](CLAUDE.md).
