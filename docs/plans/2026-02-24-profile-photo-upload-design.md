# Design : Upload photo de profil avec compression

**Date** : 2026-02-24
**Statut** : Validé

## Objectif

Permettre aux utilisateurs de déposer une photo de profil depuis leur appareil, compressée automatiquement (max 200 KB) avant stockage dans Supabase Storage.

## Approche

Compression Canvas côté client + Supabase Storage.

### Bucket Supabase Storage : `avatars`

- Public en lecture
- Upload réservé aux utilisateurs authentifiés
- Chemin : `avatars/{user_id}.webp` (1 fichier par user, écrasé à chaque update)

### Compression côté client (`compressImage`)

- Accepte JPEG, PNG, WebP, HEIC
- Redimensionne à max 400x400px
- Convertit en WebP (fallback JPEG si non supporté)
- Qualité ajustée pour rester sous 200 KB

### UI (bottom sheet profil existant)

- Remplacement du champ "Avatar (URL)" par un bouton d'upload avec preview
- Preview circulaire de la photo sélectionnée
- Indicateur de progression pendant l'upload
- Bouton "Supprimer" pour revenir au fallback DiceBear

### Flux

```
[Sélection fichier] → [Compression canvas 400x400 WebP ≤200KB]
  → [Upload Supabase Storage avatars/{user_id}.webp]
  → [Récupération URL publique]
  → [Sauvegarde avatar_url dans user_profiles]
```

## Fichiers impactés

| Fichier | Modification |
|---------|-------------|
| `src/lib/imageUtils.ts` | Nouveau — utilitaire `compressImage()` |
| `src/pages/Profile.tsx` | Remplacement champ URL par upload + preview |
| `src/lib/api/users.ts` | Ajout `uploadAvatar()` et `deleteAvatar()` |
| `src/lib/api/index.ts` | Re-export |
| `src/lib/api.ts` | Façade : ajout stubs |
| Migration SQL | Création bucket `avatars` + RLS policies |

## Ce qui ne change PAS

- `avatar_url` dans `user_profiles` reste un string URL
- Fallback DiceBear inchangé
- Composant Avatar Radix inchangé
