import "server-only";

/**
 * A database read that is not allowed to hang a render.
 *
 * Lifted verbatim out of `src/services/marketing.ts`, which had the only copy,
 * because `src/services/benefits.ts` needs exactly the same protection for
 * exactly the same reason — both are awaited by the **root layout**, in front of
 * every page on the site.
 *
 * A promise that never settles there does not degrade a page; it replaces the
 * whole app with `loading.tsx` forever. That is not hypothetical: it is what a
 * stale PostgREST schema cache did to this build, and the reason `notify pgrst`
 * now ends the migration.
 *
 * So a slow or unreachable database costs the visitor a missing announcement bar
 * or a popup with no offer line, never a page that will not paint. It is the
 * same bargain `isSupabaseConfigured()` strikes for a missing key, extended from
 * "absent" to "not answering" — the two look identical to somebody watching the
 * screen.
 */

/**
 * How long chrome may hold up a page.
 *
 * Relaxed during a production build for the reason `src/lib/supabase.ts` gives
 * at length: giving up quickly is right for one visitor and wrong for a
 * prerender, which would bake the missing bar into static HTML for everybody.
 */
export const READ_TIMEOUT_MS =
  process.env.NEXT_PHASE === "phase-production-build" ? 60_000 : 4_000;

/**
 * What every bounded read hands back — the two fields supabase-js settles with.
 *
 * Narrower than the client's own generics on purpose: callers only ever ask "did
 * it answer, and with what", and a shape that small is one every caller already
 * knows how to fall back from.
 */
export interface ReadResult<T> {
  data: T | null;
  error: { message: string } | null;
}

/** What a read that never answered looks like: no data, and nothing to log twice. */
const NO_ANSWER: ReadResult<never> = { data: null, error: null };

/**
 * Resolve to an empty result if `work` has not settled in {@link READ_TIMEOUT_MS}.
 *
 * Takes a `PromiseLike` rather than a `Promise` because a supabase-js query
 * builder is a thenable, not a promise — it has no `.catch()` of its own, which
 * is exactly why the raw builder cannot be handed to `Promise.race()` and
 * expected to behave.
 *
 * The losing promise is **not** cancelled — supabase-js exposes no way to, and
 * an in-flight request nobody is waiting for costs a socket and nothing else.
 * What matters is that the render stops waiting.
 *
 * A rejection is caught here too. Every caller already turns an `error` field
 * into a fallback, but a client that *throws* — a DNS failure, an aborted socket
 * — would otherwise propagate out of the root layout and take the page with it.
 */
export async function boundedRead<T>(
  scope: string,
  label: string,
  work: PromiseLike<ReadResult<T>>,
): Promise<ReadResult<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const expiry = new Promise<ReadResult<T>>((resolve) => {
    timer = setTimeout(() => {
      console.error(`[${scope}] ${label} timed out after ${READ_TIMEOUT_MS}ms`);
      resolve(NO_ANSWER);
    }, READ_TIMEOUT_MS);
  });

  try {
    return await Promise.race([
      Promise.resolve(work).catch((cause: unknown) => {
        console.error(
          `[${scope}] ${label} threw: ${cause instanceof Error ? cause.message : "unknown error"}`,
        );
        return NO_ANSWER;
      }),
      expiry,
    ]);
  } finally {
    // Without this the timer keeps the event loop alive for the full window on
    // every render that answered quickly — four seconds of held handle per page.
    clearTimeout(timer);
  }
}
