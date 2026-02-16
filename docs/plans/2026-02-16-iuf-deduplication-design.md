# Design : Déduplication IUF athlète ↔ nageur manuel

**Date :** 2026-02-16
**Contexte :** Quand un athlète ajoute son IUF dans sa page profil, il faut vérifier s'il correspond à un nageur ajouté manuellement dans RecordsAdmin et fusionner les deux entrées pour éviter les doublons dans `club_record_swimmers`.

## Problème

- Un coach ajoute manuellement un nageur sur RecordsAdmin (ex: "Jean Dupont", IUF "879576", `source_type='manual'`)
- Plus tard, ce même nageur crée un compte et entre son IUF "879576" dans sa page profil
- `syncClubRecordSwimmersFromUsers()` crée une **deuxième** entrée dans `club_record_swimmers` avec `source_type='user'` et le même IUF
- Pas de contrainte d'unicité sur `club_record_swimmers.iuf` → doublons possibles

## Décisions

- **Fusion automatique** : pas de validation coach nécessaire
- **Déclencheur** : au moment du save du profil par l'athlète
- **Priorité données** : le profil utilisateur authentifié écrase l'entrée manuelle
- **Cas inverse** : bloquer l'ajout manuel d'un nageur avec un IUF déjà pris par un utilisateur authentifié

## Approche retenue : Contrainte DB + logique frontend

### 1. Migration DB

```sql
-- Nettoyer les doublons existants (garder l'entrée 'user' si doublon)
DELETE FROM club_record_swimmers a
USING club_record_swimmers b
WHERE a.iuf = b.iuf
  AND a.iuf IS NOT NULL
  AND a.source_type = 'manual'
  AND b.source_type = 'user';

-- Contrainte unique partielle
CREATE UNIQUE INDEX idx_club_record_swimmers_iuf_unique
ON club_record_swimmers(iuf) WHERE iuf IS NOT NULL;
```

### 2. Au save du profil (Profile.tsx → API)

Quand un athlète sauvegarde un IUF dans `updateProfile()` :

1. Requêter `club_record_swimmers` : chercher une entrée `source_type='manual'` avec le même IUF
2. Si une entrée manuelle existe → la supprimer
3. Sauvegarder le profil normalement
4. Appeler `syncClubRecordSwimmersFromUsers()` pour créer/mettre à jour l'entrée `source_type='user'` immédiatement

**Fichiers modifiés :** `src/lib/api/users.ts` (updateProfile), `src/lib/api/records.ts`

### 3. À l'ajout manuel (RecordsAdmin)

Quand un coach ajoute un nageur manuel avec un IUF :

1. Avant l'insert, vérifier si une entrée existe déjà avec cet IUF
2. Si oui → erreur toast "Un nageur avec cet IUF existe déjà (Nom)"
3. Sinon → insérer normalement

**Fichiers modifiés :** `src/lib/api/records.ts` (createClubRecordSwimmer), `src/pages/RecordsAdmin.tsx`

### 4. Modification d'IUF sur nageur manuel

Si un coach modifie l'IUF d'un nageur manuel dans RecordsAdmin :
- Même vérification : si le nouvel IUF est déjà pris → erreur
- La contrainte DB protège de toute façon

**Fichier modifié :** `src/lib/api/records.ts` (updateClubRecordSwimmer)

### 5. Aucun changement nécessaire sur

- Edge functions (import par IUF, transparent)
- `swimmer_performances` (liées par IUF)
- `club_records` / recalculation (swimmerMap par IUF, une seule entrée)
