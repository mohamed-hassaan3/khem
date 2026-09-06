import { AdminPageHeader } from "@/src/components/admin/AdminTable";
import PointsAdjuster from "@/src/components/admin/PointsAdjuster";
import RewardSettingsForm from "@/src/components/admin/RewardSettingsForm";
import { isLocale } from "@/src/lib/i18n/config";
import { getAdminBenefitSettings } from "@/src/services/admin/benefits";
import {
  REWARD_CUSTOMERS_PER_PAGE,
  getRewardTotals,
  listRewardCustomers,
} from "@/src/services/admin/rewards";
import { getWelcomeOffer } from "@/src/services/marketing";

/**
 * Marketing → Rewards.
 *
 * The whole programme on one screen: what it pays, what it costs, who holds a
 * balance, and the one lever the desk has over an individual account.
 *
 * ## Why the balances are here and not under Customers
 *
 * They are on both. A customer's own screen shows their points beside their
 * orders and their credits, which is what support needs when somebody writes in.
 * This list answers the other question — "what is the programme actually doing"
 * — which is a marketing question and belongs beside the rates that produced it.
 *
 * `force-dynamic`, like every other admin screen: an editor who has just saved a
 * rate must see the rate they saved, and a balance adjusted a moment ago must
 * not be served from a cache saying otherwise.
 */
export const dynamic = "force-dynamic";

