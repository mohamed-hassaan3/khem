import {
  ArrowUpRight,
  BarChart3,
  Box,
  LayoutDashboard,
  Menu,
  Settings,
  ShoppingCart,
  Users,
} from "lucide-react";

/**
 * The dashboard, under §29 and §30.
 *
 * The argument being made here is narrow and worth stating plainly: the admin
 * is currently the same obsidian as the storefront, and it should not be.
 * Reading a fourteen-row order table in ivory-on-black for an hour is a
 * different job from being sold a perfume, and the document says so — content
 * goes to ivory, the rail stays charcoal so the house is still recognisable,
 * and gold survives only as the active-row marker and the occasional figure.
 *
 * The rail keeping its charcoal is what stops this becoming a generic SaaS
 * dashboard: it is the one piece of the storefront's register that carries
 * over, and it costs nothing in legibility because nobody reads data in it.
 */

const NAV = [
  { label: "Overview", icon: LayoutDashboard, active: true },
  { label: "Orders", icon: ShoppingCart, active: false },
  { label: "Products", icon: Box, active: false },
  { label: "Customers", icon: Users, active: false },
  { label: "Analytics", icon: BarChart3, active: false },
  { label: "Settings", icon: Settings, active: false },
];

const ORDERS = [
  { id: "KHEM-2026-8921", customer: "N. Farouk", total: "EGP 9,400", status: "Paid", tone: "ok" },
  { id: "KHEM-2026-8920", customer: "A. Mansour", total: "EGP 3,200", status: "Pending", tone: "warn" },
  { id: "KHEM-2026-8919", customer: "R. Haddad", total: "EGP 12,800", status: "Shipped", tone: "info" },
  { id: "KHEM-2026-8918", customer: "S. Kamel", total: "EGP 4,800", status: "Refunded", tone: "bad" },
] as const;

const STATUS_TONE = {
  ok: "border-[rgba(60,120,70,0.35)] bg-[rgba(60,120,70,0.08)] text-[#2f6b3c]",
  warn: "border-[rgba(176,141,87,0.4)] bg-[rgba(176,141,87,0.08)] text-[var(--k-on-light-accent)]",
  info: "border-[rgba(21,21,21,0.18)] bg-[rgba(21,21,21,0.04)] text-[var(--k-on-light-muted)]",
  bad: "border-[rgba(179,38,30,0.3)] bg-[rgba(179,38,30,0.06)] text-[#9a2b23]",
} as const;

/* ── Pieces ─────────────────────────────────────────────────── */

export function AdminRail({ compact = false }: { compact?: boolean }) {
  return (
    <aside
      className={`k-charcoal flex shrink-0 flex-col py-8 ${
        compact ? "w-[64px] items-center" : "w-[220px]"
      }`}
    >
      <div className={compact ? "" : "px-6"}>
        {compact ? (
          <p className="k-serif text-sm tracking-[0.2em] text-[var(--k-gold)]">
            K
          </p>
        ) : (
          <>
            <p className="k-serif text-[11px] uppercase tracking-[0.3em] text-[var(--k-gold)]">
              KHEM
            </p>
            <p className="k-sans mt-1 text-[9px] uppercase tracking-[0.22em] text-[rgba(184,179,170,0.5)]">
              Administration
            </p>
          </>
        )}
      </div>

      <nav className={`mt-8 flex flex-col gap-0.5 ${compact ? "" : "px-3"}`}>
        {NAV.map(({ label, icon: Icon, active }) => (
          <span
            key={label}
            title={compact ? label : undefined}
            className={`flex items-center gap-3 border-s-2 px-4 py-3 transition-colors duration-300 ${
              compact ? "justify-center px-0" : ""
            } ${
              active
                ? "border-[var(--k-gold)] bg-[rgba(176,141,87,0.1)] text-[var(--k-gold)]"
                : "border-transparent text-[rgba(184,179,170,0.7)]"
            }`}
          >
            <Icon size={15} strokeWidth={1.25} aria-hidden />
            {!compact ? (
              <span className="k-sans text-[10px] uppercase tracking-[0.2em]">
                {label}
              </span>
            ) : null}
          </span>
        ))}
      </nav>
    </aside>
  );
}

export function StatCard({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta?: string;
}) {
  return (
    <div className="k-card p-5">
      <p className="k-sans text-[9px] font-medium uppercase tracking-[0.22em] text-[var(--k-on-light-muted)]">
        {label}
      </p>
      <p className="k-serif mt-3 text-2xl tabular-nums tracking-[0.04em] text-[var(--k-on-light)]">
        {value}
      </p>
      {delta ? (
        <p className="k-sans mt-2 inline-flex items-center gap-1 text-[11px] text-[var(--k-on-light-accent)]">
          <ArrowUpRight size={13} strokeWidth={1.5} aria-hidden />
          {delta}
        </p>
      ) : null}
    </div>
  );
}

