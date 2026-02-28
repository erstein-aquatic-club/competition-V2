# Web Push Notifications — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Send free push notifications to all EAC app users via standard Web Push (VAPID), with a mandatory PWA install gate on mobile.

**Architecture:** Pure Web Push with VAPID keys (no Firebase SDK). The existing Workbox service worker gets a push handler via `importScripts`. A Supabase Edge Function sends push messages triggered by a database webhook on `notification_targets`. Mobile users are required to install the PWA before accessing the app.

**Tech Stack:** Web Push API, VAPID, Workbox (existing), Supabase Edge Functions (Deno), `npm:web-push`, Supabase database webhooks.

**Design doc:** `docs/plans/2026-02-28-web-push-notifications-design.md`

---

## Task 1: PWA detection helpers

**Files:**
- Create: `src/lib/pwaHelpers.ts`
- Create: `src/lib/__tests__/pwaHelpers.test.ts`

**Step 1: Write tests for PWA detection helpers**

```ts
// src/lib/__tests__/pwaHelpers.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

// We test the pure logic functions; browser APIs are mocked per test
import { detectPlatform, shouldShowInstallGate } from "@/lib/pwaHelpers";

test("detectPlatform returns 'ios' for iPhone user agent", () => {
  assert.equal(
    detectPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"),
    "ios"
  );
});

test("detectPlatform returns 'android' for Android user agent", () => {
  assert.equal(
    detectPlatform("Mozilla/5.0 (Linux; Android 14; Pixel 8)"),
    "android"
  );
});

test("detectPlatform returns 'desktop' for desktop user agent", () => {
  assert.equal(
    detectPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"),
    "desktop"
  );
});

test("shouldShowInstallGate returns true for mobile + not standalone", () => {
  assert.equal(shouldShowInstallGate("ios", false), true);
  assert.equal(shouldShowInstallGate("android", false), true);
});

test("shouldShowInstallGate returns false for desktop", () => {
  assert.equal(shouldShowInstallGate("desktop", false), false);
  assert.equal(shouldShowInstallGate("desktop", true), false);
});

test("shouldShowInstallGate returns false for mobile + standalone", () => {
  assert.equal(shouldShowInstallGate("ios", true), false);
  assert.equal(shouldShowInstallGate("android", true), false);
});
```

**Step 2: Run tests — verify they fail**

```bash
npm test -- src/lib/__tests__/pwaHelpers.test.ts
```
Expected: FAIL (module not found)

**Step 3: Implement helpers**

```ts
// src/lib/pwaHelpers.ts

export type Platform = "ios" | "android" | "desktop";

export function detectPlatform(userAgent: string): Platform {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return "desktop";
}

export function isStandalone(): boolean {
  if ("standalone" in navigator && (navigator as any).standalone) return true;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  return false;
}

export function shouldShowInstallGate(
  platform: Platform,
  standalone: boolean
): boolean {
  if (platform === "desktop") return false;
  return !standalone;
}
```

**Step 4: Run tests — verify they pass**

