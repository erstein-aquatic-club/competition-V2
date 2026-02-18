# Design — PWA Performance Optimization

**Date** : 2026-02-17
**Statut** : Validé

## Contexte

L'application EAC Natation souffre de temps de chargement lents sur mobile. L'audit révèle :
- Charge initiale de ~500K gzip (objectif : <250K)
- RecordsClub = 440K (144K gzip) à cause de jsPDF importé statiquement
- Recharts (117K gzip) modulepreloaded sur toutes les pages malgré usage sur 3 routes lazy
- Service worker artisanal ne cache que 7 fichiers (pas de precaching d'app shell)

## Objectifs

| Métrique | Avant | Cible |
|----------|-------|-------|
| Charge initiale (gzip) | ~500K | <250K |
| RecordsClub chunk (gzip) | 144K | <15K |
| 2e chargement (app shell) | Réseau complet | Cache Workbox |
| Support offline | 7 fichiers | App shell complet |

## Solution

### 1. Fix chunks critiques

**1a. Lazy-load PDF export dans RecordsClub**
- Changer `import { exportRecordsPdf } from "@/lib/export-records-pdf"` (statique)
- En `const { exportRecordsPdf } = await import("@/lib/export-records-pdf")` (dynamique au clic)
- jsPDF + jspdf-autotable restent dans leur propre chunk, chargés uniquement à l'export PDF
- Gain : RecordsClub 440K → ~40K

**1b. Retirer vendor-charts de manualChunks**
- Supprimer `'vendor-charts': ['recharts']` de vite.config.ts
- Laisser Vite auto-split recharts dans les chunks lazy qui l'utilisent
- Recharts ne se charge plus que sur Records/Progress/Administratif
- Gain : -117K gzip sur le chargement initial

**1c. Supprimer dead code chart.tsx**
- `src/components/ui/chart.tsx` importe `* as RechartsPrimitive from "recharts"` mais n'est jamais importé
- Supprimer le fichier

**1d. Retirer vendor-date et vendor-ui de manualChunks**
- date-fns (6K gzip) et 4 composants Radix (27K gzip) sont modulepreloaded inutilement
- Laisser Vite optimiser le splitting automatiquement
- Garder uniquement : vendor-react, vendor-supabase, vendor-query

### 2. Migration vite-plugin-pwa (Workbox)

**2a. Installer et configurer vite-plugin-pwa**
```ts
// vite.config.ts
import { VitePWA } from 'vite-plugin-pwa'

VitePWA({
  registerType: 'autoUpdate',
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
    runtimeCaching: [
      { urlPattern: /^https:\/\/fonts\.googleapis\.com/, handler: 'CacheFirst' },
      { urlPattern: /^https:\/\/fonts\.gstatic\.com/, handler: 'CacheFirst' },
      { urlPattern: /^https:\/\/.*\.supabase\.co\/rest/, handler: 'NetworkFirst' },
      { urlPattern: /^https:\/\/.*\.supabase\.co\/auth/, handler: 'NetworkFirst' },
    ],
  },
  manifest: { /* migrer depuis public/manifest.json */ },
})
```

**2b. Supprimer le SW artisanal**
- Supprimer `public/sw.js`
- Simplifier `src/main.tsx` : retirer la registration manuelle du SW (vite-plugin-pwa injecte la sienne)

**2c. Adapter UpdateNotification**
- vite-plugin-pwa fournit `useRegisterSW()` qui gère les updates automatiquement
- Simplifier ou supprimer `src/components/shared/UpdateNotification.tsx`

### 3. Quick wins réseau

- Ajouter `<link rel="dns-prefetch" href="https://aroyetwrpxjulctuzqlu.supabase.co">` dans index.html
- Ajouter prefetch de routes au survol des liens de navigation (optionnel)

### 4. Non-scope

- **framer-motion** : reste tel quel (déjà lazy, 54K gzip partagé, 11 fichiers à modifier)
- **Recharts** : reste comme lib (on corrige seulement le chargement)
- **vendor-react, vendor-supabase, vendor-query** : restent en manualChunks (essentiels)

## Risques

| Risque | Mitigation |
|--------|-----------|
| Regression visuelle PDF export | Tester l'export PDF après lazy-load |
| Conflit SW ancien/nouveau | Workbox gère la migration automatiquement |
| Cache stale après migration | registerType: 'autoUpdate' force le refresh |
