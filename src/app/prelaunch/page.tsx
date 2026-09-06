import type { Metadata } from "next";
import { notFound } from "next/navigation";

import PrelaunchCover from "@/src/components/prelaunch/PrelaunchCover";
import { getAdminActor } from "@/src/lib/admin/auth";
import { en } from "@/src/lib/i18n/dictionaries/en";
import { SITE_URL } from "@/src/lib/i18n/metadata";
import { prelaunchEnabled } from "@/src/lib/prelaunch";

/**
 * ⚠️ TEMPORARY — the pre-launch cover's route. Delete this folder at launch.
 *
 * Two ways to reach this page, and they are not the same request:
 *
 *  1. **The cover is on.** `KHEM_PRELAUNCH=true`, and `src/proxy.ts` has
 *     *rewritten* a request for `/` to here. The visitor's address bar still
 *     says `/`, which is why the metadata below has to be the home page's.
 *  2. **The private preview.** The flag is off — production's normal state — and
 *     somebody has typed `/prelaunch` directly. Only an administrator sees
 *     anything; everyone else gets a 404.
 *
 * ## Why the preview is an admin check and not a secret
 *
 * §12 asks for a way to see the deployed cover without exposing it, and says to
 * prefer a mechanism the project already has. This project has a good one:
 * `getAdminActor()` requires a session whose **verified** primary address is on
 * `ADMIN_EMAILS`, compared server-side against `currentUser()` and never against
 * anything the browser sent. Reusing it means the preview introduces no token to
 * store, rotate or leak, no cookie, and no second environment variable — which
 * is what keeps the whole feature down to the one boolean the owner asked for.
 *
 * `notFound()` rather than a redirect, matching `requireAdmin()`'s reasoning: a
 * redirect to sign-in would confirm that `/prelaunch` is a real address worth
 * returning to with better credentials.
 *
 * ## Note the order of the two checks
 *
 * The flag is read first, and when it is on **no** Clerk call happens. Covering
 * the storefront must not make the home page depend on a session — that would
 * put an auth round-trip in front of every visitor for a screen that shows the
 * same thing to all of them.
 */

/*
 * The response depends on a server variable, and on the preview branch on a
 * session, so it can never be prerendered.
 *
 * The cost is worth stating plainly given this repository's history with Vercel
 * usage (`prompts/vercel-usage-reduction.md`): while the cover is up, the home
 * page is a function invocation per view rather than a cached document. It
 * performs **zero** database reads — no products, no collections, no marketing
 * settings — so the render is the JSX below and nothing else, and it lasts only
 * as long as the pre-launch period does.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  /*
   * When the cover is serving `/`, this document *is* the home page as far as
   * any crawler or link preview is concerned. So it answers with the home page's
   * identity — its title, its description, its canonical — rather than with a
   * title of its own. Getting this wrong would rename KHEM's front page to
   * "Coming Soon" in every search result and social card for the duration, and
   * a `noindex` here would drop the domain's root from the index entirely.
   *
   * §20's instruction is to leave the SEO strategy intact, and this is the one
   * place where the temporary layer could quietly damage it.
   */
  if (prelaunchEnabled()) {
    return {
      metadataBase: new URL(SITE_URL),
      title: en.home.meta.title,
      description: en.home.meta.description,
      alternates: { canonical: `${SITE_URL}/` },
      robots: { index: true, follow: true },
    };
  }

  /*
   * The preview branch. Unreachable without an admin session, so no crawler can
   * observe it — the directive is belt to that braces, and it is also what stops
   * `/prelaunch` becoming a second indexable address for the front page if the
   * flag is switched on while a crawler happens to be mid-visit.
   */
  return {
    title: "KHEM — Pre-Launch Preview",
    robots: { index: false, follow: false },
  };
}

export default async function PrelaunchPage() {
  if (prelaunchEnabled()) return <PrelaunchCover />;

  const admin = await getAdminActor();
  if (admin === null) notFound();

  return <PrelaunchCover />;
}