```bash
npm test -- src/lib/__tests__/pwaHelpers.test.ts
```
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/pwaHelpers.ts src/lib/__tests__/pwaHelpers.test.ts
git commit -m "feat(push): add PWA platform detection helpers with tests"
```

---

## Task 2: PWA Install Gate component

**Files:**
- Create: `src/components/shared/PWAInstallGate.tsx`
- Reference: `src/components/shared/LoginInstallBanner.tsx` (pattern to follow for `beforeinstallprompt`)

**Step 1: Create the gate component**

This is a full-screen blocking component. When `shouldShowInstallGate()` returns true, it renders instead of the app.

```tsx
// src/components/shared/PWAInstallGate.tsx
import { useEffect, useState } from "react";
import { Share, Plus, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { detectPlatform, isStandalone, shouldShowInstallGate } from "@/lib/pwaHelpers";

export function PWAInstallGate({ children }: { children: React.ReactNode }) {
  const [showGate, setShowGate] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop">("desktop");
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const p = detectPlatform(navigator.userAgent);
    setPlatform(p);
    setShowGate(shouldShowInstallGate(p, isStandalone()));

    const handlePrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handlePrompt);

    // Re-check standalone on display-mode change (after install)
    const mq = window.matchMedia("(display-mode: standalone)");
    const onChange = () => {
      if (mq.matches) setShowGate(false);
    };
    mq.addEventListener("change", onChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", handlePrompt);
      mq.removeEventListener("change", onChange);
    };
  }, []);

  if (!showGate) return <>{children}</>;

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowGate(false);
    }
    setDeferredPrompt(null);
  };

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background p-6 text-center">
      <img
        src={`${import.meta.env.BASE_URL}logo-eac-256.webp`}
        alt="EAC Natation"
        className="h-24 w-24 mb-8"
      />
      <h1 className="text-2xl font-bold text-foreground mb-2">
        EAC Natation
      </h1>
      <p className="text-muted-foreground mb-8 max-w-xs">
        Pour utiliser l'application, veuillez l'installer sur votre téléphone.
      </p>

      {platform === "android" && deferredPrompt ? (
        <Button size="lg" onClick={handleInstall} className="gap-2 mb-6">
          <Download className="h-5 w-5" />
          Installer l'application
        </Button>
      ) : platform === "android" ? (
        <div className="rounded-xl border bg-muted/50 p-5 max-w-xs mb-6 text-left space-y-3">
          <p className="text-sm font-medium text-foreground">
            Pour installer :
          </p>
          <p className="text-sm text-muted-foreground">
            Ouvrez le menu{" "}
            <span className="font-bold text-foreground text-lg leading-none">&#8942;</span>{" "}
            de votre navigateur, puis appuyez sur{" "}
            <span className="font-semibold text-foreground">
              « Ajouter à l'écran d'accueil »
            </span>
          </p>
        </div>
      ) : (
        /* iOS instructions */
        <div className="rounded-xl border bg-muted/50 p-5 max-w-xs mb-6 text-left space-y-4">
          <p className="text-sm font-medium text-foreground">
            Pour installer sur iPhone :
          </p>
          <ol className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
              <span>
                Appuyez sur{" "}
                <Share className="inline h-4 w-4 -mt-0.5 text-primary" />{" "}
                <span className="font-semibold text-foreground">Partager</span>{" "}
                en bas de l'écran
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
              <span>
                Faites défiler et appuyez sur{" "}
                <span className="inline-flex items-center gap-0.5 font-semibold text-foreground">
                  <Plus className="inline h-3.5 w-3.5" />
                  Sur l'écran d'accueil
                </span>
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">3</span>
              <span>
                Confirmez en appuyant sur{" "}
                <span className="font-semibold text-foreground">Ajouter</span>
              </span>
            </li>
          </ol>
        </div>
      )}

      <p className="text-xs text-muted-foreground/60 max-w-xs">
        L'installation permet de recevoir les notifications et d'accéder à l'app en plein écran.
      </p>
    </div>
  );
}
```

**Step 2: Visually verify** — The component can only be properly tested on a mobile device or emulator. No automated test for UI layout.

**Step 3: Commit**

```bash
git add src/components/shared/PWAInstallGate.tsx
git commit -m "feat(push): add PWA install gate component for mobile"
```

---

## Task 3: Integrate PWA Install Gate in App.tsx

**Files:**
- Modify: `src/App.tsx` (lines ~295-306, the `App()` function return)

**Step 1: Wrap the App return in PWAInstallGate**

In `src/App.tsx`, import and wrap the entire app in the gate:

```tsx
// Add import at top of file
import { PWAInstallGate } from "@/components/shared/PWAInstallGate";

// In App() function, wrap the return:
return (
  <PWAInstallGate>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <UpdateNotification />
        <Toaster />
        <Router hook={useHashLocation}>
          <AppRouter />
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  </PWAInstallGate>
);
```

**Step 2: Verify build compiles**

```bash
npx tsc --noEmit
```

**Step 3: Test locally** — On desktop `npm run dev`, the gate should NOT appear. Test with Chrome DevTools mobile emulation to verify the gate appears.

**Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(push): integrate PWA install gate in App root"
```

---

## Task 4: VAPID key generation (manual setup)

**This task requires manual setup, not code.**

**Step 1: Install web-push CLI globally (temporary)**

```bash
npx web-push generate-vapid-keys
```

This outputs a public key and private key pair. Save both.

**Step 2: Store VAPID public key as GitHub Secret**

```bash
gh secret set VITE_VAPID_PUBLIC_KEY --body "<public-key-from-step-1>"
```

