# Sécurité RLS + Import FFN Auto-Sync Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 4 permissive RLS policies, add JWT auth to ffn-sync, then replace ffn-sync with a configurable auto-import via ffn-performances + admin UI.

**Architecture:** Store schedule config in `app_settings` (key `ffn_auto_sync`). A `pg_cron` job runs hourly and checks if current day/hour match the config before calling `import-club-records`. Comp records are reconstructed from `swimmer_performances` via a Postgres view, eliminating `ffn-sync` entirely.

**Tech Stack:** Supabase migrations (SQL), React/TypeScript (admin UI), Edge Functions (Deno)

---

## Part A — RLS Security Quick Wins

### Task 1: Fix permissive RLS policies

**Files:**
- Create: `supabase/migrations/00046_fix_permissive_rls.sql`

**Step 1: Write the migration**

```sql
-- Fix permissive RLS policies identified in security audit
-- See: docs/plans/2026-03-01-rls-security-ffn-auto-sync.md

-- 1. swimmer_performances: INSERT was open to all authenticated users
--    Only Edge Functions (service_role, bypasses RLS) insert here.
DROP POLICY IF EXISTS "swimmer_performances_insert" ON swimmer_performances;
CREATE POLICY "swimmer_performances_insert"
  ON swimmer_performances FOR INSERT
  TO authenticated
  WITH CHECK (app_user_role() IN ('admin', 'coach'));

-- 2. import_logs: INSERT/UPDATE were open to all authenticated users
--    Only Edge Functions (service_role) write here.
DROP POLICY IF EXISTS "import_logs_write" ON import_logs;
DROP POLICY IF EXISTS "import_logs_update" ON import_logs;
CREATE POLICY "import_logs_insert"
  ON import_logs FOR INSERT
  TO authenticated
  WITH CHECK (app_user_role() = 'admin');
CREATE POLICY "import_logs_update"
  ON import_logs FOR UPDATE
  TO authenticated
  USING (app_user_role() = 'admin');

-- 3. app_settings: INSERT/UPDATE were open to all authenticated users
--    Only admin modifies settings (via RecordsAdmin UI).
DROP POLICY IF EXISTS "app_settings_write" ON app_settings;
DROP POLICY IF EXISTS "app_settings_update" ON app_settings;
CREATE POLICY "app_settings_insert"
  ON app_settings FOR INSERT
  TO authenticated
  WITH CHECK (app_user_role() = 'admin');
CREATE POLICY "app_settings_update"
  ON app_settings FOR UPDATE
  TO authenticated
  USING (app_user_role() = 'admin')
  WITH CHECK (app_user_role() = 'admin');

-- 4. strength_folders: INSERT/UPDATE/DELETE were open to all authenticated users
--    Only coaches create/edit/delete folders (StrengthCatalog coach UI).
--    SELECT stays open (athletes read folders to see organized sessions).
DROP POLICY IF EXISTS "Authenticated users can insert folders" ON strength_folders;
DROP POLICY IF EXISTS "Authenticated users can update folders" ON strength_folders;
DROP POLICY IF EXISTS "Authenticated users can delete folders" ON strength_folders;
CREATE POLICY "strength_folders_insert"
  ON strength_folders FOR INSERT
  TO authenticated
  WITH CHECK (app_user_role() IN ('admin', 'coach'));
CREATE POLICY "strength_folders_update"
  ON strength_folders FOR UPDATE
  TO authenticated
  USING (app_user_role() IN ('admin', 'coach'))
  WITH CHECK (app_user_role() IN ('admin', 'coach'));
CREATE POLICY "strength_folders_delete"
  ON strength_folders FOR DELETE
  TO authenticated
  USING (app_user_role() IN ('admin', 'coach'));
```

**Step 2: Apply migration to Supabase**

Use Supabase MCP `apply_migration` tool with project ID.

**Step 3: Verify via Supabase MCP**

Run `execute_sql`:
```sql
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename IN ('swimmer_performances', 'import_logs', 'app_settings', 'strength_folders')
ORDER BY tablename, policyname;
```

Expected: all INSERT/UPDATE/DELETE policies now restricted to admin or coach roles.

**Step 4: Commit**

```bash
git add supabase/migrations/00046_fix_permissive_rls.sql
git commit -m "fix(security): restrict permissive RLS policies on 4 tables"
```

---

## Part B — Comp Records View from swimmer_performances

### Task 2: Create swim_records_comp view

**Files:**
- Create: `supabase/migrations/00047_swim_records_comp_view.sql`

**Step 1: Write the migration**

