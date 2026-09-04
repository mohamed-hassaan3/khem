"use client";

/**
 * Recording a sale at the desk.
 *
 * ## What this form does not do
 *
 * It does not price anything. Each line carries a slug and a quantity, and the
 * amount charged is computed inside `place_order()` from the catalog row. The
 * running total below is a *preview*, computed from the same prices the server
 * will use, and it says so — a form that could name its own price is a form
 * that can sell a bottle for nothing.
 *
 * It also does not enforce stock. The ceiling shown beside each line is the
 * count at page load; the authoritative check happens under a row lock in the
 * database, because between rendering this form and pressing the button
 * somebody else may have sold the last one. The stepper's max is a courtesy,
 * the database's exception is the rule, and the error it raises is rendered
 * verbatim above the lines.
 *
 * State lives here and the primitives stay presentational, the same
 * arrangement `ProductForm` uses.
 */

import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { createOrder } from "@/src/actions/admin/orders";
import {
  AdminButton,
  AdminInput,
  AdminNotice,
  AdminSelect,
  AdminTextarea,
} from "@/src/components/admin/fields";
import { useUnsavedGuard } from "@/src/hooks/useUnsavedGuard";
import { useAdminToast } from "@/src/providers/admin-toast-provider";
import { egp } from "@/src/lib/admin/money";
import { localizePath, type Locale } from "@/src/lib/i18n/config";
import { shippingInCents, DEFAULT_DELIVERY_TERMS } from "@/src/lib/cart";
import { stockState } from "@/src/lib/inventory";
import type { AdminActionResult } from "@/src/schemas/orders";
import type { DeliverySetting } from "@/src/schemas/db/delivery";

/** What the form needs to know about a sellable product. */
export interface SellableProduct {
  slug: string;
  name: string;
  priceInCents: number;
  inventory: number;
}

interface Line {
  /** A stable key so removing the middle line does not remount the others. */
  key: string;
  slug: string;
  quantity: string;
}

function newLine(): Line {
  return { key: crypto.randomUUID(), slug: "", quantity: "1" };
}