This will be injected at build time via the CI workflow.

**Step 3: Store VAPID private key as Supabase secret**

```bash
npx supabase secrets set VAPID_PRIVATE_KEY=<private-key-from-step-1>
npx supabase secrets set VAPID_PUBLIC_KEY=<public-key-from-step-1>
npx supabase secrets set VAPID_SUBJECT=mailto:contact@eac-erstein.fr
```

**Step 4: Add VAPID public key to GitHub Actions workflow**

In `.github/workflows/pages.yml`, add to the `Build` step `env:`:

```yaml
VITE_VAPID_PUBLIC_KEY: ${{ secrets.VITE_VAPID_PUBLIC_KEY }}
```

**Step 5: Add VAPID_PUBLIC_KEY to frontend config**

In `src/lib/config.ts` (or create a new `src/lib/pushConfig.ts`):

```ts
export const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '';
```

**Step 6: Commit workflow change**

```bash
git add .github/workflows/pages.yml src/lib/pushConfig.ts
git commit -m "chore(push): add VAPID public key to build env"
```

---

## Task 5: push_subscriptions migration

**Files:**
- Create: `supabase/migrations/00043_push_subscriptions.sql`

**Step 1: Write the migration**

```sql
-- 00043_push_subscriptions.sql
-- Web Push subscription storage for VAPID-based push notifications

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  device_info text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);

-- RLS: users can manage their own subscriptions
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions"
  ON push_subscriptions FOR SELECT
  USING (user_id = (current_setting('request.jwt.claims', true)::json->>'sub')::integer
    OR user_id IN (
      SELECT id FROM users WHERE auth_uid = auth.uid()
    ));

CREATE POLICY "Users can insert own subscriptions"
  ON push_subscriptions FOR INSERT
  WITH CHECK (user_id IN (
    SELECT id FROM users WHERE auth_uid = auth.uid()
  ));

CREATE POLICY "Users can delete own subscriptions"
  ON push_subscriptions FOR DELETE
  USING (user_id IN (
    SELECT id FROM users WHERE auth_uid = auth.uid()
  ));

-- Service role bypass for edge functions
CREATE POLICY "Service role full access"
  ON push_subscriptions FOR ALL
  USING (auth.role() = 'service_role');
```

**Step 2: Apply migration**

Use the Supabase MCP tool `apply_migration` or:
```bash
npx supabase db push
```

**Step 3: Verify table exists**

```sql
SELECT * FROM push_subscriptions LIMIT 0;
```

**Step 4: Commit**

```bash
git add supabase/migrations/00043_push_subscriptions.sql
git commit -m "feat(push): add push_subscriptions table with RLS"
```

---

## Task 6: Service Worker push handler

**Files:**
- Create: `public/push-handler.js`
- Modify: `vite.config.ts` (add `importScripts` to workbox config)

**Step 1: Create the push event handler script**

```js
// public/push-handler.js
// Imported by the Workbox-generated service worker via importScripts.
// Handles Web Push events and notification clicks.

self.addEventListener('push', function(event) {
  if (!event.data) return;

  var data;
  try {
    data = event.data.json();
  } catch (e) {
    data = { title: 'EAC Natation', body: event.data.text() };
  }

  var options = {
    body: data.body || '',
    icon: 'icon-192.png',
    badge: 'favicon.png',
    data: { url: data.url || '#/' },
    vibrate: [200, 100, 200],
    tag: data.tag || 'eac-notification',
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'EAC Natation', options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  var targetUrl = event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : '#/';

  // Try to focus an existing window, or open a new one
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.includes('/competition/') && 'focus' in client) {
          client.focus();
          if (targetUrl.startsWith('#')) {
            client.navigate(client.url.split('#')[0] + targetUrl);
          }
          return;
        }
      }
      // No existing window — open new
      var base = self.registration.scope || '/competition/';
      return self.clients.openWindow(base + targetUrl);
    })
  );
});
```

**Step 2: Add importScripts to vite.config.ts**

In the `workbox` config object, add:

```ts
importScripts: ['push-handler.js'],
```

So the workbox block becomes:
```ts
workbox: {
  importScripts: ['push-handler.js'],
  globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}'],
  // ... rest stays the same
},
```

**Step 3: Verify build**

```bash
npm run build
```
Check that `dist/sw.js` contains `importScripts("push-handler.js")` near the top.

