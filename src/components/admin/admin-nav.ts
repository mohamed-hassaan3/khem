import {
  BarChart3,
  Boxes,
  Compass,
  FileText,
  Gift,
  House,
  LayoutList,
  Library,
  Mail,
  MapPin,
  Megaphone,
  Package,
  Receipt,
  Search,
  Send,
  Settings,
  Sparkles,
  Tag,
  BadgePercent,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/**
 * The Desk's information architecture — one table for the desktop rail, the
 * phone menu, the phone tab bar, the section tabs and the jump search, so no
 * two of them can ever disagree about where something lives
 * (prompts/admin-redesign-stage-6.md).
 *
 * Grouped by the job an admin is doing, named in plain words, each with a
 * one-line description. **No route moved**: every `href` is the URL it always
 * was, so bookmarks, emails and the in-code references keep working. Several
 * old rail rows now live as tabs inside one entry (Points + Credits are
 * "Loyalty"; Collections, Categories and Scent families are one entry), which
 * is what `tabs` and `match` express.
 */

export interface AdminTab {
  label: string;
  href: string;
  /** Extra path prefixes that light this tab (sub-pages that are not under `href`). */
  match?: readonly string[];
}

export interface AdminNavEntry {
  key: string;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  /** Every path prefix this entry owns. Defaults to `[href]`. */
  match?: readonly string[];
  /** Shown as a tab row above the page while inside this entry. */
  tabs?: readonly AdminTab[];
  /** Extra words the jump search should find this entry by. */
  keywords?: string;
}

export interface AdminNavGroup {
  key: string;
  /** `null` for the ungrouped Today row. */
  label: string | null;
  entries: readonly AdminNavEntry[];
}

export const ADMIN_NAV: readonly AdminNavGroup[] = [
  {
    key: "today",
    label: null,
    entries: [
      {
        key: "today",
        label: "Today",
        description: "What needs you now, and the last 30 days",
        href: "/admin",
        icon: House,
        keywords: "dashboard home overview",
      },
    ],
  },
  {
    key: "sell",
    label: "Sell",
    entries: [
      {
        key: "orders",
        label: "Orders",
        description: "Open, prepare, ship, refund",
        href: "/admin/orders",
        icon: Receipt,
        keywords: "fulfil ship refund manual order",
      },
      {
        key: "customers",
        label: "Customers",
        description: "Registered and walk-in, invite someone",
        href: "/admin/customers",
        icon: Users,
        tabs: [
          { label: "Customers", href: "/admin/customers" },
          { label: "Invitations", href: "/admin/customers/invitations" },
        ],
        keywords: "people clients invite invitation walk-in",
      },
      {
        key: "loyalty",
        label: "Loyalty",
        description: "Points and Discovery credits",
        href: "/admin/rewards",
        icon: Sparkles,
        match: ["/admin/rewards", "/admin/credits"],
        tabs: [
          { label: "Points", href: "/admin/rewards" },
          { label: "Discovery credits", href: "/admin/credits" },
        ],
        keywords: "rewards points credits balance",
      },
    ],
  },
  {
    key: "catalogue",
    label: "Catalogue",
    entries: [
      {
        key: "products",
        label: "Products",
        description: "Fragrances, sets, prices, photos",
        href: "/admin/products",
        icon: Package,
        keywords: "perfume fragrance price sku",
      },
      {
        key: "collections",
        label: "Collections & categories",
        description: "How the shop is organised",
        href: "/admin/collections",
        icon: Library,
        match: ["/admin/collections", "/admin/categories"],
        tabs: [
          { label: "Collections", href: "/admin/collections" },
          { label: "Categories", href: "/admin/categories" },
          { label: "Scent families", href: "/admin/categories/scent-families" },
        ],
        keywords: "shelf category scent family",
      },
      {
        key: "stock",
        label: "Stock",
        description: "Quantities and stock history",
        href: "/admin/inventory",
        icon: Boxes,
        tabs: [
          { label: "Quantities", href: "/admin/inventory" },
          { label: "History", href: "/admin/inventory/history" },
        ],
        keywords: "inventory quantity low stock movement",
      },
    ],
  },
  {
    key: "marketing",
    label: "Marketing",
    entries: [
      {
        key: "campaigns",
        label: "Email campaigns",
        description: "Write, test, schedule, see who got it",
        href: "/admin/campaigns",
        icon: Send,
        keywords: "email letter newsletter send",
      },
      {
        key: "subscribers",
        label: "Subscribers",
        description: "The newsletter list, English and Arabic",
        href: "/admin/newsletter",
        icon: Mail,
        keywords: "newsletter inner circle list",
      },
      {
        key: "discounts",
        label: "Discount codes",
        description: "Codes customers type at checkout",
        href: "/admin/discounts",
        icon: Tag,
        keywords: "voucher coupon code",
      },
      {
        key: "sales",
        label: "Sale prices",
        description: "Reduced prices on products (was “Promotions”)",
        href: "/admin/promotions",
        icon: BadgePercent,
        keywords: "promotions promotion sale price reduction",
      },
      {
        key: "offers",
        label: "Welcome offers",
        description: "The sign-up gift (was “Offers”)",
        href: "/admin/offers",
        icon: Gift,
        keywords: "offers popup signup gift",
      },
      {
        key: "announcements",
        label: "Announcement bar",
        description: "The line at the top of every page, and the pop-up's look",
        href: "/admin/announcements",
        icon: Megaphone,
        keywords: "banner marquee announcement",
      },
    ],
  },
  {
    key: "website",
    label: "Website",
    entries: [
      {
        key: "landing",
        label: "Home page",
        description: "Hero, bands and their order",
        href: "/admin/content/landing",
        icon: LayoutList,
        keywords: "landing hero",
      },
      {
        key: "story",
        label: "Story pages",
        description: "Heritage, craft, ingredients, about, journal",
        href: "/admin/content/world",
        icon: FileText,
        match: [
          "/admin/content/world",
          "/admin/content/heritage",
          "/admin/content/craftsmanship",
          "/admin/content/ingredients",
          "/admin/content/about",
          "/admin/journal",
        ],
        tabs: [
          { label: "Overview", href: "/admin/content/world" },
          { label: "Heritage", href: "/admin/content/heritage" },
          { label: "Craftsmanship", href: "/admin/content/craftsmanship" },
          { label: "Ingredients", href: "/admin/content/ingredients" },
          { label: "About", href: "/admin/content/about" },
          { label: "Journal", href: "/admin/journal" },
          { label: "Testimonials", href: "/admin/content/world/testimonials" },
        ],
        keywords: "world of khem heritage craftsmanship ingredients about journal articles testimonials",
      },
      {
        key: "navigation",
        label: "Menu & footer",
        description: "The site's navigation links",
        href: "/admin/navigation",
        icon: Compass,
        keywords: "navigation nav menu footer links",
      },
      {
        key: "stockists",
        label: "Stockists",
        description: "Boutiques and partners",
        href: "/admin/stockists",
        icon: MapPin,
        keywords: "stores boutiques map",
      },
    ],
  },
  {
    key: "money",
    label: "Money & reports",
    entries: [
      {
        key: "sales-profit",
        label: "Sales & profit",
        description: "Revenue, margins, items sold",
        href: "/admin/sales",
        icon: BarChart3,
        match: ["/admin/sales", "/admin/analytics"],
        tabs: [
          { label: "Overview", href: "/admin/sales" },
          { label: "Trend", href: "/admin/analytics" },
          { label: "Items sold", href: "/admin/sales/items" },
        ],
        keywords: "analytics revenue profit margin items sold ledger",
      },
      {
        key: "finance",
        label: "Finance",
        description: "Expenses, targets, monthly reports",
        href: "/admin/finance",
        icon: Wallet,
        tabs: [
          { label: "Overview", href: "/admin/finance" },
          {
            label: "Expenses",
            href: "/admin/finance/expenses",
            match: ["/admin/finance/recurring", "/admin/finance/categories"],
          },
          { label: "Targets", href: "/admin/finance/targets" },
          { label: "Reports", href: "/admin/finance/reports" },
        ],
        keywords: "expenses targets reports money",
      },
      {
        key: "search",
        label: "Site search",
        description: "What visitors look for",
        href: "/admin/search",
        icon: Search,
        keywords: "queries visitors search terms",
      },
    ],
  },
  {
    key: "system",
    label: null,
    entries: [
      {
        key: "settings",
        label: "Settings",
        description: "Delivery, store details, marketing defaults",
        href: "/admin/settings",
        icon: Settings,
        keywords: "delivery shipping store configuration",
      },
    ],
  },
];

/** Every entry, flattened, in menu order. */
export const ADMIN_ENTRIES: readonly AdminNavEntry[] = ADMIN_NAV.flatMap(
  (group) => group.entries,
);

/** True when `path` (locale-stripped) is `prefix` or below it. */
function under(path: string, prefix: string): boolean {
  if (prefix === "/admin") return path === "/admin";
  return path === prefix || path.startsWith(`${prefix}/`);
}

/**
 * The entry a (locale-stripped) path belongs to: the longest matching prefix
 * over every entry, so `/admin/categories/scent-families` is Collections &
 * categories and `/admin/content` (the old hub) falls to Story pages.
 */
export function activeEntry(path: string): AdminNavEntry | null {
  let best: { entry: AdminNavEntry; length: number } | null = null;

  for (const entry of ADMIN_ENTRIES) {
    for (const prefix of [...(entry.match ?? [entry.href]), ...(entry.tabs ?? []).flatMap((tab) => [tab.href, ...(tab.match ?? [])])]) {
      if (under(path, prefix) && (!best || prefix.length > best.length)) {
        best = { entry, length: prefix.length };
      }
    }
  }

  if (best) return best.entry;
  // The old Content hub has no row of its own; it opens onto the story pages.
  if (under(path, "/admin/content")) {
    return ADMIN_ENTRIES.find((entry) => entry.key === "story") ?? null;
  }
  return null;
}

/** The tab of `entry` the path is on: longest match wins. */
export function activeTab(entry: AdminNavEntry, path: string): AdminTab | null {
  let best: { tab: AdminTab; length: number } | null = null;
  for (const tab of entry.tabs ?? []) {
    for (const prefix of [tab.href, ...(tab.match ?? [])]) {
      if (under(path, prefix) && (!best || prefix.length > best.length)) {
        best = { tab, length: prefix.length };
      }
    }
  }
  return best?.tab ?? null;
}

/** The group key of an entry. */
export function groupOf(entry: AdminNavEntry | null): string | null {
  if (!entry) return null;
  return ADMIN_NAV.find((group) => group.entries.includes(entry))?.key ?? null;
}

/** An order number as the house writes it, e.g. `KHEM-2026-1192`. */
export const ORDER_NUMBER = /^khem-\d{4}-\d+$/i;
