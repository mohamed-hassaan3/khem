import AdminSearch from "@/src/components/admin/AdminSearch";
import {
  AdminCell,
  AdminEmpty,
  AdminPageHeader,
  AdminRow,
  AdminTable,
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

function label(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function stamp(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
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
    <div className="border border-border bg-ivory/2 p-6 sm:p-8">
      <p className="font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/35">
        {text}
      </p>
      <p className="mt-4 font-heading text-3xl tracking-[0.1em] text-gold sm:text-4xl">
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
        title="Newsletter"
        description="The Inner Circle list. Consent is given and withdrawn by the subscriber — through the link in every letter, or the box on their account — so nothing on this screen edits it."
      />

      <div className="grid gap-5 sm:grid-cols-3">
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
          <AdminTable
            headers={[
              "Email",
              "Status",
              "Source",
              "Language",
              "Consent given",
              "Left",
            ]}
          >
            {subscribers.map((subscriber) => (
              <AdminRow key={subscriber.id}>
                <AdminCell>
                  <span className="block tracking-wide">{subscriber.email}</span>
                  {subscriber.clerkUserId ? (
                    <span className="mt-1 block text-[10px] uppercase tracking-[0.2em] text-ivory/25">
                      Has an account
                    </span>
                  ) : null}
                </AdminCell>

                <AdminCell>
                  <span
                    className={`inline-block border px-3 py-1 font-heading text-[9px] uppercase tracking-[0.2em] ${
                      subscriber.status === "SUBSCRIBED"
                        ? "border-success/40 text-success"
                        : "border-border text-ivory/30"
                    }`}
                  >
                    {label(subscriber.status)}
                  </span>
                </AdminCell>

                <AdminCell muted>
                  {SOURCE_LABELS[subscriber.source] ?? subscriber.source}
                </AdminCell>
                <AdminCell muted>{subscriber.locale.toUpperCase()}</AdminCell>
                <AdminCell muted>{stamp(subscriber.consentAt)}</AdminCell>
                <AdminCell muted>{stamp(subscriber.unsubscribedAt)}</AdminCell>
              </AdminRow>
            ))}
          </AdminTable>

          {lastPage > 1 ? (
            <nav
              aria-label="Pagination"
              className="mt-8 flex items-center justify-between gap-4"
            >
              {page > 1 ? (
                <Link
                  href={pageHref(basePath, query, page - 1)}
                  className="font-heading text-[10px] uppercase tracking-[0.2em] text-gold/70 transition-colors duration-300 hover:text-gold"
                >
                  Previous
                </Link>
              ) : (
                <span />
              )}

              <span className="font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/30">
                Page {page} of {lastPage}
              </span>

              {page < lastPage ? (
                <Link
                  href={pageHref(basePath, query, page + 1)}
                  className="font-heading text-[10px] uppercase tracking-[0.2em] text-gold/70 transition-colors duration-300 hover:text-gold"
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