export default async function AdminRewardsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  void isLocale(locale);

  const search = (query.q ?? "").trim();
  const page = Math.max(1, Number(query.page ?? "1") || 1);
  const offset = (page - 1) * REWARD_CUSTOMERS_PER_PAGE;

  const [settings, welcome, totals, customers] = await Promise.all([
    getAdminBenefitSettings(),
    /*
     * What the live welcome campaign is worth, for the note under the signup
     * choice. `welcome_offer()` is itself gated on that choice, so it answers
     * null under the other two modes — which is correct here and would be
     * misleading, so the summary falls back to naming the campaign rather than
     * its value.
     */
    getWelcomeOffer(),
    getRewardTotals(),
    listRewardCustomers({ search, offset }),
  ]);

  const welcomeSummary =
    welcome === null
      ? "none running"
      : welcome.kind === "PERCENTAGE"
        ? `${welcome.value}% off a first order`
        : `EGP ${Math.round(welcome.value / 100).toLocaleString("en-US")} off a first order`;

  return (
    <>
      <AdminPageHeader
        title="Rewards"
        description="KHEM Points — what a pound earns, what a point is worth, and who holds a balance. Nothing here is a price: switching the programme off keeps every balance intact."
      />

      <RewardSettingsForm settings={settings} welcomeSummary={welcomeSummary} />

      <section className="mt-14 space-y-5">
        <div>
          <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
            Outstanding
          </h2>
          <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-ground-muted">
            What the house currently owes in points, and what it has paid out.
            These are the ledger read back — no figure here is stored, so none of
            them can drift from the movements beneath them.
          </p>
        </div>

        {/*
          The Credits screen's figure grid, not a second layout: separate cards
          with their own borders, gapped rather than divided by a background
          showing through a `gap-px` seam. That earlier version painted the seam
          with `bg-ground-border` and the cards with `bg-background` — the
          storefront's dark ground — which produced a black slab in the middle of
          an ivory page and swallowed the labels on it.
        */}
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <Figure label="Holders" value={totals.holders.toLocaleString("en-US")} />
          <Figure
            label="Outstanding"
            value={totals.outstandingPoints.toLocaleString("en-US")}
            note="Owed to customers"
          />
          <Figure
            label="Earned to date"
            value={totals.lifetimeEarned.toLocaleString("en-US")}
          />
          <Figure
            label="Redeemed"
            value={totals.lifetimeRedeemed.toLocaleString("en-US")}
            note={`${totals.expiredPoints.toLocaleString("en-US")} expired`}
          />
        </div>
      </section>

      <section className="mt-12 space-y-5">
        <div>
          <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
            Balances
          </h2>
          <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-ground-muted">
            Search by name or address. An adjustment writes a new ledger row with
            your name and the reason on it — it never edits an existing one, so
            the history stays answerable.
          </p>
        </div>

        <form method="get" className="flex max-w-md gap-3">
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Name or email"
            aria-label="Search customers"
            className="field"
          />
          <button
            type="submit"
            className="cursor-pointer border border-ground-border px-5 font-heading text-[11px] uppercase tracking-[0.16em] text-ground-muted transition-colors duration-300 hover:border-ground-accent/40 hover:text-ground-accent"
          >
            Search
          </button>
        </form>

        {customers.customers.length === 0 ? (
          <p className="border border-ground-border px-5 py-6 text-[12px] text-ground-muted">
            {search
              ? "Nobody matching that holds a balance."
              : "No customer has earned points yet."}
          </p>
        ) : (
          <div className="overflow-x-auto border border-ground-border">
            <table className="w-full min-w-[46rem] border-collapse text-start">
              <thead>
                <tr className="border-b border-ground-border">
                  {["Customer", "Balance", "Earned", "Redeemed", "Expired", ""].map(
                    (heading) => (
                      <th
                        key={heading || "actions"}
                        scope="col"
                        className="px-5 py-4 text-start font-heading text-[10px] uppercase tracking-[0.16em] text-ground-muted/70"
                      >
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>

              <tbody>
                {customers.customers.map((customer) => (
                  <tr
                    key={customer.clerkUserId}
                    className="border-b border-ground-border last:border-b-0"
                  >
                    <td className="px-5 py-4">
                      <span className="block text-[12px] text-ground">
                        {customer.name ?? "—"}
                      </span>
                      <span className="block text-[11px] text-ground-muted">
                        {customer.email ?? customer.clerkUserId}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-heading text-[13px] tabular-nums text-ground-accent">
                      {customer.balancePoints.toLocaleString("en-US")}
                    </td>
                    <td className="px-5 py-4 text-[12px] tabular-nums text-ground-muted">
                      {customer.lifetimeEarned.toLocaleString("en-US")}
                    </td>
                    <td className="px-5 py-4 text-[12px] tabular-nums text-ground-muted">
                      {customer.lifetimeRedeemed.toLocaleString("en-US")}
                    </td>
                    <td className="px-5 py-4 text-[12px] tabular-nums text-ground-muted">
                      {customer.expiredPoints.toLocaleString("en-US")}
                    </td>
                    <td className="px-5 py-4">
                      <PointsAdjuster
                        clerkUserId={customer.clerkUserId}
                        name={customer.name ?? customer.email ?? "this customer"}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {customers.total > REWARD_CUSTOMERS_PER_PAGE ? (
          <p className="text-[11px] tracking-wide text-ground-muted">
            Showing {offset + 1}–
            {Math.min(offset + REWARD_CUSTOMERS_PER_PAGE, customers.total)} of{" "}
            {customers.total.toLocaleString("en-US")}.
          </p>
        ) : null}
      </section>
    </>
  );
}

/**
 * One figure, in the Credits screen's card.
 *
 * Deliberately the same markup and the same tokens as `Figure` there — an
 * `ivory/2` fill on a `ground-border` frame, a muted label and a gold figure —
 * because these two screens report the same kind of thing about the two
 * instruments, and a desk moving between them should not have to re-read the
 * layout.
 */
function Figure({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="border border-ground-border bg-ivory/2 p-6 sm:p-8">
      <p className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
        {label}
      </p>
      <p className="mt-4 font-heading text-3xl tabular-nums tracking-[0.1em] text-ground-accent sm:text-4xl">
        {value}
      </p>
      {note ? <p className="mt-3 text-[11px] text-ground-muted">{note}</p> : null}
    </div>
  );
}