**Step 4: Commit**

```bash
git add public/push-handler.js vite.config.ts
git commit -m "feat(push): add push event handler to service worker"
```

---

## Task 7: Push subscription client helpers

**Files:**
- Create: `src/lib/push.ts`
- Create: `src/lib/__tests__/push.test.ts`

**Step 1: Write tests for pure helper functions**

```ts
// src/lib/__tests__/push.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { urlBase64ToUint8Array, serializeSubscription } from "@/lib/push";

test("urlBase64ToUint8Array converts base64url to Uint8Array", () => {
  // "AQAB" in base64 = bytes [1, 0, 1]
  const result = urlBase64ToUint8Array("AQAB");
  assert.equal(result instanceof Uint8Array, true);
  assert.equal(result.length, 3);
  assert.equal(result[0], 1);
  assert.equal(result[1], 0);
  assert.equal(result[2], 1);
});

test("serializeSubscription extracts endpoint and keys", () => {
  const mockSub = {
    endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
    toJSON: () => ({
      endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
      keys: { p256dh: "pubkey123", auth: "authkey456" },
    }),
  };
  const result = serializeSubscription(mockSub as any);
  assert.equal(result.endpoint, "https://fcm.googleapis.com/fcm/send/abc123");
  assert.equal(result.p256dh, "pubkey123");
  assert.equal(result.auth, "authkey456");
});
```

**Step 2: Run tests — verify they fail**

```bash
npm test -- src/lib/__tests__/push.test.ts
```

**Step 3: Implement push helpers**

```ts
// src/lib/push.ts
import { supabase } from "@/lib/supabase";
import { VAPID_PUBLIC_KEY } from "@/lib/pushConfig";

/** Convert a VAPID base64url public key to a Uint8Array for pushManager.subscribe() */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/** Extract endpoint and keys from a PushSubscription */
export function serializeSubscription(sub: PushSubscription): {
  endpoint: string;
  p256dh: string;
  auth: string;
} {
  const json = sub.toJSON();
  return {
    endpoint: json.endpoint!,
    p256dh: json.keys!.p256dh!,
    auth: json.keys!.auth!,
  };
}

/** Check if Web Push is supported in this browser */
export function isPushSupported(): boolean {
  return "PushManager" in window && "serviceWorker" in navigator;
}

/** Get current push permission state */
export function getPushPermission(): NotificationPermission {
  return Notification.permission;
}

/** Subscribe to push notifications and save to Supabase */
export async function subscribeToPush(userId: number): Promise<boolean> {
  if (!isPushSupported() || !VAPID_PUBLIC_KEY) return false;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  const reg = (window as any).__pwaRegistration as ServiceWorkerRegistration | undefined;
  if (!reg) return false;

  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  const { endpoint, p256dh, auth } = serializeSubscription(subscription);
  const deviceInfo = `${navigator.userAgent.slice(0, 100)}`;

  const { error } = await supabase.from("push_subscriptions").upsert(
    { user_id: userId, endpoint, p256dh, auth, device_info: deviceInfo, updated_at: new Date().toISOString() },
    { onConflict: "user_id,endpoint" }
  );

  return !error;
}

/** Unsubscribe from push and remove from Supabase */
export async function unsubscribeFromPush(userId: number): Promise<boolean> {
  const reg = (window as any).__pwaRegistration as ServiceWorkerRegistration | undefined;
  if (!reg) return false;

  const subscription = await reg.pushManager.getSubscription();
  if (subscription) {
    await subscription.unsubscribe();
    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", userId)
      .eq("endpoint", subscription.endpoint);
  }
  return true;
}

/** Check if user has an active push subscription */
export async function hasActivePushSubscription(): Promise<boolean> {
  const reg = (window as any).__pwaRegistration as ServiceWorkerRegistration | undefined;
  if (!reg) return false;
  const subscription = await reg.pushManager.getSubscription();
  return subscription !== null;
}
```

**Step 4: Run tests — verify they pass**

```bash
npm test -- src/lib/__tests__/push.test.ts
```

**Step 5: Commit**

```bash
git add src/lib/push.ts src/lib/__tests__/push.test.ts
git commit -m "feat(push): add push subscription client helpers with tests"
```

---

## Task 8: Push permission banner

