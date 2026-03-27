/** Client-only helpers for PWA install UX (iOS vs Android Chrome / Samsung Internet). */

/**
 * iPad (Safari): klasické UA obsahuje „iPad“; od iPadOS 13 často „Macintosh“ + dotyková obrazovka.
 */
export function isLikelyIPad(): boolean {
  if (typeof navigator === "undefined") return false;
  if (/iPad/i.test(navigator.userAgent)) return true;
  const platform = typeof navigator.platform === "string" ? navigator.platform : "";
  return platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

export function isIOSUserAgent(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return true;
  return isLikelyIPad();
}

/**
 * Android phone/tablet in a real browser (excludes most embedded WebViews marked ; wv).
 */
export function isAndroidBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (!/Android/i.test(ua)) return false;
  if (/iphone|ipad|ipod/i.test(ua)) return false;
  // Typical system WebView marker — install prompt usually unavailable
  if (/; wv\)/i.test(ua)) return false;
  return true;
}

export function isStandaloneDisplayMode(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches
  );
}
