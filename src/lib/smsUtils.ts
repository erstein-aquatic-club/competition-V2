/** Shared SMS helpers — used by CoachSmsScreen and interview SMS prompt. */

const IS_IOS = /iPhone|iPad|iPod/i;
const IS_MOBILE = /iPhone|iPad|iPod|Android/i;

/** Build a `sms:` URI for one or more phone numbers with an optional body. */
export function buildSmsUri(phones: string[], body?: string): string {
  const encodedBody = body ? encodeURIComponent(body) : "";
  const isIos = IS_IOS.test(navigator.userAgent);

  if (isIos) {
    const addresses = phones.join(",");
    return encodedBody
      ? `sms:/open?addresses=${addresses}&body=${encodedBody}`
      : `sms:/open?addresses=${addresses}`;
  }
  // Android & macOS Messages
  const joined = phones.join(",");
  return encodedBody ? `sms:${joined}?body=${encodedBody}` : `sms:${joined}`;
}

/** Returns true when the device can open a native SMS app (mobile or Mac Messages). */
export function canOpenSmsApp(): boolean {
  // Mobile always can; macOS can via Messages relay
  return IS_MOBILE.test(navigator.userAgent) || /Macintosh|Mac OS/i.test(navigator.userAgent);
}

/** Returns true on a mobile device (phone / tablet). */
export function isMobileDevice(): boolean {
  return IS_MOBILE.test(navigator.userAgent);
}
