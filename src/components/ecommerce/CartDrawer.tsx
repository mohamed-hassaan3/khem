"use client";

import { ShoppingBag, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import CartDrawerLine from "@/src/components/ecommerce/CartDrawerLine";
import DeliveryProgress from "@/src/components/ecommerce/DeliveryProgress";
import LocaleLink from "@/src/components/i18n/LocaleLink";
import { cartTotalInCents, shippingInCents } from "@/src/lib/cart";
import { cartPricing } from "@/src/lib/pricing";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { useCart } from "@/src/providers/cart-provider";
import { useCartDrawer } from "@/src/providers/cart-drawer-provider";
import { useFormatPrice } from "@/src/providers/currency-provider";
import { useDeliveryTerms } from "@/src/providers/delivery-provider";
import { useDictionary, useLocale } from "@/src/providers/i18n-provider";
import type { ProductCardData } from "@/src/types/catalog";

/**
 * The shopping bag as a panel — a modal dialog that slides in from the logical
 * end edge.
 *
 * ## Layout
 *
 * Deliberately **never full-bleed**, at any width. A strip of the page stays
 * visible behind it on the narrowest phone, which is what tells the visitor
 * this is a panel over their place in the catalog rather than a navigation
 * away from it — the whole point of a drawer instead of the `/cart` route,
 * which still exists and is one click away in the footer of this panel.
 *
 * It is anchored to `end`, not `right`: the right edge in English and the left
 * edge in Arabic, matching `<SearchOverlay>` and the mobile nav drawer.
 * Transforms are *not* mirrored by `dir`, so the RTL offset is written out
 * explicitly — the gotcha `Nav.tsx` documents.
 *
 * ## Why it stays mounted
 *
 * Rendering it conditionally would skip the exit transition, so it is always in
 * the tree and `inert` when closed. `inert` also removes it from the tab order
 * and the accessibility tree, which `aria-hidden` alone would not do.
 *
 * ## Where the products come from
 *
 * The persisted bag holds ids and quantities only. This panel lives on every
 * route, so it cannot be handed a catalog by a page — it fetches one from
 * `/api/cart/catalog` on the first open and holds it for the session. That
 * route's header comment explains why the layout does not fetch it instead.
 *
 * The resolution rules are `<CartView>`'s, and for the same reasons: a stored
 * id with no matching product silently drops out rather than rendering a ghost
 * line, and nothing out of `localStorage` is ever rendered as text.
 */

/** Focusable descendants, for the tab trap — the `<SearchOverlay>` selector. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])';

/** Narrows the fetch response. A cast here would defeat the point of the route. */
function isCartCatalog(value: unknown): value is { catalog: ProductCardData[] } {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { catalog?: unknown }).catalog)
  );
}

