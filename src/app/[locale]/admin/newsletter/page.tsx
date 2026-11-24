import AdminSearch from "@/src/components/admin/AdminSearch";
import {
  AdminEmpty,
  AdminPageHeader,
} from "@/src/components/admin/AdminTable";
import FilterChips from "@/src/components/admin/FilterChips";
import Link from "next/link";

import { searchTerm } from "@/src/lib/admin/filter";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import {
  SUBSCRIBERS_PER_PAGE,
  getNewsletterCounts,
  listSubscribers,
} from "@/src/services/admin/newsletter";
import type { NewsletterStatus } from "@/src/types/newsletter";
import { SHOP_TIME_ZONE } from "@/src/lib/shop-time";

/**
 * The Inner Circle.
 *
 * Read-only, and that is the design. Consent is something a person gives and
 * withdraws; it is not a field for the desk to set on their behalf. The two
 * ways off this list are the customer's own unsubscribe link and the box on
 * their account — both of which record *who* acted and when. A toggle here
 * would produce rows whose `consentAt` says one thing and whose history says
 * another, which is precisely the state that makes a consent record worthless.
 *
 * Adding an address by hand is the same argument and is likewise absent: an
 * address typed at the desk has no evidence of consent behind it.
 *
 * What the screen is *for* is answering the questions the house actually has:
 * how many people are on the list, how many have left, where the addresses came
 * from, and when each of them agreed.
 */

export const dynamic = "force-dynamic";

const STATUSES: readonly NewsletterStatus[] = ["SUBSCRIBED", "UNSUBSCRIBED"];

/** Where an address came from — different evidence of consent in each case. */
const SOURCE_LABELS: Record<string, string> = {
  HOME_FORM: "Home form",
  POPUP: "Offer popup",
  SIGN_UP: "Sign-up",
  ADMIN: "Desk",
};

function readParam(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" ? raw : "";
}

function readPage(value: string | string[] | undefined): number {
  const parsed = Number.parseInt(readParam(value), 10);
  return Number.isFinite(parsed) && parsed > 1 ? parsed : 1;
}


function stamp(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: SHOP_TIME_ZONE,
  }).format(new Date(iso));
}

function pageHref(
  basePath: string,
  query: Record<string, string | string[] | undefined>,
  page: number,
): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (key === "page" || value === undefined) continue;
    params.set(key, Array.isArray(value) ? (value[0] ?? "") : value);
  }

  if (page > 1) params.set("page", String(page));

  const search = params.toString();
  return search.length > 0 ? `${basePath}?${search}` : basePath;
}

function Figure({ label: text, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 border border-ground-border bg-ivory/2 p-3 sm:p-6">
      <p className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
        {text}
      </p>
      <p className="mt-2 font-heading text-[22px] tracking-[0.04em] text-ground-accent sm:mt-4 sm:text-3xl">
        {value}
      </p>
    </div>
  );
}

export default async function AdminNewsletterPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const activeLocale = isLocale(locale) ? locale : "en";

  const term = searchTerm(query);
  const page = readPage(query.page);
  const statusParam = readParam(query.status);
  const status = STATUSES.find((value) => value === statusParam);

  const [{ subscribers, total }, counts] = await Promise.all([
    listSubscribers({
      search: term,
      status,
      offset: (page - 1) * SUBSCRIBERS_PER_PAGE,
      limit: SUBSCRIBERS_PER_PAGE,
    }),
    getNewsletterCounts(),
  ]);

  const basePath = localizePath(activeLocale, "/admin/newsletter");
  const lastPage = Math.max(1, Math.ceil(total / SUBSCRIBERS_PER_PAGE));

  return (
    <>
      <AdminPageHeader
        title="Subscribers"
        description="The Inner Circle list. People join and leave it themselves — through the sign-up forms, the link in every letter, or their account — so this screen shows it but does not edit it."
      />

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Figure label="On the list" value={counts.subscribed} />
        <Figure label="Unsubscribed" value={counts.unsubscribed} />
        <Figure label="Addresses held" value={counts.total} />
      </div>

      <div className="mt-8">
        <AdminSearch placeholder="Search by email" />

        <FilterChips
          basePath={basePath}
          param="status"
          active={status ?? ""}
          query={query}
          chips={[
            { value: "", label: "Everyone" },
            { value: "SUBSCRIBED", label: "Subscribed", count: counts.subscribed },
            { value: "UNSUBSCRIBED", label: "Unsubscribed" },
          ]}
        />
      </div>

      {subscribers.length === 0 ? (
        <AdminEmpty
          message={
            term.length > 0 || status
              ? "No addresses match that filter."
              : "Nobody has joined the Inner Circle yet. The form at the foot of the home page is where they arrive."
          }
        />
      ) : (
        <>
          {/* One row per address (prompts/admin-redesign-stage-6.md, 6c). */}
          <ul data-admin-results="" className="overflow-hidden rounded-lg border border-ground-border bg-stone">
            {subscribers.map((subscriber) => {
              const on = subscriber.status === "SUBSCRIBED";
              return (
                <li
                  key={subscriber.id}
                  className="flex min-h-16 items-center gap-3 border-b border-ground-border px-4 py-3 last:border-b-0"
                >
                  <span className="min-w-0 flex-1">
                    <span dir="ltr" className="block truncate text-[14px] text-ground">
                      {subscriber.email}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-ground-muted">
                      {SOURCE_LABELS[subscriber.source] ?? subscriber.source} · {subscriber.locale === "ar" ? "Arabic" : "English"} ·{" "}
                      {on ? `joined ${stamp(subscriber.consentAt)}` : `left ${stamp(subscriber.unsubscribedAt)}`}
                      {subscriber.clerkUserId ? " · has an account" : ""}
                    </span>
                  </span>
                  <span
                    className={`inline-flex h-6 shrink-0 items-center rounded-full border px-2.5 text-[11px] ${
                      on ? "border-success/40 text-success" : "border-ground-border text-ground-muted"
                    }`}
                  >
                    {on ? "Subscribed" : "Left"}
                  </span>
                </li>
              );
            })}
          </ul>

          {lastPage > 1 ? (
            <nav
              aria-label="Pagination"
              className="mt-8 flex items-center justify-between gap-4"
            >
              {page > 1 ? (
                <Link
                  href={pageHref(basePath, query, page - 1)}
                  className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-accent transition-colors duration-300 hover:text-ground-accent"
                >
                  Previous
                </Link>
              ) : (
                <span />
              )}

              <span className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
                Page {page} of {lastPage}
              </span>

              {page < lastPage ? (
                <Link
                  href={pageHref(basePath, query, page + 1)}
                  className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-accent transition-colors duration-300 hover:text-ground-accent"
                >
                  Next
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </>
      )}
    </>
  );
}
