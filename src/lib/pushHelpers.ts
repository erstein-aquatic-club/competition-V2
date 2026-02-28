/**
 * Pure helper functions for Web Push subscriptions.
 * These have zero browser / Supabase dependencies so they can be unit-tested
 * under Node without mocking.
 */

/**
 * Convert a VAPID public key from URL-safe Base64 to a Uint8Array
 * suitable for `pushManager.subscribe({ applicationServerKey })`.
 */
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

/**
 * Flatten a PushSubscription into a plain object with endpoint, p256dh and
 * auth — ready to be persisted server-side.
 */
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
