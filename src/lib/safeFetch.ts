/**
 * Fetch a URL and parse the response as JSON, but never throw a
 * "Unexpected token" SyntaxError when the server returns an HTML
 * error page (404, 500, gateway timeout, etc.) instead of JSON.
 *
 * Returns `{ ok, status, data }` where `data` is the parsed JSON
 * object, or `null` if the body was not valid JSON.
 */
export async function safeFetchJson(
  url: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> | null }> {
  const res = await fetch(url, init)
  const text = await res.text()
  try {
    const data = text ? JSON.parse(text) : null
    return { ok: res.ok, status: res.status, data }
  } catch {
    return { ok: false, status: res.status, data: null }
  }
}
