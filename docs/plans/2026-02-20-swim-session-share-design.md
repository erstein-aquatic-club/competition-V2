# Design — Partage public de séances natation

**Date** : 2026-02-20
**Statut** : Validé
**Contexte** : Permettre aux coachs et nageurs de partager une séance natation via un lien public, accessible sans compte

## Problème

Les coachs veulent envoyer un lien (WhatsApp, SMS) à des nageurs qui n'ont pas de compte sur l'app pour qu'ils puissent visualiser une séance avant l'entraînement. Actuellement, toutes les routes sont protégées par l'authentification.

## Contraintes

- **Zéro friction** : le destinataire ouvre le lien et voit la séance immédiatement, sans inscription
- **Sécurité** : les IDs catalogue sont séquentiels — un lien par ID permettrait d'énumérer toutes les séances
- **Coût Supabase** : chaque visite = 1 SELECT (négligeable sur le free tier, ~500 requêtes pour 50 nageurs × 10 séances)
- **Mobile first** : le lien sera principalement ouvert sur smartphone

## Design retenu : Token UUID + route publique

### 1. Migration Supabase

- Ajouter `share_token UUID DEFAULT NULL` à `swim_sessions_catalog`
- Index unique partiel sur `share_token` (WHERE NOT NULL)
- Policy RLS anon : SELECT autorisé uniquement sur les sessions avec `share_token IS NOT NULL`
- Policy RLS anon sur `swim_session_items` : SELECT autorisé si le `catalog_id` a un `share_token`

### 2. API (src/lib/api/swim.ts)

Deux nouvelles fonctions :
- `generateShareToken(catalogId)` — UPDATE SET share_token = gen_random_uuid(), retourne le token
- `getSharedSession(token)` — SELECT catalogue + items WHERE share_token = token (utilise supabase anon, pas d'auth requise)

### 3. Route publique

`/#/s/:token` dans App.tsx, ajoutée dans TOUS les blocs de routing (avant et après auth guard) pour être accessible universellement.

### 4. Composant SharedSwimSession

- Parse `:token` depuis l'URL
- Fetch via `getSharedSession(token)` (clé anon)
- Affiche `SwimSessionTimeline` avec les données
- Bandeau fixe en bas : logo club + "Rejoins l'EAC" + bouton → page login/inscription
- États : loading (skeleton), erreur (séance introuvable), succès (timeline)

### 5. Boutons de partage

**SwimCatalog** (coach, dialog preview) :
- Bouton "Partager" dans les actions
- Génère le token si absent, copie l'URL, toast "Lien copié"

**SwimSessionView** (nageur) :
- Bouton "Partager" dans le header
- Récupère le share_token du catalogue lié à l'assignment
- Même logique : copie URL, toast

### 6. UX du partage

1. Clic sur "Partager"
2. Si pas de token → `generateShareToken()` (1 UPDATE)
3. URL construite : `https://erstein-aquatic-club.github.io/competition/#/s/{token}`
4. Si `navigator.share` disponible (mobile) → partage natif
5. Sinon → copie presse-papier + toast "Lien copié !"

## Décisions

- **Token UUID plutôt qu'ID direct** — sécurité (non devinable), révocable (set null)
- **Bandeau fixe plutôt que popup** — moins intrusif, toujours visible
- **Pas d'Edge Function** — la clé anon + RLS suffisent pour le SELECT public
- **navigator.share en priorité sur mobile** — expérience native (WhatsApp, SMS, etc.)
- **Route courte `/#/s/:token`** — URL compacte pour le partage