```sql
-- Create a view that reconstructs competition best times from swimmer_performances.
-- This replaces the need for ffn-sync to write into swim_records for comp records.
-- swim_records is kept for manual training records (record_type = 'training').

CREATE OR REPLACE VIEW swim_records_comp AS
SELECT DISTINCT ON (sp.user_id, sp.event_code, sp.pool_length)
  sp.id,
  sp.user_id                  AS athlete_id,
  sp.event_code               AS event_name,
  sp.pool_length,
  sp.time_seconds,
  sp.competition_date          AS record_date,
  sp.competition_name          AS notes,
  sp.ffn_points,
  'comp'::text                 AS record_type
FROM swimmer_performances sp
WHERE sp.user_id IS NOT NULL
  AND sp.time_seconds IS NOT NULL
  AND sp.time_seconds > 0
ORDER BY sp.user_id, sp.event_code, sp.pool_length, sp.time_seconds ASC;

-- Grant access to authenticated users (view inherits base table RLS)
GRANT SELECT ON swim_records_comp TO authenticated;
```

**Step 2: Apply migration**

Use Supabase MCP `apply_migration`.

**Step 3: Verify**

Run `execute_sql`:
```sql
SELECT count(*) FROM swim_records_comp;
```

Expected: returns rows (same order of magnitude as swim_records WHERE record_type='comp').

**Step 4: Commit**

```bash
git add supabase/migrations/00047_swim_records_comp_view.sql
git commit -m "feat(records): add swim_records_comp view from swimmer_performances"
```

### Task 3: Update getSwimRecords() to use the view for comp mode

**Files:**
- Modify: `src/lib/api/records.ts:350-381` (getSwimRecords function)

**Step 1: Modify getSwimRecords**

Replace the current implementation to use `swim_records_comp` view when fetching competition records:

```typescript
export async function getSwimRecords(options: {
  athleteId?: number | null;
  athleteName?: string | null;
  recordType?: "training" | "comp";
}) {
  if (canUseSupabase()) {
    const table = options.recordType === "comp" ? "swim_records_comp" : "swim_records";
    let query = supabase
      .from(table)
      .select("*")
      .order("record_date", { ascending: false });
    if (options.athleteId) {
      query = query.eq("athlete_id", options.athleteId);
    }
    if (table === "swim_records") {
      // Only filter by record_type on the real table (training records)
      query = query.eq("record_type", "training");
    }
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const records = data ?? [];
    return {
      records,
      pagination: { limit: records.length, offset: 0, total: records.length },
    };
  }

  const records = (localStorageGet(STORAGE_KEYS.SWIM_RECORDS) || []) as any[];
  const filtered = records.filter((r: any) => {
    if (options.athleteId) return r.athlete_id === options.athleteId;
    if (options.athleteName) return r.athlete_name === options.athleteName;
    return false;
  });
  return {
    records: filtered,
    pagination: { limit: filtered.length, offset: 0, total: filtered.length },
  };
}
```

**Step 2: Update Records.tsx to pass recordType**

In `src/pages/Records.tsx`, find the `useQuery` that calls `getSwimRecords` and pass `recordType: swimMode === "comp" ? "comp" : "training"`.

Also update the filtering logic (`filteredSwimRecords` memo around line 497-513) — since records now come pre-filtered by type from the API, remove the client-side `record_type` filter.

**Step 3: Build check**

Run: `npm run build`
Expected: no TypeScript errors.

**Step 4: Commit**

```bash
git add src/lib/api/records.ts src/pages/Records.tsx
git commit -m "feat(records): use swim_records_comp view for competition records"
```

---

## Part C — Remove ffn-sync

### Task 4: Remove ffn-sync Edge Function and client code

**Files:**
- Modify: `src/lib/api.ts:314-328` (remove syncFfnSwimRecords method)
- Modify: `src/pages/Records.tsx:418-439` (remove syncFfnSwimRecords mutation)
- Delete: `supabase/functions/ffn-sync/` (entire directory)

**Step 1: Remove from api.ts**

Delete the `syncFfnSwimRecords` method (lines 314-328 of `src/lib/api.ts`).

**Step 2: Remove from Records.tsx**

Delete the `syncFfnSwimRecords` mutation (lines 418-439) and any UI that references it. The comp tab no longer needs a "Synchro FFN" button since records are derived from the view.

**Step 3: Build check**

Run: `npm run build`
Expected: no errors referencing `syncFfnSwimRecords` or `ffn-sync`.

**Step 4: Commit**

```bash
git add src/lib/api.ts src/pages/Records.tsx
git rm -r supabase/functions/ffn-sync/
git commit -m "refactor(ffn): remove ffn-sync edge function, comp records now from view"
```

---

## Part D — FFN Auto-Sync Configurable

### Task 5: Add ffn_auto_sync setting and admin UI

