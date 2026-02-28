import assert from "node:assert/strict";
import { test } from "node:test";
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