export default function CartDrawer() {
  const dict = useDictionary();
  const locale = useLocale();
  const formatPrice = useFormatPrice();
  const { isOpen, close } = useCartDrawer();
  const { lines, isHydrated, setQuantity, removeLine } = useCart();

  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  /** Whatever had focus when the panel opened — the Nav bag, or a card's control. */
  const triggerRef = useRef<HTMLElement | null>(null);
  const headingId = useId();

  const [catalog, setCatalog] = useState<readonly ProductCardData[] | null>(null);
  const [hasFailed, setHasFailed] = useState(false);

  /*
   * One fetch per session: `catalog` is only ever set once, so reopening the
   * panel does not pay for a second round trip. A close *during* the request
   * aborts it and the next open starts over — the response is CDN-cached by
   * then, and the alternative is holding a controller outside React's
   * lifecycle to save a few hundred milliseconds that nobody experiences.
   */
  useEffect(() => {
    if (!isOpen || catalog !== null || hasFailed) return;

    const controller = new AbortController();
    let ignore = false;

    void (async () => {
      try {
        const response = await fetch(
          `/api/cart/catalog?locale=${encodeURIComponent(locale)}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const payload: unknown = await response.json();
        if (ignore) return;

        if (isCartCatalog(payload)) setCatalog(payload.catalog);
        else setHasFailed(true);
      } catch (error) {
        if (ignore || controller.signal.aborted) return;
        console.error("[CartDrawer] catalog fetch failed", error);
        setHasFailed(true);
      }
    })();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [isOpen, catalog, hasFailed, locale]);

  /*
   * Remember the trigger and hand focus to the close button; on close, put
   * focus back where it was. A modal that drops focus on `<body>` strands a
   * keyboard visitor at the top of the document — and here the trigger may be
   * a card control halfway down a long grid.
   *
   * Focus is moved on the next frame for the reason `<SearchOverlay>` gives:
   * focusing an element mid-transform makes iOS Safari scroll to chase it.
   */
  useEffect(() => {
    if (!isOpen) return;

    const active = document.activeElement;
    triggerRef.current = active instanceof HTMLElement ? active : null;

    const frame = requestAnimationFrame(() => closeButtonRef.current?.focus());

    return () => {
      cancelAnimationFrame(frame);
      triggerRef.current?.focus();
      triggerRef.current = null;
    };
  }, [isOpen]);

  // Lock the page behind the panel; release on close and on unmount.
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }

      // A tab trap, not a suggestion: a modal dialog must not leak focus to the
      // page it is covering.
      if (event.key !== "Tab") return;

      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!focusable || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [close],
  );

  const productsById = useMemo(
    () => new Map((catalog ?? []).map((product) => [product.id, product])),
    [catalog],
  );

  const resolved = useMemo(
    () =>
      lines.flatMap((line) => {
        const product = productsById.get(line.productId);
        return product ? [{ product, quantity: line.quantity }] : [];
      }),
    [lines, productsById],
  );

  /*
   * The same breakdown `<CartSummary>` prints, from the same function — the
   * panel and the page must never disagree about what the bag is worth, and the
   * surest way to guarantee that is for neither to do the sum itself.
   */
  const pricing = cartPricing(resolved);
  const subtotal = pricing.subtotalInCents;

  /*
   * Delivery and total, judged on the promoted subtotal exactly as the bag
   * page (`<CartSummary>`) judges them, from the same stored terms. Display
   * only: the checkout action reprices everything on the server.
   */
  const terms = useDeliveryTerms();
  const shipping = shippingInCents(subtotal, terms);
  const total = cartTotalInCents(subtotal, terms);

  const itemCount = resolved.reduce((sum, line) => sum + line.quantity, 0);

  /*
   * `isHydrated` gates the count the same way `<CartView>` gates its empty
   * state: the server render cannot know the bag, and a `0` painted before the
   * store is read would flicker to the real number.
   */
  const countLabel =
    isHydrated && catalog !== null
      ? itemCount === 1
        ? dict.cart.itemCountOne
        : interpolate(dict.cart.itemCount, { count: itemCount })
      : "";

  const isLoading = !isHydrated || (catalog === null && !hasFailed);
  const isEmpty = !isLoading && !hasFailed && resolved.length === 0;

  return (
    <>
      {/* ── SCRIM ──────────────────────────────────── */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        inert={!isOpen}
        onClick={close}
        className={[
          "fixed inset-0 z-1050 cursor-default bg-ink/40 backdrop-blur-sm",
          "transition-opacity duration-400 ease-luxury-bezier",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
      />

      {/* ── PANEL ──────────────────────────────────── */}
      <div
        ref={panelRef}
        id="cart-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        aria-hidden={!isOpen}
        inert={!isOpen}
        onKeyDown={onKeyDown}
        className={[
          /*
           * An explicit ground, not an inherited one. This is a `fixed` overlay
           * but it is still a *descendant* in the tree, so it would otherwise
           * pick up the foreground variables of whichever page it is covering.
           * An overlay is its own surface, and states it.
           *
           * Ivory now, and opaque. The panel was 97% obsidian over a
           * `blur(40px)`: three percent of a blur nobody could see, on a
           * `fixed` element, which the compositor keeps live for as long as the
           * element is in the DOM — and this one is mounted on every route.
           * The scrim behind it still carries the blur, where it is doing
           * visible work separating the panel from the page.
           */
          "ground-ivory fixed inset-y-0 end-0 z-1051 flex flex-col",
          // Never full-bleed: a strip of the page stays visible at every width.
          "w-[min(92.8vw,25rem)] lg:w-110",
          "border-s border-ground-border bg-ground-bg",
          "shadow-3",
          "transition-transform duration-500 ease-luxury-bezier",
          // `dir` does not mirror transforms — the RTL offset is explicit.
          isOpen ? "translate-x-0" : "translate-x-full rtl:-translate-x-full",
        ].join(" ")}
      >
        {/* ── HEADER ─────────────────────────────── */}
        <div className="flex shrink-0 items-center justify-between border-b border-ground-border py-2.5 ps-4.5 pe-2">
          <h2
            id={headingId}
            className="font-heading text-lg font-normal tracking-wide text-ground"
          >
            {dict.cart.drawer.heading}
            {countLabel ? (
              <span className="ms-1.5 font-body text-xs tracking-normal text-ground-muted">
                · {itemCount}
                <span className="sr-only"> {countLabel}</span>
              </span>
            ) : null}
          </h2>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={close}
            aria-label={dict.cart.drawer.close}
            className="grid size-11 cursor-pointer place-items-center text-ground transition-colors duration-300 ease-out hover:text-ground-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ground-accent"
          >
            <X size={20} strokeWidth={1.25} aria-hidden="true" />
          </button>
        </div>

        {/*
          The free-delivery threshold is a real perk, so the drawer shows how
          close the bag is to it. Same terms and the same promoted subtotal as
          the bag page's nudge.
        */}
        {resolved.length > 0 && !isLoading && !hasFailed ? (
          <DeliveryProgress
            subtotalInCents={subtotal}
            className="shrink-0 border-b border-ground-border px-4.5 py-3.5"
          />
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-4.5">
          {isLoading ? (
            /*
             * Skeleton rows, not a spinner: the panel already has its final
             * geometry, so holding that shape while the catalog lands reads as
             * the bag filling in rather than as the page thinking.
             */
            <div aria-hidden="true" className="pt-6">
              {[0, 1, 2].map((row) => (
                <div
                  key={row}
                  className="mb-6 grid grid-cols-[72px_1fr] gap-4"
                >
                  <div className="aspect-3/4 bg-stone" />
                  <div className="space-y-2 pt-1">
                    <div className="h-3 w-3/4 bg-stone" />
                    <div className="h-2.5 w-1/2 bg-stone" />
                    <div className="mt-5 h-8 w-24 bg-stone" />
                  </div>
                </div>
              ))}
            </div>
          ) : hasFailed ? (
            <div className="flex min-h-60 flex-col items-center justify-center text-center">
              <p className="mb-6 text-[13px] leading-loose text-ground-muted">
                {dict.cart.drawer.error}
              </p>
              <LocaleLink
                href="/cart"
                onClick={close}
                className="btn btn-primary"
              >
                {dict.cart.drawer.viewBag}
              </LocaleLink>
            </div>
          ) : isEmpty ? (
            <div className="flex min-h-60 flex-col items-center justify-center px-2 py-14 text-center">
              <ShoppingBag
                size={44}
                strokeWidth={0.8}
                aria-hidden="true"
                className="mb-7 text-ground-accent/30"
              />
              <h3 className="mb-3 font-heading text-xl font-normal text-ground">
                {dict.cart.empty.heading}
              </h3>
              <p className="mb-9 text-[12px] leading-loose text-ground-muted">
                {dict.cart.empty.body}
              </p>
              <LocaleLink
                href="/collections"
                onClick={close}
                className="btn btn-primary"
              >
                {dict.cart.empty.cta}
              </LocaleLink>
            </div>
          ) : (
            <>
              {resolved.map(({ product, quantity }) => (
                <CartDrawerLine
                  key={product.id}
                  product={product}
                  quantity={quantity}
                  locale={locale}
                  onQuantityChange={(next) =>
                    setQuantity(product.id, next, product.inventory)
                  }
                  onRemove={() => removeLine(product.id)}
                  onNavigate={close}
                />
              ))}

              {/* One live region for the whole panel — a per-line one would
                  announce every neighbouring total on each step. */}
              <p aria-live="polite" className="sr-only">
                {interpolate(dict.cart.updated, {
                  count: itemCount,
                  total: formatPrice(subtotal),
                })}
              </p>
            </>
          )}
        </div>

        {/* ── FOOTER ─────────────────────────────── */}
        {resolved.length > 0 && !isLoading && !hasFailed ? (
          <div className="shrink-0 border-t border-ground-border bg-ground-bg px-4.5 pt-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
            {/*
              Subtotal at list price with the campaign on its own line, the way
              the bag page prints it, so the two screens never disagree.
            */}
            <dl className="text-[13px]">
              <div className="flex justify-between py-0.5">
                <dt className="text-ground-muted">{dict.cart.subtotal}</dt>
                <dd className="tabular-nums text-ground">
                  {formatPrice(pricing.listSubtotalInCents)}
                </dd>
              </div>
              {pricing.promotionSavingsInCents > 0 ? (
                <div className="flex justify-between py-0.5">
                  <dt className="text-ground-muted">{dict.cart.promotion}</dt>
                  <dd className="tabular-nums text-ground-accent">
                    −{formatPrice(pricing.promotionSavingsInCents)}
                  </dd>
                </div>
              ) : null}
              <div className="flex justify-between py-0.5">
                <dt className="text-ground-muted">{dict.cart.shipping}</dt>
                <dd
                  className={
                    shipping === 0
                      ? "text-ground-accent"
                      : "tabular-nums text-ground"
                  }
                >
                  {shipping === 0
                    ? dict.cart.complimentary
                    : formatPrice(shipping)}
                </dd>
              </div>
              <div className="mt-1.5 flex justify-between border-t border-ground-border pt-2 font-heading text-base">
                <dt className="text-ground">{dict.cart.total}</dt>
                <dd className="tabular-nums text-ground-accent">
                  {formatPrice(total)}
                </dd>
              </div>
            </dl>

            <LocaleLink
              href="/checkout"
              onClick={close}
              className="btn btn-primary mt-3 h-[50px] w-full justify-center rounded-md"
            >
              {interpolate(dict.cart.drawer.checkoutTotal, {
                amount: formatPrice(total),
              })}
            </LocaleLink>

            <button
              type="button"
              onClick={close}
              className="mt-1 min-h-11 w-full cursor-pointer text-center text-[11px] uppercase tracking-[0.14em] text-ground-muted transition-colors duration-300 ease-out hover:text-ground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ground-accent"
            >
              {dict.cart.continueShopping}
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}
