/** Use for `href` — only http(s). */
export function safeHttpUrl(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = String(raw).trim();
  if (!t) return null;
  try {
    const u = new URL(t);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.href;
  } catch {
    return null;
  }
}

/**
 * Normalize user input for storage (adds https if missing).
 * Returns null for empty. Throws if not a valid http(s) URL.
 */
export function normalizeProfileUrlForStorage(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  const u = new URL(withScheme);
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("Profile URL must start with http:// or https://");
  }
  return u.href;
}

export function normalizeUniversityCode(raw: string): string | null {
  const t = raw.trim().toLowerCase();
  if (!t) return null;
  return t.slice(0, 64);
}