**Files:**
- Create: `src/components/shared/PushPermissionBanner.tsx`
- Modify: `src/App.tsx` (add banner after auth check)

**Step 1: Create the permission banner**

```tsx
// src/components/shared/PushPermissionBanner.tsx
import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { isPushSupported, getPushPermission, subscribeToPush, hasActivePushSubscription } from "@/lib/push";

const DISMISS_KEY = "eac-push-banner-dismissed";

export function PushPermissionBanner() {
  const [visible, setVisible] = useState(false);
  const user = useAuth((s) => s.user);
  const userId = useAuth((s) => s.userId);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    if (!user || !userId) return;
    if (!isPushSupported()) return;
    if (getPushPermission() === "denied") return;
    if (localStorage.getItem(DISMISS_KEY) === "true") return;

    // Check if already subscribed
    hasActivePushSubscription().then((active) => {
      if (!active && getPushPermission() !== "granted") {
        setVisible(true);
      }
    });
  }, [user, userId]);

  const handleEnable = async () => {
    if (!userId) return;
    setSubscribing(true);
    const success = await subscribeToPush(userId);
    setSubscribing(false);
    if (success) setVisible(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, "true");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 mx-auto max-w-md rounded-xl border bg-background/95 shadow-lg backdrop-blur p-4 sm:bottom-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Bell className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Activer les notifications</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Recevez les rappels d'entraînement, les changements de créneau et les messages du coach.
          </p>
          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={handleEnable} disabled={subscribing}>
              {subscribing ? "Activation..." : "Activer"}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDismiss}>
              Plus tard
            </Button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="shrink-0 p-1 rounded-md text-muted-foreground hover:text-foreground"
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Add banner in App.tsx**

In `App()`, add the banner next to `<UpdateNotification />`:

```tsx
<UpdateNotification />
<PushPermissionBanner />
<Toaster />
```

Import at top:
```tsx
import { PushPermissionBanner } from "@/components/shared/PushPermissionBanner";
```

**Step 3: Verify build**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/components/shared/PushPermissionBanner.tsx src/App.tsx
git commit -m "feat(push): add push permission banner shown after login"
```

---

## Task 9: Edge Function push-send

**Files:**
- Create: `supabase/functions/push-send/index.ts`

**Step 1: Create the edge function**

```ts
// supabase/functions/push-send/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") || "mailto:contact@eac-erstein.fr",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!
);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    const payload = await req.json();
    // payload can be:
    // { type: "webhook", record: { ... } }  — from DB webhook
    // { notification_id, title, body, url }  — direct call

    let title: string;
    let body: string;
    let url: string | undefined;
    let targetUserIds: number[] = [];

    if (payload.type === "INSERT" && payload.record) {
      // Database webhook trigger on notification_targets
      const target = payload.record;
      const notifId = target.notification_id;

      // Fetch the notification content
      const { data: notif } = await supabase
        .from("notifications")
        .select("title, body, type")
        .eq("id", notifId)
        .single();

      if (!notif) {
        return new Response(JSON.stringify({ error: "notification not found" }), {
          status: 404,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      title = notif.title;
      body = notif.body || "";
      url = "#/";

      // Resolve target user IDs
      if (target.target_user_id) {
        targetUserIds = [target.target_user_id];
      } else if (target.target_group_id) {
        // Resolve group members
        const { data: members } = await supabase
          .from("group_members")
          .select("user_id")
          .eq("group_id", target.target_group_id);
        targetUserIds = (members || []).map((m: any) => m.user_id);
      }
    } else {
      // Direct invocation
      title = payload.title || "EAC Natation";
      body = payload.body || "";
      url = payload.url;
      targetUserIds = payload.target_user_ids || [];
    }

    if (targetUserIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Fetch push subscriptions for all target users
    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth")
      .in("user_id", targetUserIds);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "no subscriptions" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const pushPayload = JSON.stringify({ title, body, url: url || "#/" });
    let sent = 0;
    const expiredIds: string[] = [];

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          pushPayload
        );
        sent++;
      } catch (err: any) {
        console.error(`[push] Error sending to ${sub.endpoint}:`, err.statusCode || err.message);
        // 404 or 410 = subscription expired/invalid
        if (err.statusCode === 404 || err.statusCode === 410) {
          expiredIds.push(sub.id);
        }
      }
    }

    // Clean up expired subscriptions
    if (expiredIds.length > 0) {
      await supabase.from("push_subscriptions").delete().in("id", expiredIds);
      console.log(`[push] Cleaned ${expiredIds.length} expired subscriptions`);
    }

    return new Response(
      JSON.stringify({ sent, total: subscriptions.length, expired: expiredIds.length }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[push] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
```

