// A desk QR holds a link like https://<site>/app/check-in?c=<code>. Rotating
// codes are 12 hex characters, the printed code 32. Anything else is refused
// before it reaches the database.

const codePattern = /^(?:[0-9a-f]{12}|[0-9a-f]{32})$/;

export function isCheckInCode(value: unknown): value is string {
  return typeof value === "string" && codePattern.test(value);
}

/**
 * The code from whatever a scanner read: our check-in link, or a bare code.
 * A link to any other site is ignored, so a look-alike QR stuck over ours
 * cannot send members elsewhere through the in-app scanner.
 */
export function codeFromScan(
  scanned: string,
  siteOrigin: string,
): string | null {
  const text = scanned.trim();
  if (isCheckInCode(text)) return text;

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.origin !== siteOrigin || url.pathname !== "/app/check-in")
    return null;
  const code = url.searchParams.get("c");
  return isCheckInCode(code) ? code : null;
}

export function checkInUrl(code: string, siteUrl: string): string {
  const url = new URL("/app/check-in", siteUrl);
  url.searchParams.set("c", code);
  return url.toString();
}
