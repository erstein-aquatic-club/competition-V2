# IUF Deduplication Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** When an athlete adds their IUF in their profile, automatically detect and merge any manually-added swimmer entry with the same IUF in `club_record_swimmers`, and prevent coaches from adding manual swimmers with already-used IUFs.

**Architecture:** Add a unique partial index on `club_record_swimmers.iuf` (WHERE NOT NULL) in DB. Add dedup logic in `updateProfile()` API function (delete matching manual entry before saving). Add IUF uniqueness validation in `createClubRecordSwimmer()` and `updateClubRecordSwimmer()`.

**Tech Stack:** PostgreSQL migration (Supabase), TypeScript (React/Supabase client)

---

### Task 1: DB Migration — Clean duplicates and add unique index on IUF

**Files:**
- Create: `supabase/migrations/00022_iuf_unique_constraint.sql`

**Step 1: Write the migration SQL**

```sql
-- 00022_iuf_unique_constraint.sql
-- Ensure no two club_record_swimmers share the same IUF.
-- When a duplicate exists (same iuf, one 'user' + one 'manual'), keep the 'user' entry.

-- Step 1: Remove manual duplicates where a user entry already has the same IUF
DELETE FROM club_record_swimmers a
USING club_record_swimmers b
WHERE a.iuf = b.iuf
  AND a.iuf IS NOT NULL
  AND a.source_type = 'manual'
  AND b.source_type = 'user'
  AND a.id <> b.id;

-- Step 2: Remove duplicate manual entries (keep the one with lowest id)
DELETE FROM club_record_swimmers a
USING club_record_swimmers b
WHERE a.iuf = b.iuf
  AND a.iuf IS NOT NULL
  AND a.source_type = 'manual'
  AND b.source_type = 'manual'
  AND a.id > b.id;

-- Step 3: Add partial unique index
CREATE UNIQUE INDEX idx_club_record_swimmers_iuf_unique
ON club_record_swimmers(iuf)
WHERE iuf IS NOT NULL;
```

**Step 2: Apply the migration via Supabase MCP**

Use: `mcp__claude_ai_Supabase__apply_migration` with project_id, name `iuf_unique_constraint`, and the SQL above.

**Step 3: Verify the migration applied**

Use: `mcp__claude_ai_Supabase__list_migrations` to confirm the migration appears in the list.

**Step 4: Commit**

```bash
git add supabase/migrations/00022_iuf_unique_constraint.sql
git commit -m "migration: add unique partial index on club_record_swimmers.iuf"
```

---

### Task 2: API — Add dedup logic when athlete saves IUF in profile

**Files:**
- Modify: `src/lib/api/users.ts:49-73` (updateProfile function)
- Modify: `src/lib/api/records.ts:438-490` (syncClubRecordSwimmersFromUsers function)

**Step 1: Modify `updateProfile()` to detect and delete manual duplicates**

In `src/lib/api/users.ts`, add import for `supabase` at the top (already imported), and modify the `updateProfile` function to check for manual entries with the same IUF before saving, then trigger a sync after:

