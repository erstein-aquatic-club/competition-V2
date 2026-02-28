import { describe, it, expect } from "vitest";
import { urlBase64ToUint8Array, serializeSubscription } from "@/lib/pushHelpers";

describe("pushHelpers", () => {
  it("urlBase64ToUint8Array converts base64url to Uint8Array", () => {
    const result = urlBase64ToUint8Array("AQAB");
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(3);
    expect(result[0]).toBe(1);
    expect(result[1]).toBe(0);
    expect(result[2]).toBe(1);
  });

  it("serializeSubscription extracts endpoint and keys", () => {
    const mockSub = {
      endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
      toJSON: () => ({
        endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
        keys: { p256dh: "pubkey123", auth: "authkey456" },
      }),
    };
    const result = serializeSubscription(mockSub as any);
    expect(result.endpoint).toBe("https://fcm.googleapis.com/fcm/send/abc123");
    expect(result.p256dh).toBe("pubkey123");
    expect(result.auth).toBe("authkey456");
  });
});
