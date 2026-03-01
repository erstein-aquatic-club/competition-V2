# Audit Remaining Items — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix CORS, create missing migrations, drop legacy tables, atomic strength RPC, add pagination to long lists, complete coach deep linking.

**Tech Stack:** Supabase Edge Functions (Deno), PostgreSQL, React 19, TypeScript, Tailwind CSS 4

---

## Task 1: Restrict CORS to production domain (S3)

**Files:**
- Create: `supabase/functions/_shared/cors.ts`
- Modify: `supabase/functions/admin-user/index.ts`
- Modify: `supabase/functions/ffn-performances/index.ts`
- Modify: `supabase/functions/import-club-records/index.ts`
- Modify: `supabase/functions/push-send/index.ts`

Create shared CORS config restricted to production domain `https://erstein-aquatic-club.github.io`. Update all 4 edge functions to import from shared. Deploy all functions.

---

## Task 2: Missing table migrations (S4)

Create migration with `CREATE TABLE IF NOT EXISTS` for: competitions, competition_assignments, objectives, planned_absences, app_settings, avatars. Extract current DDL from production DB.

---

## Task 3: Drop legacy tables (R17)

Create migration to drop `dim_seance`, `dim_seance_deroule`, `auth_login_attempts`. Remove from `src/lib/schema.ts`.

---

## Task 4: Atomic strength session RPC (R12)

Create migration with `update_strength_session_atomic()` PL/pgSQL function. Update `src/lib/api/strength.ts` to call RPC instead of 3 sequential queries.

---

## Task 5: Pagination for long lists (R15)

Add "Load more" pagination to:
- Admin.tsx users table (cap at 50, load more button)
- SwimCatalog.tsx session list (cap at 50, load more)
- CoachSwimmersOverview.tsx (cap at 50, load more)

---

## Task 6: Coach deep linking completion (R16)

Ensure Coach.tsx updates the URL hash when switching sections via internal pills (not just bottom nav). Verify URL is persisted and restored on refresh.

---

## Task 7: Documentation update

Update implementation-log.md, FEATURES_STATUS.md, ROADMAP.md, CLAUDE.md.