**Files:**
- Create: `supabase/migrations/00048_ffn_auto_sync_setting.sql`
- Modify: `src/pages/RecordsAdmin.tsx` (add schedule config section)

**Step 1: Write the migration (seed default setting)**

```sql
-- Default FFN auto-sync schedule: Monday 15:00 UTC, enabled
INSERT INTO app_settings (key, value) VALUES
  ('ffn_auto_sync', '{"enabled": true, "day": 1, "hour": 15, "last_run": null}')
ON CONFLICT (key) DO NOTHING;
```

**Step 2: Apply migration**

Use Supabase MCP `apply_migration`.

**Step 3: Add admin UI in RecordsAdmin.tsx**

Inside the existing admin settings `Card` (line 784-836), add a new section for FFN auto-sync schedule. Add state:

```typescript
const [autoSync, setAutoSync] = useState<{
  enabled: boolean;
  day: number;
  hour: number;
  last_run: string | null;
} | null>(null);
```

Load it alongside rateLimits (around line 259-264):

```typescript
void api.getAppSettings("ffn_auto_sync").then((value) => {
  if (value) setAutoSync(value);
});
```

Add save mutation:

```typescript
const saveAutoSync = useMutation({
  mutationFn: (config: { enabled: boolean; day: number; hour: number; last_run: string | null }) =>
    api.updateAppSettings("ffn_auto_sync", config),
  onSuccess: () => {
    toast({ title: "Planning sauvegardé" });
  },
  onError: () => {
    toast({ title: "Erreur de sauvegarde", variant: "destructive" });
  },
});
```

Add UI inside the settings CardContent (after rate limits):

```tsx
{autoSync && (
  <div className="space-y-3 border-t pt-4">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium">Mise à jour auto FFN</p>
        <p className="text-xs text-muted-foreground">
          Import automatique des performances de tous les nageurs actifs
        </p>
      </div>
      <Switch
        checked={autoSync.enabled}
        onCheckedChange={(checked) => setAutoSync({ ...autoSync, enabled: checked })}
      />
    </div>
    {autoSync.enabled && (
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs text-muted-foreground">Jour</label>
          <Select
            value={String(autoSync.day)}
            onValueChange={(v) => setAutoSync({ ...autoSync, day: Number(v) })}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[
                { value: "1", label: "Lundi" },
                { value: "2", label: "Mardi" },
                { value: "3", label: "Mercredi" },
                { value: "4", label: "Jeudi" },
                { value: "5", label: "Vendredi" },
                { value: "6", label: "Samedi" },
                { value: "0", label: "Dimanche" },
              ].map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Heure (UTC)</label>
          <Select
            value={String(autoSync.hour)}
            onValueChange={(v) => setAutoSync({ ...autoSync, hour: Number(v) })}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 24 }, (_, i) => (
                <SelectItem key={i} value={String(i)}>
                  {String(i).padStart(2, "0")}:00
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    )}
    {autoSync.last_run && (
      <p className="text-xs text-muted-foreground">
        Dernière exécution : {formatDateTime(autoSync.last_run)}
      </p>
    )}
    <Button
      size="sm"
      onClick={() => saveAutoSync.mutate(autoSync)}
      disabled={saveAutoSync.isPending}
    >
      Enregistrer
    </Button>
  </div>
)}
```

**Step 4: Build check**

Run: `npm run build`
Expected: no errors.

**Step 5: Commit**

```bash
git add supabase/migrations/00048_ffn_auto_sync_setting.sql src/pages/RecordsAdmin.tsx
git commit -m "feat(admin): add configurable FFN auto-sync schedule"
```

### Task 6: Create pg_cron job for auto-sync

**Files:**
- Create: `supabase/migrations/00049_ffn_auto_sync_cron.sql`

**Step 1: Write the cron migration**

Note: This migration requires `pg_cron` and `pg_net` extensions enabled in Supabase (they are on paid plans). The cron runs hourly and checks `app_settings` to decide if it should fire.