/** Desktop and tablet: a real table, horizontally scrollable if it must be. */
export function AdminTableSpec() {
  return (
    <div className="k-card overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-start">
        <thead>
          <tr className="border-b border-[var(--k-line-light)] bg-[rgba(21,21,21,0.02)]">
            {["Order", "Customer", "Total", "Status"].map((head) => (
              <th
                key={head}
                scope="col"
                className="k-sans px-5 py-3.5 text-start text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--k-on-light-muted)]"
              >
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ORDERS.map((order) => (
            <tr
              key={order.id}
              className="border-b border-[var(--k-line-light)] last:border-b-0 transition-colors duration-300 hover:bg-[rgba(176,141,87,0.05)]"
            >
              <td className="k-sans px-5 py-4 text-[12px] tabular-nums tracking-wide text-[var(--k-on-light)]">
                {order.id}
              </td>
              <td className="k-sans px-5 py-4 text-[12px] text-[var(--k-on-light-muted)]">
                {order.customer}
              </td>
              <td className="k-sans px-5 py-4 text-[12px] tabular-nums text-[var(--k-on-light)]">
                {order.total}
              </td>
              <td className="px-5 py-4">
                <span
                  className={`k-sans inline-block border px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.18em] ${STATUS_TONE[order.tone]}`}
                >
                  {order.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Mobile: the same four rows as cards.
 *
 * §29 offers horizontal scrolling *or* a card representation; a four-column
 * order table is squarely in card territory, because the useful comparison on
 * a phone is between orders, not between columns. The header stays a `<th>`
 * pattern on wider screens — this is a different rendering of the same data,
 * not a different data set.
 */
export function AdminCardListSpec() {
  return (
    <div className="flex flex-col gap-3">
      {ORDERS.map((order) => (
        <div key={order.id} className="k-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="k-sans text-[12px] tabular-nums tracking-wide text-[var(--k-on-light)]">
                {order.id}
              </p>
              <p className="k-sans mt-1 text-[12px] text-[var(--k-on-light-muted)]">
                {order.customer}
              </p>
            </div>
            <span
              className={`k-sans shrink-0 border px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.18em] ${STATUS_TONE[order.tone]}`}
            >
              {order.status}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-[var(--k-line-light)] pt-3">
            <span className="k-serif text-[15px] tabular-nums text-[var(--k-on-light)]">
              {order.total}
            </span>
            <button type="button" className="k-btn k-btn-sm k-btn-outline">
              Open
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/** A form row: two columns on desktop, one on mobile (§29). */
export function AdminFormSpec() {
  return (
    <form className="k-card p-5 sm:p-7">
      <p className="k-serif text-base tracking-[0.06em] text-[var(--k-on-light)]">
        Edit product
      </p>
      <div className="k-rule mt-4" />

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div>
          <label className="k-label" htmlFor="k-admin-name">
            Name
          </label>
          <input id="k-admin-name" className="k-field" defaultValue="Nile Iris" />
        </div>
        <div>
          <label className="k-label" htmlFor="k-admin-sku">
            SKU
          </label>
          <input id="k-admin-sku" className="k-field" defaultValue="KH-SIG-050" />
        </div>
        <div>
          <label className="k-label" htmlFor="k-admin-price">
            Price
          </label>
          <input
            id="k-admin-price"
            className="k-field k-field-error"
            defaultValue="-3200"
          />
          <p
            className="k-sans mt-2 text-[11px] text-[#9a2b23]"
            role="alert"
          >
            Price must be a positive amount.
          </p>
        </div>
        <div>
          <label className="k-label" htmlFor="k-admin-stock">
            Inventory
          </label>
          <input id="k-admin-stock" className="k-field" defaultValue="42" />
          <p className="k-sans mt-2 text-[11px] text-[var(--k-on-light-muted)]">
            Units on hand across all boutiques.
          </p>
        </div>
      </div>

      <div className="mt-7 flex flex-wrap gap-3">
        <button type="button" className="k-btn k-btn-primary">
          Save changes
        </button>
        <button type="button" className="k-btn k-btn-ghost">
          Discard
        </button>
      </div>
    </form>
  );
}

/** The mobile admin header — the drawer trigger §29 asks for. */
export function AdminMobileBar() {
  return (
    <div className="k-charcoal flex h-14 items-center gap-3 px-4">
      <Menu
        size={18}
        strokeWidth={1.25}
        className="text-[var(--k-on-dark)]"
        aria-hidden
      />
      <p className="k-serif text-[11px] uppercase tracking-[0.28em] text-[var(--k-gold)]">
        KHEM
      </p>
      <p className="k-sans ms-auto text-[9px] uppercase tracking-[0.2em] text-[rgba(184,179,170,0.6)]">
        Orders
      </p>
    </div>
  );
}
