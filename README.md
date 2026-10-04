# Centre Imam Malik — Soutien, Formation et Langues

Application de gestion pour le centre Imam Malik : élèves, inscriptions, groupes,
 présences, finances, formations, examens et documents administratifs.

Interface **française et arabe** (bilingue, avec sens d'écriture RTL complet).
Les documents officiels (reçus, attestations, factures, certificats) sont
générés en PDF avec les deux langues sur la même page.

**État : Phase 2B — comptes et paramètres du centre, livrée et vérifiée.** Le
socle est livré (voir [Phase 1](#phase-1--fondation)), puis les écrans élèves,
parents, enseignants, niveaux, matières, services et salles (voir
[Phase 2](#phase-2--personnes-et-catalogue)), puis les comptes
(`/admin/users`) et les paramètres du centre (`/settings`) (voir
[Phase 2B](#phase-2b--comptes-et-paramètres-du-centre)). Le travail est sur
`wip/phase-02b`, **non encore fusionnée dans `master`**, et la porte de qualité
(typecheck, lint, tests, build, bout en bout) y passe intégralement.

Les écrans restants sont **reportés** et n'apparaissent donc nulle part dans
l'interface, plutôt que d'y figurer sous forme de lien mort — c'est le cas du
journal d'audit (`/admin/audit`), reporté à la phase 13 (voir
[Ce qui est reporté](#ce-qui-est-reporté)).

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
| Réinitialiser admin | (script interactif) | `npm run admin:reset` |

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

### Mot de passe administrateur oublié

Un administrateur connecté remet un mot de passe depuis
**Administration → Utilisateurs**. Si plus aucun administrateur ne peut se
connecter, la commande de secours est disponible dans le dossier de
l'installation :

```bash
npm run admin:reset
```

Elle demande l'adresse e-mail puis le nouveau mot de passe **deux fois**, sans
l'afficher, et n'accepte que les comptes `ADMIN`. Comme l'écran, elle impose le
changement à la connexion suivante et ferme toutes les sessions ouvertes ; elle
écrit aussi une entrée `PASSWORD_RESET` dans le journal d'activité, sans le
mot de passe. La commande refuse de travailler sur une base située hors du dossier
`prisma/` du projet.

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
npm run test:unit        # Vitest, projet « unit » seul
npm run test:integration # Vitest, projet « integration » seul
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

### Compte administrateur

`db:seed` **ne crée aucun compte administrateur** : sans identifiants fournis,
il installe seulement les données de référence. Aucun mot de passe par défaut
n'existe dans le dépôt, volontairement.

| Commande | Effet |
| --- | --- |
| `npm run setup` | **La voie normale.** Demande l'e-mail et le mot de passe, les écrit dans `.env`, crée le compte. C'est ce que fait `install.bat`. |
| `npm run db:seed` | Ne crée un administrateur que si `SEED_ADMIN_EMAIL` et `SEED_ADMIN_PASSWORD` sont déjà définis dans l'environnement. |
| `npm run dev:admin` | **Voie de développement uniquement.** Crée un compte local sans passer par les questions de l'installateur. |

```bash
npm run db:seed                      # 1. données de référence
npm run dev:admin                    # 2. compte de développement
```

**Identifiants de développement par défaut :**

| | |
| --- | --- |
| e-mail | `dev@centre-imam-malik.local` |
| mot de passe | `DevAdmin!2026` |

Ouverture d'une session : `npm run dev`, puis <http://localhost:3000/login>.

`dev:admin` accepte d'autres valeurs et réinitialise un compte existant :

```bash
npm run dev:admin -- admin@exemple.tld 'Mot de passe solide'
```

Précautions, appliquées par le script :

- refusé si `NODE_ENV=production` ou `SEED_IS_PRODUCTION_SETUP=true` ;
- refusé si la base visée est hors du dossier `prisma/` du projet ;
- mot de passe validé par la **même** politique que l'application, puis
  haché en bcrypt (coût 12) par le même code ;
- `Ctrl+C` sur le compte précédent n'est pas nécessaire : relancer la commande
  réinitialise le compte.

Ce compte est local : supprimez-le avant tout usage réel.

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

Volumes **actuels**, phases 1, 2 et 2B réunies (les suites ne sont plus
séparées par phase) :

| Suite | Volume | Contenu |
| --- | --- | --- |
| Unitaires (Vitest) | 301 | formatage MAD, validation, permissions, navigation, dictionnaires, erreurs, listes, filtres de liste, schémas comptes et paramètres |
| Intégration (Vitest) | 110 | schéma et seed sur migrations réelles, authentification, personnes, catalogue, comptes, paramètres |
| Bout en bout (Playwright) | 64 | connexion, verrouillage, changement forcé, bascule RTL, tableau de bord vide, phase 2, phase 2B, bannières d'erreur en arabe |

Soit 411 tests Vitest et 64 tests Playwright, tous verts.

`npm test` lance les deux projets Vitest d'un coup. Pour itérer sur un seul,
`npm run test:unit` (301 tests, quelques secondes) ou
`npm run test:integration` (110 tests, base réelle) : c'est la commande à
utiliser quand une erreur vient d'un filtre de liste, d'un dictionnaire ou
d'un message d'erreur, et qu'on veut savoir si le projet concerné est vert
avant de lancer les 64 tests Playwright.

---

## Phase 2 — personnes et catalogue

Livrée sur `wip/phase-02`, **non encore fusionnée dans `master`**.

### Écrans livrés

- **Élèves** (`/students`), **parents** (`/parents`), **enseignants** (`/teachers`)
  : liste, recherche, filtres, tri par colonne, pagination, création et
  modification en boîte de dialogue, désactivation (suppression logique) avec
  confirmation.
- **Structure pédagogique** (`/settings/academics`) : niveaux, matières et
  langues enseignées, par onglets.
- **Services** (`/settings/services`) et **salles** (`/settings/rooms`).

Toutes les listes partagent les mêmes briques (`src/components/list/index.tsx`).
Chaque contrôle est un lien vers la même page avec d'autres paramètres de
requête : rien n'est chargé dynamiquement, la vue est rendue côté serveur, le
bouton « retour » fonctionne et une liste filtrée reste partageable par URL.

Les filtres sont donc écrits à plat dans l'URL (`?status=SUSPENDED`) et relus
depuis elle. L'aller-retour a été cassé en phase 2 : le parseur lisait un objet
imbriqué, chaque liste renvoyait donc ses lignes **sans filtrer** tout en
affichant une URL et un compteur corrects. Le round trip est désormais couvert
des deux côtés — `tests/unit/lists.test.ts` et deux tests de bout en bout qui
pilotent les listes de fusion (`e2e/phase2.spec.ts`, « filtres listes »).

Les messages de validation sont stockés sous forme de **clé**
(`vmsg('firstNameInvalid')`) et traduits au dernier moment, à l'affichage : les
schémas Zod sont analysés deux fois — par le formulaire puis par l'action
serveur — et ne connaissent pas la langue demandée. Un texte figé dans le
schéma s'affichait donc en français sur un formulaire en arabe. Les deux
dictionnaires portent une entrée par règle
(`validation.*`), et `tests/unit/validation-messages.test.ts` vérifie qu'aucune
règle ne retombe sur la phrase anglaise de Zod.

Le même raisonnement vaut pour les **bannières d'erreur**, avec une contrainte
en plus : une Server Action s'exécute hors de toute locale de requête, elle ne
peut donc pas renvoyer une phrase traduite. Elle renvoie un code
(`DUPLICATE`, `RATE_LIMITED`…) et l'action le convertit en clé `errors.*`
(`ekey('duplicate')`), que `Alert` résout au rendu, là où la locale est connue.
La phrase française reste dans `error` et sert de repli si une clé manque : un
résultat non clé affiche un texte au lieu d'une boîte vide. Les 15 bannières
« danger » de la phase 2 portent une clé, `tests/unit/error-messages.test.ts`
vérifie la parité FR/AR et qu'aucune bannière ne réintroduit de phrase en
dur, et trois tests de bout en bout (`e2e/phase2.spec.ts`, « error banners in
Arabic ») exigent qu'un refus de connexion et deux doublons s'affichent en
arabe **sans aucun caractère latin**.

## Phase 2B — comptes et paramètres du centre

Livrée sur `wip/phase-02b`, **non encore fusionnée dans `master`**.

### Écrans livrés

- **Comptes** (`/admin/users`) : liste, recherche, filtres (rôle, état, mot de
  passe temporaire), tri, pagination ; création et modification en boîte de
  dialogue ; changement de rôle ; désactivation réversible ; réinitialisation de
  mot de passe ; lien facultatif vers une fiche enseignant.
- **Paramètres du centre** (`/settings`) : identité, coordonnées, apparence
  (couleurs, logo, fuseau horaire, langue par défaut) et pieds de page des
  documents, sur une seule page.

### Ce que ces deux écrans ont corrigé

Le premier écran **écrit** de l'application : jusqu'ici les sept listes de la
phase 2 ne faisaient que lire. Trois défauts ne sont visibles qu'à ce niveau.

**Un refus ne doit pas coûter la saisie.** React vide un formulaire non contrôlé
quand son action se termine — y compris quand elle se termine par un refus. Une
seule adresse en doublon effaçait le nom, le téléphone et le mot de passe ; un
seul chemin de logo invalide effaçait les vingt champs du centre. Les valeurs
refusées sont donc renvoyées dans l'état de l'action et les champs sont
remontés avec elles, par une clé qui change à chaque refus. **Exception
délibérée : le mot de passe n'est jamais restauré**, pour qu'un secret refusé ne
revienne pas dans la page depuis le serveur.

**Un rôle peut corriger son identité, pas son accès.** Le garde de
`updateUserAction` rejetait toute modification de son propre compte, ce qui
interdisait aussi de corriger un numéro de téléphone mal saisi. Il sort désormais
tôt lorsque ni le rôle ni l'activation ne changent : l'administrateur se corrige
lui-même, mais personne ne peut se retirer son propre rôle ni se désactiver, et le
dernier administrateur actif reste. Le test de bout en bout « corrects its own
details but cannot change its own role » vérifie les deux moitiés.

**Un mot de passe contient deux champs obligatoires.** Chaque écran a des
états qui n'existent que sur une liste — « actif / désactivé », « mot de passe
temporaire », « jamais connecté », « vous » — et la navigation ne les montrait
que pour l'administrateur. `DIRECTEUR` est le seul rôle qui peut **lire** les
comptes et les paramètres sans les **modifier** ; la suite de bout en bout l'utilise
pour vérifier que la même page s'affiche en lecture seule (champs désactivés, pas
de bouton « enregistrer »).

**Deux champs ne peuvent pas porter le même libellé.** Les deux champs de nom du
formulaire de compte s'appelaient « Nom », ce qui annonçait deux champs identiques
et plaçait le message de l'un sous le premier.

**Un champ refusé doit être annoncé.** `Input`, `Textarea` et `Select`
portaient une bordure rouge et rien d'autre : un lecteur d'écran n'apprenait pas
que la valeur avait été refusée. Ils portent maintenant `aria-invalid`.

**Un terme de recherche composé uniquement de jokers SQL ne doit rien lister.**
`searchLiteral()` retire `%`, `_` et `\` du terme ; un terme qui ne contient
alors que des jokers ne correspond à rien, au lieu de renvoyer la liste entière.

### Le reste

`/admin/audit` reste reporté : le journal est **écrit** par
`src/lib/audit.ts` à chaque mutation, seule la lecture manque.

La commande de secours `npm run admin:reset` remet un mot de passe
d'administrateur depuis le shell, pour l'installation où plus aucun compte
administrateur ne peut se connecter. Elle fait ce que fait l'écran — mot de
passe à changer à la prochaine connexion, verrouillage remis à zéro, sessions
ouvertes fermées, entrée `PASSWORD_RESET` au journal sans le secret — refuse un
compte qui n'est pas `ADMIN` et refuse de travailler sur une base hors du dossier
`prisma/` du projet.

---

### Ce qui est reporté

Volontairement **non livré**, et donc **absent de la navigation** plutôt que
présent sous forme de lien mort. Aucun de ces écrans n'a de page : cliquer sur
ces liens aujourd'hui donnerait un 404, c'est précisément pourquoi ils n'ont pas
été livrés à cette phase.

| Écran | Raison | Navigation |
| --- | --- | --- |
| `/admin/audit` (journal d'audit) | **reporté à la phase 13** — seule la lecture manque | `navigation.ts`, `phase: 13` |
| `/admin/backup` (sauvegardes) | **reporté à la phase 13** — la sauvegarde existe déjà en ligne de commande | `navigation.ts`, `phase: 13` |

Le journal d'audit est **déjà écrit** : `src/lib/audit.ts` enregistre chaque
mutation (`recordChange`/`diffFields`) dans les fichiers d'actions. Seule la
lecture manque. Les liens absents sont vérifiés par un test de bout en bout.

`e2e/phase2.spec.ts` échoue si `/admin/audit` ou `/admin/backup` réapparaît dans
la barre latérale, donc ce report est tenu par un test et non par une
convention.

---

## Prochaines phases

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
13. Journal d'audit (lecture), utilisateurs et paramètres du centre