```sql
-- Enable extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Hourly check: if current day/hour match the ffn_auto_sync config, call import-club-records
SELECT cron.schedule(
  'ffn-auto-sync-check',
  '0 * * * *',
  $$
  DO $$
  DECLARE
    v_config jsonb;
    v_project_url text;
    v_service_key text;
  BEGIN
    -- Read config
    SELECT value INTO v_config
    FROM app_settings
    WHERE key = 'ffn_auto_sync';

    -- Skip if disabled or not configured
    IF v_config IS NULL OR (v_config->>'enabled')::boolean IS NOT TRUE THEN
      RETURN;
    END IF;

    -- Check day and hour match
    IF EXTRACT(DOW FROM NOW()) != (v_config->>'day')::int
       OR EXTRACT(HOUR FROM NOW()) != (v_config->>'hour')::int THEN
      RETURN;
    END IF;

    -- Guard against double execution (must be >20h since last run)
    IF v_config->>'last_run' IS NOT NULL
       AND NOW() - (v_config->>'last_run')::timestamptz < INTERVAL '20 hours' THEN
      RETURN;
    END IF;

    -- Read project URL from existing config (same pattern as push trigger)
    v_project_url := current_setting('app.settings.supabase_url', true);
    v_service_key := current_setting('app.settings.service_role_key', true);

    -- If vault settings not available, use the hardcoded project URL
    IF v_project_url IS NULL OR v_project_url = '' THEN
      v_project_url := 'https://fscnobivsgornxdwqwlk.supabase.co';
    END IF;

    -- Call the import-club-records edge function
    PERFORM net.http_post(
      url := v_project_url || '/functions/v1/import-club-records',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(v_service_key, current_setting('supabase.service_role_key', true))
      ),
      body := '{}'::jsonb
    );

    -- Update last_run timestamp
    UPDATE app_settings
    SET value = jsonb_set(value, '{last_run}', to_jsonb(NOW()::text)),
        updated_at = NOW()
    WHERE key = 'ffn_auto_sync';
  END $$;
  $$
);
```

**Step 2: Apply migration**

Use Supabase MCP `apply_migration`. Note: `pg_cron` must be enabled on the project. Check with `list_extensions` first. If not available (free plan), document this as a future enhancement and skip this task.

**Step 3: Verify**

Run `execute_sql`:
```sql
SELECT * FROM cron.job WHERE jobname = 'ffn-auto-sync-check';
```

Expected: 1 row with schedule `0 * * * *`.

**Step 4: Commit**

```bash
git add supabase/migrations/00049_ffn_auto_sync_cron.sql
git commit -m "feat(ffn): add pg_cron hourly job for auto-sync with configurable schedule"
```

---

## Part E — Documentation

### Task 7: Update project documentation

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/implementation-log.md`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/FEATURES_STATUS.md`

**Step 1: Add implementation log entry**

Add entry in `docs/implementation-log.md`:

```markdown
## §80 — Sécurité RLS + Import FFN Auto-Sync (2026-03-01)

### Contexte
Audit complet de l'app a identifié 4 policies RLS trop permissives et l'absence d'auth sur ffn-sync. L'import FFN est restructuré pour utiliser uniquement ffn-performances avec un cron hebdomadaire configurable.

### Changements
1. **RLS Fix** : Resserrement des policies sur swimmer_performances, import_logs, app_settings, strength_folders — accès restreint aux rôles admin/coach
2. **Vue swim_records_comp** : Les records de compétition sont maintenant dérivés de swimmer_performances via une vue Postgres (DISTINCT ON meilleur temps par épreuve)
3. **Suppression ffn-sync** : Edge function et bouton UI supprimés — les records comp viennent de la vue
4. **Auto-sync configurable** : Nouveau paramètre admin (jour/heure) stocké dans app_settings, exécuté via pg_cron qui appelle import-club-records
5. **Admin UI** : Section "Mise à jour auto FFN" ajoutée dans RecordsAdmin avec Switch, sélecteur jour/heure, et affichage dernière exécution

### Fichiers modifiés
- `supabase/migrations/00046_fix_permissive_rls.sql` (nouveau)
- `supabase/migrations/00047_swim_records_comp_view.sql` (nouveau)
- `supabase/migrations/00048_ffn_auto_sync_setting.sql` (nouveau)
- `supabase/migrations/00049_ffn_auto_sync_cron.sql` (nouveau)
- `src/lib/api/records.ts` (getSwimRecords modifié)
- `src/lib/api.ts` (syncFfnSwimRecords supprimé)
- `src/pages/Records.tsx` (mutation ffn-sync supprimée)
- `src/pages/RecordsAdmin.tsx` (UI auto-sync ajoutée)
- `supabase/functions/ffn-sync/` (supprimé)

### Décisions
- Les records d'entraînement (saisie manuelle) restent dans swim_records
- Les records de compétition sont dérivés dynamiquement de swimmer_performances
- Le cron tourne toutes les heures mais ne s'exécute que si jour/heure correspondent à la config admin
- Guard de 20h contre les doubles exécutions
```

**Step 2: Update CLAUDE.md**

Remove `ffn-sync` from the Edge Functions table. Add chantier 43 dans le tableau des chantiers.

**Step 3: Update ROADMAP.md and FEATURES_STATUS.md**

Mark the new chantier as done.

**Step 4: Commit**

```bash
git add CLAUDE.md docs/implementation-log.md docs/ROADMAP.md docs/FEATURES_STATUS.md
git commit -m "docs: add §80 implementation log, update roadmap and features"
```