**Step 2: Deploy the edge function**

```bash
npx supabase functions deploy push-send
```

Or use the Supabase MCP `deploy_edge_function` tool.

**Step 3: Test with a direct POST** (after having at least one subscription in DB)

```bash
curl -X POST https://<project>.supabase.co/functions/v1/push-send \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","body":"Hello from Edge Function","target_user_ids":[1]}'
```

**Step 4: Commit**

```bash
git add supabase/functions/push-send/
git commit -m "feat(push): add push-send edge function with web-push"
```

---

## Task 10: Database webhook trigger

**Files:**
- Create: `supabase/migrations/00044_push_webhook_trigger.sql`

**Step 1: Create the webhook trigger migration**

This creates a Postgres trigger that calls the `push-send` Edge Function whenever a new row is inserted into `notification_targets`.

```sql
-- 00044_push_webhook_trigger.sql
-- Trigger to send push notifications when a notification target is created.
-- Uses pg_net to call the push-send Edge Function.

-- Ensure pg_net is enabled (should already be on Supabase)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION notify_push_on_target_insert()
RETURNS trigger AS $$
DECLARE
  edge_url text;
  service_key text;
BEGIN
  edge_url := current_setting('app.settings.supabase_url', true) || '/functions/v1/push-send';
  service_key := current_setting('app.settings.service_role_key', true);

  -- If settings are not available, use environment-based approach
  IF edge_url IS NULL OR service_key IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM extensions.http_post(
    url := edge_url,
    body := json_build_object(
      'type', 'INSERT',
      'record', json_build_object(
        'id', NEW.id,
        'notification_id', NEW.notification_id,
        'target_user_id', NEW.target_user_id,
        'target_group_id', NEW.target_group_id
      )
    )::text,
    headers := json_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    )::jsonb
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_push_notification_on_target_insert
  AFTER INSERT ON notification_targets
  FOR EACH ROW
  EXECUTE FUNCTION notify_push_on_target_insert();
```

> **Note:** The database trigger approach requires `app.settings.supabase_url` and `app.settings.service_role_key` to be configured in Supabase. An alternative is to configure the webhook via the Supabase Dashboard (Database → Webhooks → New Webhook → on `notification_targets` INSERT → call `push-send`). The dashboard approach is simpler and may be preferable. Choose one.

**Step 2: Apply migration or configure via Dashboard**

If using the Dashboard approach instead of the migration:
1. Go to Supabase Dashboard → Database → Webhooks
2. Create new webhook
3. Table: `notification_targets`, Events: `INSERT`
4. Type: Supabase Edge Functions → `push-send`

**Step 3: Test end-to-end**

Send a notification via the existing `notifications_send()` API and verify a push notification arrives on a subscribed device.

**Step 4: Commit**

```bash
git add supabase/migrations/00044_push_webhook_trigger.sql
git commit -m "feat(push): add database trigger for push notification dispatch"
```

---

## Task 11: Push toggle in Profile

**Files:**
- Modify: `src/pages/Profile.tsx` (add push notification toggle)

**Step 1: Add a push notification toggle section**

Find the Profile page's settings/preferences section and add:

```tsx
import { isPushSupported, hasActivePushSubscription, subscribeToPush, unsubscribeFromPush } from "@/lib/push";

// Inside the Profile component, add state:
const [pushEnabled, setPushEnabled] = useState(false);
const [pushLoading, setPushLoading] = useState(false);

useEffect(() => {
  if (isPushSupported()) {
    hasActivePushSubscription().then(setPushEnabled);
  }
}, []);

const handleTogglePush = async () => {
  if (!userId) return;
  setPushLoading(true);
  if (pushEnabled) {
    await unsubscribeFromPush(userId);
    setPushEnabled(false);
  } else {
    const ok = await subscribeToPush(userId);
    setPushEnabled(ok);
  }
  setPushLoading(false);
};

// In the JSX, add a section:
{isPushSupported() && (
  <div className="flex items-center justify-between py-3">
    <div>
      <p className="text-sm font-medium">Notifications push</p>
      <p className="text-xs text-muted-foreground">
        {pushEnabled ? "Activées" : "Désactivées"}
      </p>
    </div>
    <Button
      size="sm"
      variant={pushEnabled ? "outline" : "default"}
      onClick={handleTogglePush}
      disabled={pushLoading}
    >
      {pushLoading ? "..." : pushEnabled ? "Désactiver" : "Activer"}
    </Button>
  </div>
)}
```