export default function OrderForm({
  locale,
  products,
  deliveryTerms,
}: {
  locale: Locale;
  products: readonly SellableProduct[];
  /** Both rows from `"DeliverySetting"`; empty if they could not be read. */
  deliveryTerms: readonly DeliverySetting[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<AdminActionResult | null>(null);

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [channel, setChannel] = useState("ONLINE");
  const [shipEgp, setShipEgp] = useState("");
  /*
   * Whether the desk has typed a delivery figure of its own.
   *
   * Until it has, the field follows the house terms for the selected channel and
   * the running subtotal — which is the point of making them editable. Once
   * somebody types in it, it stops moving: a delivery arranged at the counter is
   * frequently not the standard one, and a field that silently re-derived itself
   * after a quantity change would overwrite a figure that had been agreed with a
   * customer on the telephone.
   */
  const [shipTouched, setShipTouched] = useState(false);
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>([newLine()]);

  const bySlug = useMemo(
    () => new Map(products.map((product) => [product.slug, product])),
    [products],
  );

  const productOptions = useMemo(
    () => [
      { value: "", label: "Choose a product…" },
      ...products.map((product) => ({
        value: product.slug,
        label:
          product.inventory === 0
            ? `${product.name} — out of stock`
            : `${product.name} — ${product.inventory} in stock`,
      })),
    ],
    [products],
  );

  /**
   * The preview total. Piastres throughout, converted once for display, so the
   * rounding here is the same rounding the database performs.
   */
  const subtotalInCents = lines.reduce((sum, line) => {
    const product = bySlug.get(line.slug);
    const quantity = Number(line.quantity);
    if (!product || !Number.isFinite(quantity) || quantity < 1) return sum;
    return sum + product.priceInCents * Math.trunc(quantity);
  }, 0);

  /*
   * The terms for the channel the desk has chosen. `DEFAULT_DELIVERY_TERMS` when
   * the rows could not be read — the same fallback the storefront quotes, so a
   * database the dashboard cannot reach does not make the counter charge
   * something different from the website.
   */
  const terms =
    deliveryTerms.find((row) => row.channel === channel) ??
    DEFAULT_DELIVERY_TERMS;

  const suggestedShipInCents = shippingInCents(subtotalInCents, terms);

  const shipInCents = shipTouched
    ? Math.max(0, Math.round(Number(shipEgp || "0") * 100))
    : suggestedShipInCents;

  /** What the input shows: the typed figure, or the suggestion behind it. */
  const shipValue = shipTouched
    ? shipEgp
    : (suggestedShipInCents / 100).toFixed(2);

  const fieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {};

  function updateLine(key: string, patch: Partial<Line>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  /*
   * Hoisted out of `submit()` so it can be compared as well as posted: this
   * one object is both what the action receives and what `useUnsavedGuard`
   * watches, so a field that reaches the server necessarily reaches the
   * comparison too.
   */
  const payload = {
    customerName,
    customerEmail,
    customerPhone,
    channel,
    note,
    shipInCents,
    items: lines
      .filter((line) => line.slug.length > 0)
      .map((line) => ({ slug: line.slug, quantity: line.quantity })),
  };

  const { toast } = useAdminToast();

  const { markSaved } = useUnsavedGuard({
    payload,
    save: () => persist(),
    pending: isPending,
  });

  /** Saves and reports whether it worked. Awaited by the leave-page dialog. */
  async function persist(): Promise<boolean> {
    setResult(null);

    const outcome = await createOrder(payload);

    /*
     * Successes leave, failures stay. A receipt has done its job the moment it
     * is read; a refusal names a field and has to be acted on, so it keeps its
     * place above the form. See `admin-toast-provider.tsx`.
     */
    if (outcome.ok) toast(outcome.message);
    setResult(outcome.ok ? null : outcome);

    if (outcome.ok) {
      // Straight to the order that was just created: the next thing a desk
      // does is mark it paid or print it, and both live there.
      router.push(localizePath(locale, `/admin/orders/${outcome.slug}`));
      router.refresh();
    }

    // The form now matches the row, so leaving it is no longer losing anything.
    if (outcome.ok) markSaved();
    return outcome.ok;
  }

  function submit() {
    /*
     * The callback stays `async` and awaits: React 19 keeps `isPending` true for
     * the life of an async transition, and a synchronous callback that merely
     * *starts* the promise would drop the flag immediately — the save button
     * would stop saying "Saving" the instant it was pressed.
     */
    startTransition(async () => {
      await persist();
    });
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="max-w-3xl space-y-10"
    >
      {result && !result.ok ? (
        <AdminNotice tone="error">{result.message}</AdminNotice>
      ) : null}

      {products.length === 0 ? (
        <AdminNotice tone="error">
          There is nothing to sell — every product is archived or the catalog is
          empty.
        </AdminNotice>
      ) : null}

      {/* ── Customer ─────────────────────────────────────── */}
      <section className="space-y-6">
        <h2 className="font-heading text-[10px] uppercase tracking-[0.25em] text-ground-accent">
          Customer
        </h2>

        <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
          <AdminInput
            id="customerName"
            label="Name"
            required
            value={customerName}
            error={fieldErrors.customerName}
            onChange={setCustomerName}
            hint="A walk-in needs a name on the order; everything else is optional."
          />

          <AdminSelect
            id="channel"
            label="Channel"
            value={channel}
            onChange={setChannel}
            error={fieldErrors.channel}
            options={[
              { value: "ONLINE", label: "Online — placed through the site" },
              { value: "OFFLINE", label: "Offline — recorded at the boutique" },
            ]}
            hint="Both draw stock from the same website inventory. This records where the sale came from."
          />

          <AdminInput
            id="customerEmail"
            label="Email"
            value={customerEmail}
            error={fieldErrors.customerEmail}
            onChange={setCustomerEmail}
          />

          <AdminInput
            id="customerPhone"
            label="Phone"
            value={customerPhone}
            error={fieldErrors.customerPhone}
            onChange={setCustomerPhone}
          />
        </div>
      </section>

      {/* ── Lines ────────────────────────────────────────── */}
      <section className="space-y-6">
        <h2 className="font-heading text-[10px] uppercase tracking-[0.25em] text-ground-accent">
          Products
        </h2>

        {fieldErrors.items ? (
          <AdminNotice tone="error">{fieldErrors.items}</AdminNotice>
        ) : null}

        <div className="space-y-5">
          {lines.map((line, index) => {
            const product = bySlug.get(line.slug);
            const state = product ? stockState(product.inventory) : "in";

            return (
              <div
                key={line.key}
                className="grid gap-4 border border-ground-border p-5 sm:grid-cols-[1fr_120px_auto] sm:items-end"
              >
                <AdminSelect
                  id={`line-${line.key}-slug`}
                  label={`Line ${index + 1}`}
                  value={line.slug}
                  onChange={(slug) => updateLine(line.key, { slug })}
                  options={productOptions}
                  error={fieldErrors[`items.${index}.slug`]}
                  hint={
                    product
                      ? `${egp(product.priceInCents)} each · ${product.inventory} in stock${
                          state === "low" ? " — running low" : ""
                        }`
                      : undefined
                  }
                />

                <AdminInput
                  id={`line-${line.key}-qty`}
                  label="Qty"
                  type="number"
                  min={1}
                  value={line.quantity}
                  error={fieldErrors[`items.${index}.quantity`]}
                  onChange={(quantity) => updateLine(line.key, { quantity })}
                />

                <div className="pb-1">
                  <button
                    type="button"
                    onClick={() =>
                      setLines((current) =>
                        current.length === 1
                          ? [newLine()]
                          : current.filter((row) => row.key !== line.key),
                      )
                    }
                    aria-label={`Remove line ${index + 1}`}
                    className="border border-ground-border p-3 text-ground-muted transition-colors duration-300 hover:border-danger/50 hover:text-danger"
                  >
                    <X size={13} strokeWidth={1.25} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <AdminButton variant="ghost" onClick={() => setLines((c) => [...c, newLine()])}>
          <Plus size={13} strokeWidth={1.25} />
          Add line
        </AdminButton>
      </section>

      {/* ── Totals ───────────────────────────────────────── */}
      <section className="space-y-6">
        <h2 className="font-heading text-[10px] uppercase tracking-[0.25em] text-ground-accent">
          Totals
        </h2>

        <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
          <AdminInput
            id="shipEgp"
            label="Delivery (EGP)"
            type="number"
            min={0}
            step="0.01"
            value={shipValue}
            error={fieldErrors.shipInCents}
            onChange={(value) => {
              setShipTouched(true);
              setShipEgp(value);
            }}
            hint={
              shipTouched
                ? "Your figure, and it stays: changing a line will not recompute it. Zero for a collection at the boutique."
                : `From the ${channel === "ONLINE" ? "online" : "offline"} terms in Settings — ${egp(terms.feeInCents)} below ${egp(terms.freeThresholdInCents)}. Type over it for anything agreed at the counter.`
            }
          />

          <AdminTextarea
            id="note"
            label="Desk note"
            rows={3}
            value={note}
            error={fieldErrors.note}
            onChange={setNote}
            hint="Never shown to the customer."
          />
        </div>

        <dl className="border border-ground-border p-6 text-[12px] tracking-wide">
          <div className="flex justify-between py-1">
            <dt className="text-ground-muted">Subtotal</dt>
            <dd className="text-ground">{egp(subtotalInCents)}</dd>
          </div>
          <div className="flex justify-between py-1">
            <dt className="text-ground-muted">Delivery</dt>
            <dd className="text-ground">{egp(shipInCents)}</dd>
          </div>
          <div className="mt-3 flex justify-between border-t border-ground-border pt-3">
            <dt className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
              Total
            </dt>
            <dd className="font-heading text-[13px] tracking-[0.1em] text-ground-accent">
              {egp(subtotalInCents + shipInCents)}
            </dd>
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-ground-subtle">
            A preview. The order is priced from the catalog when it is saved, so
            a price edited in another tab wins over this figure.
          </p>
        </dl>
      </section>

      <div className="flex items-center gap-4 border-t border-ground-border pt-8">
        <AdminButton type="submit" disabled={isPending || products.length === 0}>
          {isPending ? "Recording…" : "Record order"}
        </AdminButton>
      </div>
    </form>
  );
}