```typescript
export async function updateProfile(payload: {
  userId?: number | null;
  profile: {
    group_id?: number | null;
    group_label?: string | null;
    birthdate?: string | null;
    objectives?: string | null;
    bio?: string | null;
    avatar_url?: string | null;
    ffn_iuf?: string | null;
  };
}) {
  if (!canUseSupabase()) return { status: "skipped" };
  const userId = payload.userId;
  if (!userId) return { status: "skipped" };

  // If the user is setting an IUF, check for and remove any manual duplicate
  const newIuf = payload.profile.ffn_iuf?.trim() || null;
  if (newIuf) {
    const { data: manualDupes } = await supabase
      .from("club_record_swimmers")
      .select("id")
      .eq("iuf", newIuf)
      .eq("source_type", "manual");
    if (manualDupes && manualDupes.length > 0) {
      const ids = manualDupes.map((d: any) => d.id);
      await supabase
        .from("club_record_swimmers")
        .delete()
        .in("id", ids);
    }
  }

  const { error } = await supabase.from("user_profiles").upsert(
    {
      user_id: userId,
      ...payload.profile,
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);
  return { status: "updated" };
}
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors related to `users.ts`.

**Step 3: Commit**

```bash
git add src/lib/api/users.ts
git commit -m "feat: dedup manual swimmers when athlete saves IUF in profile"
```

---

### Task 3: API — Block creation of manual swimmer with duplicate IUF

**Files:**
- Modify: `src/lib/api/records.ts:163-185` (createClubRecordSwimmer function)

**Step 1: Add IUF uniqueness check in `createClubRecordSwimmer()`**

```typescript
export async function createClubRecordSwimmer(payload: {
  display_name: string;
  iuf?: string | null;
  sex?: "M" | "F" | null;
  birthdate?: string | null;
  is_active?: boolean;
}): Promise<ClubRecordSwimmer | null> {
  if (!canUseSupabase()) return null;

  // Check for existing swimmer with same IUF
  const iuf = payload.iuf?.trim() || null;
  if (iuf) {
    const { data: existing } = await supabase
      .from("club_record_swimmers")
      .select("id, display_name, source_type")
      .eq("iuf", iuf)
      .limit(1);
    if (existing && existing.length > 0) {
      const e = existing[0];
      const label = e.source_type === "user" ? "inscrit" : "déjà ajouté";
      throw new Error(`Un nageur avec cet IUF existe déjà : ${e.display_name} (${label})`);
    }
  }

  const { data, error } = await supabase
    .from("club_record_swimmers")
    .insert({
      source_type: "manual",
      display_name: payload.display_name,
      iuf: iuf,
      sex: payload.sex ?? null,
      birthdate: payload.birthdate ?? null,
      is_active: payload.is_active !== false,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data ? { ...data, is_active: data.is_active ? 1 : 0 } : null;
}
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/lib/api/records.ts
git commit -m "feat: block manual swimmer creation with duplicate IUF"
```

---

### Task 4: API — Block IUF update on manual swimmer if IUF already taken

**Files:**
- Modify: `src/lib/api/records.ts:187-210` (updateClubRecordSwimmer function)

**Step 1: Add IUF uniqueness check in `updateClubRecordSwimmer()`**

```typescript
export async function updateClubRecordSwimmer(
  id: number,
  payload: {
    iuf?: string | null;
    is_active?: boolean;
    sex?: "M" | "F" | null;
    birthdate?: string | null;
  },
): Promise<ClubRecordSwimmer | null> {
  if (!canUseSupabase()) return null;

  // Check for duplicate IUF (exclude self)
  if (payload.iuf !== undefined) {
    const iuf = typeof payload.iuf === "string" ? payload.iuf.trim() : null;
    payload.iuf = iuf || null;
    if (iuf) {
      const { data: existing } = await supabase
        .from("club_record_swimmers")
        .select("id, display_name, source_type")
        .eq("iuf", iuf)
        .neq("id", id)
        .limit(1);
      if (existing && existing.length > 0) {
        const e = existing[0];
        const label = e.source_type === "user" ? "inscrit" : "déjà ajouté";
        throw new Error(`Un nageur avec cet IUF existe déjà : ${e.display_name} (${label})`);
      }
    }
  }

  const updatePayload: Record<string, unknown> = {};
  if (payload.iuf !== undefined) updatePayload.iuf = payload.iuf;
  if (payload.is_active !== undefined) updatePayload.is_active = payload.is_active;
  if (payload.sex !== undefined) updatePayload.sex = payload.sex;
  if (payload.birthdate !== undefined) updatePayload.birthdate = payload.birthdate;
  const { data, error } = await supabase
    .from("club_record_swimmers")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data ? { ...data, is_active: data.is_active ? 1 : 0 } : null;
}
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/lib/api/records.ts
git commit -m "feat: block IUF update if IUF already taken by another swimmer"
```

---

### Task 5: UI — Show proper error messages in RecordsAdmin

**Files:**
- Modify: `src/pages/RecordsAdmin.tsx:262-264` (createSwimmer onError)
- Modify: `src/pages/RecordsAdmin.tsx:274-276` (updateSwimmer onError)

**Step 1: Show the actual error message in the toast for createSwimmer**

In `src/pages/RecordsAdmin.tsx`, update the `createSwimmer` mutation's `onError` handler (line 262):

```typescript
    onError: (err: any) => {
      toast({ title: err?.message || "Impossible d'ajouter le nageur", variant: "destructive" });
    },
```

**Step 2: Show the actual error message in the toast for updateSwimmer**

Update the `updateSwimmer` mutation's `onError` handler (line 274):

```typescript
    onError: (err: any) => {
      toast({ title: err?.message || "Mise à jour impossible", variant: "destructive" });
    },
```

**Step 3: Run type check and build**

Run: `npx tsc --noEmit`
Expected: No errors.

Run: `npm run build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add src/pages/RecordsAdmin.tsx
git commit -m "feat: show duplicate IUF error messages in RecordsAdmin toasts"
```

---

### Task 6: Documentation — Update implementation log and ROADMAP

**Files:**
- Modify: `docs/implementation-log.md`
- Modify: `docs/FEATURES_STATUS.md`

**Step 1: Add implementation log entry**

Add a new section (§37 or next available) to `docs/implementation-log.md`:

```markdown
## §37 — Déduplication IUF profil ↔ nageur manuel

**Contexte :** Quand un athlète entre un IUF qui correspond à un nageur manuel existant dans `club_record_swimmers`, il y avait risque de doublons.

**Changements :**
- Migration `00022_iuf_unique_constraint.sql` : nettoyage des doublons existants + index unique partiel sur `club_record_swimmers.iuf` (WHERE NOT NULL)
- `src/lib/api/users.ts` (`updateProfile`) : détecte et supprime les entrées manuelles avec le même IUF avant sauvegarde
- `src/lib/api/records.ts` (`createClubRecordSwimmer`) : refuse l'ajout si un nageur avec le même IUF existe déjà
- `src/lib/api/records.ts` (`updateClubRecordSwimmer`) : refuse la modification d'IUF si l'IUF est déjà pris
- `src/pages/RecordsAdmin.tsx` : affiche les messages d'erreur de doublon dans les toasts

**Fichiers modifiés :**
- `supabase/migrations/00022_iuf_unique_constraint.sql` (nouveau)
- `src/lib/api/users.ts`
- `src/lib/api/records.ts`
- `src/pages/RecordsAdmin.tsx`

**Tests :** Vérification TypeScript (`npx tsc --noEmit`), build production.

**Décisions :**
- Fusion automatique (pas de validation coach)
- Profil utilisateur prioritaire sur entrée manuelle
- Contrainte DB + logique frontend pour double protection
```

**Step 2: Update FEATURES_STATUS.md if applicable**

Check if there's a relevant entry to mark as ✅ or add one for deduplication.

**Step 3: Commit**

```bash
git add docs/implementation-log.md docs/FEATURES_STATUS.md
git commit -m "docs: add implementation log for IUF deduplication (§37)"
```