**Step 2: Verify build**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/pages/Profile.tsx
git commit -m "feat(push): add push notification toggle in Profile"
```

---

## Task 12: Documentation updates

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/FEATURES_STATUS.md`
- Modify: `docs/implementation-log.md`

**Step 1: Update implementation-log.md**

Add a new entry documenting:
- Context: Web Push notifications via VAPID + FCM
- Changes: PWA install gate, push_subscriptions table, push-send Edge Function, push handlers, permission banner, profile toggle
- Files modified/created
- Decisions: Pure VAPID (no Firebase SDK), mandatory PWA install on mobile, `importScripts` approach for SW
- Limitations: iOS requires PWA install, `npm:web-push` compatibility with Deno

**Step 2: Update ROADMAP.md**

Add chantier #41 (or next available number):
```
| 41 | Notifications push Web Push (VAPID + FCM) | Haute | Fait (§XX) |
```

**Step 3: Update FEATURES_STATUS.md**

Mark push notifications as ✅

**Step 4: Update CLAUDE.md**

Add new files to the key files table:
- `src/lib/push.ts` — Subscription push, helpers VAPID
- `src/lib/pwaHelpers.ts` — Détection plateforme, gate PWA
- `src/components/shared/PWAInstallGate.tsx` — Gate installation PWA mobile
- `src/components/shared/PushPermissionBanner.tsx` — Banner permission push
- `public/push-handler.js` — Service worker push event handler
- `supabase/functions/push-send/` — Edge Function envoi push

Add to Edge Functions table:
```
| `push-send` | Fonctionnelle | `supabase/functions/push-send/` |
```

**Step 5: Commit**

```bash
git add CLAUDE.md docs/ROADMAP.md docs/FEATURES_STATUS.md docs/implementation-log.md
git commit -m "docs: add web push notifications to project documentation"
```

---

## Summary of all files

| Action | File |
|--------|------|
| Create | `src/lib/pwaHelpers.ts` |
| Create | `src/lib/__tests__/pwaHelpers.test.ts` |
| Create | `src/components/shared/PWAInstallGate.tsx` |
| Create | `src/lib/pushConfig.ts` |
| Create | `src/lib/push.ts` |
| Create | `src/lib/__tests__/push.test.ts` |
| Create | `src/components/shared/PushPermissionBanner.tsx` |
| Create | `public/push-handler.js` |
| Create | `supabase/migrations/00043_push_subscriptions.sql` |
| Create | `supabase/migrations/00044_push_webhook_trigger.sql` |
| Create | `supabase/functions/push-send/index.ts` |
| Modify | `src/App.tsx` (import gate + banner) |
| Modify | `vite.config.ts` (add importScripts) |
| Modify | `.github/workflows/pages.yml` (add VAPID key env) |
| Modify | `src/pages/Profile.tsx` (add push toggle) |
| Modify | `CLAUDE.md`, `docs/ROADMAP.md`, `docs/FEATURES_STATUS.md`, `docs/implementation-log.md` |

## Dependencies between tasks

```
Task 1 (helpers) ─────► Task 2 (gate component) ─────► Task 3 (integrate in App)
Task 4 (VAPID keys) ──► Task 6 (SW handler) + Task 7 (client helpers)
Task 5 (DB migration) ─► Task 7 (client helpers) ─────► Task 8 (banner)
Task 6 + Task 7 ───────► Task 9 (edge function)
Task 9 ────────────────► Task 10 (webhook trigger)
Task 7 ────────────────► Task 11 (profile toggle)
All ───────────────────► Task 12 (docs)
```

Parallelizable groups:
- **Group A** (no deps): Tasks 1→2→3, Task 4, Task 5
- **Group B** (after A): Tasks 6, 7
- **Group C** (after B): Tasks 8, 9→10, 11
- **Group D** (after all): Task 12
