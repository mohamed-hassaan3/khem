import { unsubscribeByToken } from "@/src/services/newsletter";

/**
 * One-click unsubscribe (RFC 8058), for the `List-Unsubscribe` header every
 * campaign letter carries.
 *
 * Gmail and Yahoo (2024) and Outlook (2025) expect marketing mail to offer an
 * unsubscribe the mail client can perform itself: it POSTs
 * `List-Unsubscribe=One-Click` to this URL, with no page and no confirmation.
 * Mail without it is treated as less trustworthy and is more likely to be
 * filtered as junk.
 *
 * The token is the same per-recipient token the footer link carries; it is the
 * whole authority, so no session is involved. It goes through the existing
 * `unsubscribeByToken()` — the same rows the `/unsubscribe` page writes.
 *
 * GET does nothing: link scanners (Outlook Safe Links and others) fetch URLs in
 * mail, and a fetch must never unsubscribe anyone. People clicking a link use
 * the `/unsubscribe` page, which asks first.
 */
export const dynamic = "force-dynamic";

const MAX_TOKEN_LENGTH = 200;

export async function POST(request: Request): Promise<Response> {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (token.length === 0 || token.length > MAX_TOKEN_LENGTH) {
    return new Response("Bad request", { status: 400 });
  }

  const outcome = await unsubscribeByToken(token);
  // 200 either way for a well-formed request: the mail client only needs to
  // know the request was taken, and an unknown token must not be confirmed.
  console.info(`[newsletter] one-click unsubscribe (${outcome.found ? "matched" : "no match"})`);
  return new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } });
}

export function GET(): Response {
  return new Response("Use the link in the letter to manage your subscription.", {
    status: 405,
    headers: { Allow: "POST" },
  });
}
