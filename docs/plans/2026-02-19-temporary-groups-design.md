# Design — Groupes temporaires coach

**Date** : 2026-02-19
**Statut** : Validé

## Contexte

Le coach part en stage avec des nageurs issus de différents groupes permanents. Pendant le stage, il veut assigner des séances à cet ensemble sans que les nageurs reçoivent les assignations de leur groupe d'origine (un autre coach gère ceux restés à domicile). En fin de stage, chaque nageur retrouve son groupe permanent.

## Décisions de design

- **Approche A retenue** : extension de la table `groups` existante avec `is_temporary`, `parent_group_id`, `is_active`
- **Suspension automatique** : un nageur dans un groupe temporaire actif ne voit plus les assignations de son groupe permanent
- **Sous-groupes hiérarchiques** : le coach peut créer des sous-groupes (Jeunes, Confirmés) pour affiner les assignations
- **Historique conservé** : les assignations du stage restent visibles après désactivation
- **Un seul temporaire actif par nageur** : simplifie la logique de suspension

## Modèle de données

### Nouvelles colonnes sur `groups`

```sql
ALTER TABLE groups ADD COLUMN is_temporary boolean NOT NULL DEFAULT false;
ALTER TABLE groups ADD COLUMN parent_group_id integer REFERENCES groups(id) ON DELETE CASCADE;
ALTER TABLE groups ADD COLUMN is_active boolean NOT NULL DEFAULT true;
ALTER TABLE groups ADD COLUMN created_by integer REFERENCES users(id);
```

- `is_temporary = false` : groupe permanent (Elite, Performance, Excellence) — inchangé
- `is_temporary = true, parent_group_id = NULL` : groupe temporaire racine (ex: "Stage Vichy")
- `is_temporary = true, parent_group_id = X` : sous-groupe (ex: "Jeunes" enfant de "Stage Vichy")
- `is_active` : `false` quand le stage est terminé
- `created_by` : coach qui a créé le groupe

### Pas de changement sur `group_members` et `session_assignments`

Les assignations ciblent `groups.id` comme avant. Un groupe temporaire est un groupe normal pour le système d'assignation.

## Logique de suspension

### `fetchUserGroupIdsWithContext(userId)`

Remplace `fetchUserGroupIds`. Une seule requête avec jointure sur `groups` :

```
SELECT group_id, groups.is_temporary, groups.is_active, groups.parent_group_id
FROM group_members
JOIN groups ON groups.id = group_members.group_id
WHERE user_id = :userId
```

Retourne `{ permanentGroupIds, temporaryGroupIds, hasActiveTemporary }`.

Si un sous-groupe est trouvé, son `parent_group_id` est aussi inclus dans `temporaryGroupIds`.

### `getAssignments` modifié

```
Si hasActiveTemporary:
  WHERE target_user_id = :userId
     OR target_group_id IN (:temporaryGroupIds)
Sinon:
  WHERE target_user_id = :userId
     OR target_group_id IN (:permanentGroupIds)
```

Les assignations individuelles (`target_user_id`) sont toujours visibles.

## API — Nouveaux endpoints

### CRUD groupes temporaires

| Fonction | Description |
|----------|-------------|
| `createTemporaryGroup({ name, member_user_ids, parent_group_id? })` | Crée le groupe + insère les members. Vérifie qu'aucun membre n'a déjà un temporaire actif. |
| `deactivateTemporaryGroup(groupId)` | `UPDATE groups SET is_active = false WHERE id = :id OR parent_group_id = :id` |
| `reactivateTemporaryGroup(groupId)` | Inverse. Vérifie que les membres n'ont pas rejoint un autre temporaire entre-temps. |
| `deleteTemporaryGroup(groupId)` | Seulement si `is_active = false`. Cascade via FK. |

### Gestion des membres

| Fonction | Description |
|----------|-------------|
| `addTemporaryGroupMembers(groupId, userIds)` | Vérifie: pas de temporaire actif existant. Pour sous-groupes: membres doivent être dans le parent. |
| `removeTemporaryGroupMember(groupId, userId)` | Retire le membre. Si sous-groupe, retire aussi du sous-groupe. |

### Lecture

| Fonction | Description |
|----------|-------------|
| `getTemporaryGroups()` | Liste tous les groupes temporaires (actifs + inactifs) avec member_count et subgroup_count. |
| `getTemporaryGroupDetail(groupId)` | Membres avec leur groupe permanent d'origine, sous-groupes avec leurs membres. |

### `getGroups()` enrichi

Retourne les groupes temporaires actifs en premier, puis les permanents. Type `GroupSummary` étendu avec `is_temporary`, `is_active`, `parent_group_id`.

## Types

```ts
interface TemporaryGroupSummary {
  id: number;
  name: string;
  is_active: boolean;
  parent_group_id: number | null;
  member_count: number;
  subgroup_count: number;
  created_at: string;
  created_by: number;
}

interface TemporaryGroupDetail {
  id: number;
  name: string;
  is_active: boolean;
  members: Array<{
    user_id: number;
    display_name: string;
    permanent_group_label: string | null;
  }>;
  subgroups: Array<{
    id: number;
    name: string;
    members: Array<{ user_id: number; display_name: string }>;
  }>;
}
```

## UI Coach

### Nouvelle section "Groupes" dans le dashboard

Accessible depuis les Quick Actions et la grille de navigation. `CoachSection` étendu avec `"groups"`.

### Écran principal

Deux sections : Actifs (avec boutons Gérer/Terminer) et Terminés (avec bouton Réactiver).

### Création

Drawer avec nom du groupe + sélecteur de nageurs groupés par groupe permanent (checkboxes).

### Gestion

Affiche les membres (avec leur groupe permanent d'origine), les sous-groupes, et permet d'en créer. La création d'un sous-groupe ne propose que les membres du parent.

### Impact sur CoachAssignScreen

Le sélecteur de groupes affiche les temporaires actifs en premier, sous-groupes indentés sous leur parent, puis les permanents.

## Cas limites

| Cas | Comportement |
|-----|-------------|
| Nageur déjà dans un temporaire actif | Bloqué à la création/ajout. Erreur explicite. |
| Assignation au groupe permanent alors que des nageurs sont en stage | Autorisé. Les nageurs en stage ne la voient pas. |
| Désactivation avec assignations futures | Autorisé. Assignations du temporaire restent visibles + le nageur retrouve son permanent. |
| Suppression d'un groupe temporaire | Uniquement si `is_active = false`. Assignations orphelines disparaissent des résultats. |
| Sous-groupe avec membre hors du parent | Bloqué à la création/ajout. |

## Tests

- `fetchUserGroupIdsWithContext` : sans temporaire, avec temporaire actif, avec inactif, avec sous-groupe
- `createTemporaryGroup` : blocage si nageur déjà dans un temporaire actif
- `deactivateTemporaryGroup` : cascade sur sous-groupes
- `getGroups` enrichi : tri temporaires actifs d'abord

## RLS

```sql
-- Coachs/admins gèrent les groupes temporaires
CREATE POLICY groups_coach_manage ON groups FOR ALL
  USING (app_user_role() IN ('admin', 'coach') OR NOT is_temporary)
  WITH CHECK (app_user_role() IN ('admin', 'coach') AND is_temporary = true);

-- Coachs/admins gèrent les membres des groupes temporaires
CREATE POLICY group_members_coach_manage ON group_members FOR ALL
  USING (user_id = app_user_id() OR app_user_role() IN ('admin', 'coach'))
  WITH CHECK (app_user_role() IN ('admin', 'coach'));
```
