# Design — Web Push Notifications (FCM)

**Date** : 2026-02-28
**Statut** : Approuvé

## Contexte

L'application EAC dispose de notifications in-app (table `notifications` + `notification_targets`) mais aucun canal push externe. Les nageurs ne sont alertés que quand ils ouvrent l'app. Le coach dispose d'un écran SMS qui ouvre simplement l'app SMS native.

**Objectif** : envoyer des notifications push gratuites et illimitées à tous les utilisateurs (nageurs, coachs, admins, comité) via Web Push / Firebase Cloud Messaging.

## Décisions clés

| Décision | Choix |
|---|---|
| Canal | Web Push via FCM (100% gratuit, illimité) |
| Destinataires | Tous les utilisateurs avec un compte |
| Volume estimé | 50-200 messages/mois |
| Budget | 0 € |
| Gate PWA | Écran bloquant sur mobile si l'app n'est pas installée en PWA |
| Desktop | Pas de blocage — l'app fonctionne normalement |
| Rôles bloqués | Tous les rôles sur mobile |

## Alternatives évaluées et rejetées

- **Telegram Bot** : gratuit mais nécessite que chaque nageur installe Telegram (friction d'adoption)
- **WhatsApp Business API** : payant (~0.06€/message en France), incompatible avec la contrainte 0€

## Architecture

```
Coach/trigger auto
     │
     ▼
┌─────────────┐  DB webhook   ┌─────────────┐  FCM HTTP v1   ┌─────┐
│notification_ │ ────────────► │ Edge Function│ ─────────────► │ FCM │
│  targets     │               │  push-send   │                └──┬──┘
└─────────────┘               └─────────────┘                    │
                                    │                             ▼
                              ┌─────────────┐            ┌──────────────┐
                              │ push_tokens │            │Service Worker│
                              │   (table)   │◄───────────│  (navigateur)│
                              └─────────────┘  subscribe └──────────────┘
```

## Composants

### 1. Gate d'installation PWA

Écran plein affiché **avant le login** sur mobile si `display-mode !== standalone` :

- **Détection** : `window.matchMedia('(display-mode: standalone)').matches` || `navigator.standalone`
- **Mobile + pas standalone** → gate bloquante, aucun bypass
- **Desktop OU standalone** → app normale
- **Android** : bouton "Installer l'app" via `beforeinstallprompt`
- **iOS** : instructions visuelles étape par étape (Partager → Sur l'écran d'accueil → Ajouter)

### 2. Table `push_tokens`

```sql
CREATE TABLE push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token text NOT NULL,
  device_info text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, token)
);
CREATE INDEX idx_push_tokens_user_id ON push_tokens(user_id);
```

Un utilisateur peut avoir plusieurs tokens (multi-device).

### 3. Service Worker (`public/sw.js`)

- Écoute `push` events de FCM
- Affiche notification native (titre, corps, icône EAC)
- Gère le clic → ouvre l'app sur la bonne page (ex: `/#/dashboard`)
- S'enregistre auprès de FCM avec la clé VAPID publique

### 4. Edge Function `push-send`

- Déclenchée par database webhook sur INSERT dans `notification_targets`
- Résout les `push_tokens` des destinataires via `user_id`/`group_id`
- Envoie via FCM HTTP v1 API (batch, jusqu'à 500 tokens par requête)
- Supprime les tokens invalides/expirés automatiquement
- Secrets requis : `FIREBASE_SERVICE_ACCOUNT_JSON`

### 5. Composants UI client

| Composant | Rôle |
|---|---|
| `PWAInstallGate` | Écran bloquant sur mobile si pas standalone |
| `PushPermissionBanner` | Après login, demande autorisation push (une fois) |
| Toggle dans Profil | Activer/désactiver les push |

### 6. Triggers automatiques

| Événement | Notification |
|---|---|
| Override créneau (annulation/modification) | "Créneau du [date] annulé/modifié" |
| Nouvelle assignation | "Nouvelle séance assignée pour le [date]" |
| Veille de compétition | "Rappel : [compétition] demain" |
| Entretien à remplir | "Un entretien attend votre contribution" |
| Message libre coach | Contenu personnalisé |

### 7. Prérequis Firebase

1. Créer un projet Firebase (gratuit)
2. Activer Cloud Messaging
3. Générer une clé VAPID (Settings → Cloud Messaging → Web Push certificates)
4. Créer un service account (Settings → Service accounts → Generate new private key)
5. Stocker le JSON du service account dans Supabase secrets
6. Stocker la VAPID public key dans les variables d'environnement Vite (GitHub Secrets pour le build)

## Limitations connues

- iOS : les push ne fonctionnent que si la PWA est installée sur l'écran d'accueil (d'où la gate)
- Desktop : si le navigateur est complètement fermé, pas de notification jusqu'à sa réouverture
- L'utilisateur peut refuser la permission push dans le navigateur — fallback sur les notifications in-app
