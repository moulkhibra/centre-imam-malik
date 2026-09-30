# Centre Imam Malik — Soutien, Formation et Langues

Application de gestion pour le centre Imam Malik : élèves, inscriptions, groupes,
 présences, finances, formations, examens et documents administratifs.

Interface **française et arabe** (bilingue, avec sens d'écriture RTL complet).
Les documents officiels (reçus, attestations, factures, certificats) sont
générés en PDF avec les deux langues sur la même page.

**État : Phase 1 — fondation.** Le socle est livré et testé (voir
[Phase 1](#phase-1--fondation)). Les modules métier seront ajoutés phase par
phase ; tant qu'un écran n'existe pas, il n'apparaît nulle part dans l'interface
(plutôt que d'y mettre un lien mort).

---

## Installation

### Windows

Double-cliquez sur **`install.bat`**.

### Linux / macOS

```bash
./install.sh
```

L'installateur vérifie Node.js 22, génère un secret de session, applique les
migrations, installe les données de référence et crée le compte
administrateur. Il est **idempotent** : le relancer ne détruit jamais les
données existantes.

> Node.js 22 LTS est requis. Téléchargement : https://nodejs.org

### Utilisation quotidienne

| Action | Windows | Linux / macOS |
| --- | --- | --- |
| Démarrer | `start.bat` | `./start.sh` |
| Arrêter | `stop.bat` | `Ctrl+C` dans le terminal |
| Sauvegarder | `backup.bat` | `./backup.sh` |
| Restaurer | `backup.bat --restore <fichier>` | `./backup.sh --restore <fichier>` |

L'adresse et le port d'écoute sont ceux saisis à l'installation (fichier `.env`).
Le premier démarrage compile l'application ; les suivants démarrent
immédiatement.

### Sauvegarde

`backup.sh` prend une **copie cohérente à chaud** de la base (API de sauvegarde
SQLite, pas une copie du fichier), y joint les documents déposés et les
migrations, et conserve les 30 archives les plus récentes. Elle est sans risque
pendant que le centre utilise l'application.

```bash
npm run backup                  # créer une sauvegarde
npm run backup -- --list       # lister les sauvegardes
npm run backup -- --restore backups/cim-....tar.gz
```

Restaurez toujours l'application **arrêtée** : le fichier de base est remplacé,
et une copie de sécurité horodatée est conservée à côté.

---

## Configuration

Tout est défini dans `.env`, créé à l'installation :

| Variable | Rôle |
| --- | --- |
| `DATABASE_URL` | base SQLite |
| `SESSION_SECRET` | secret de signature des cookies (96 caractères aléatoires) |
| `HOSTNAME` / `PORT` | adresse et port d'écoute |
| `APP_URL` | URL publique (HTTPS → cookie `secure`) |
| `DEFAULT_LOCALE` | `fr` ou `ar` |
| `SEED_*` | identité du centre et du compte administrateur |

`SESSION_SECRET` n'a **jamais** de valeur par défaut : s'il est absent ou trop
court, l'application refuse de démarrer.

---

## Développement

```bash
npm install
npm run dev          # http://localhost:3000
```

### Contrôles

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm test             # Vitest : unitaire + intégration
npm run test:e2e     # Playwright : bout en bout
npm run verify:pdf   # vérification du PDF arabe
npm run build        # build de production
```

### Base de données

```bash
npm run db:generate      # régénérer le client Prisma
npm run db:migrate       # appliquer les migrations
npm run db:seed          # données de référence
```

Le client Prisma est généré dans `src/generated/` et **n'est pas versionné** :
il est recréé automatiquement par `npm install` (`postinstall`).

---

## Phase 1 — fondation

Livré, testé et commité (`phase-01-foundation`).

### Base de données

Schéma complet du centre (42 modèles) : centres, élèves, parents, enseignants,
groupes, inscriptions, présences, séances, factures, paiements, reçus, dépenses,
caisse, formations, examens, notes, certificats, documents, notifications,
journal d'audit, paramètres. Une migration unique est appliquée par
`prisma migrate deploy` — jamais de `db push` en production.

L'installateur ne charge que des **données de référence** (matières, niveaux,
services, année scolaire, moyens de paiement, catégories de dépenses). Aucun
élève, paiement ou montant n'est fabriqué : la base démarre vide et l'interface
l'assume honnêtement.

### Comptes et sécurité

- Session par cookie signé, expiration, déconnexion, verrouillage après 5 échecs.
- Mot de passe haché avec **scrypt** (bibliothèque native, pas de hachage maison).
- Politique de mot de passe + changement forcé au premier accès.
- 50 permissions, 4 rôles (`ADMIN`, `DIRECTEUR`, `SECRETARY`, `TEACHER`).
  Les permissions du rôle constituent la base ; les accords stockés s'y ajoutent.

### Interface

Dictionnaires FR et AR complets, direction RTL réelle, nom du centre affiché
dans la langue active. Navigation limitée aux modules livrés, contrôles de
l'interface conditionnels : aucun lien mort, aucun bouton inerte.

### Documents PDF

`@react-pdf/renderer` + police **Cairo** (3 graisses), génération côté serveur.
`npm run verify:pdf` inspecte les octets produits et exige **13/13** contrôles,
dont une relecture par un lecteur tiers (`pdftotext`).

Les deux échecs du tout premier contrôle étaient des défauts du *script de
vérification*, pas du PDF : l'opérateur `Tr` est le mode de rendu du texte (PDF
n'a pas d'opérateur de direction) et le motif de page A4 ne gérait pas la
précision d'écriture réelle. Voir [`docs/adr/0001-pdf-library.md`](docs/adr/0001-pdf-library.md),
qui documente aussi la limite connue : un PDF se **lit**, il ne se parse pas.

### Tests

| Suite | Volume | Contenu |
| --- | --- | --- |
| Unitaires (Vitest) | 93 | formatage MAD, validation, permissions, navigation, dictionnaires |
| Intégration (Vitest) | 42 | schéma et seed sur migrations réelles, authentification |
| Bout en bout (Playwright) | 15 | connexion, verrouillage, changement forcé, bascule RTL, tableau de bord vide |

---

## Prochaines phases

2. Élèves, parents, enseignants, utilisateurs, paramètres
3. Groupes, inscriptions, emplois du temps
4. Présences et justifications
5. Finances : facturation, paiements, reçus, caisse, dépenses
6. Formations et participants
7. Examens, notes, certificats
8. Documents et GED
9. Rapports et tableau de bord analytique
10. Notifications
11. Traduction arabe complète du contenu dynamique
12. Sauvegardes et restauration automatisées
13. Journal d'audit et cloisonnement par centre
