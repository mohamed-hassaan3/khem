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
import { egp } from "@/src/lib/admin/money";
import { localizePath, type Locale } from "@/src/lib/i18n/config";
import { stockState } from "@/src/lib/inventory";
import type { AdminActionResult } from "@/src/schemas/orders";

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
}: {
  locale: Locale;
  products: readonly SellableProduct[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<AdminActionResult | null>(null);

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [channel, setChannel] = useState("OFFLINE");
  const [shipEgp, setShipEgp] = useState("0");
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

  const shipInCents = Math.max(0, Math.round(Number(shipEgp || "0") * 100));

  const fieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {};

  function updateLine(key: string, patch: Partial<Line>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  function submit() {
    setResult(null);

    startTransition(async () => {
      const outcome = await createOrder({
        customerName,
        customerEmail,
        customerPhone,
        channel,
        note,
        shipInCents,
        items: lines
          .filter((line) => line.slug.length > 0)
          .map((line) => ({ slug: line.slug, quantity: line.quantity })),
      });

      setResult(outcome);

      if (outcome.ok) {
        // Straight to the order that was just created: the next thing a desk
        // does is mark it paid or print it, and both live there.
        router.push(localizePath(locale, `/admin/orders/${outcome.slug}`));
        router.refresh();
      }
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
        <h2 className="font-heading text-[10px] uppercase tracking-[0.25em] text-gold/70">
          Customer
        </h2>

        <div className="grid gap-6 sm:grid-cols-2">
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
              { value: "OFFLINE", label: "Offline — recorded at the boutique" },
              { value: "ONLINE", label: "Online — placed through the site" },
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
        <h2 className="font-heading text-[10px] uppercase tracking-[0.25em] text-gold/70">
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
                className="grid gap-4 border border-border p-5 sm:grid-cols-[1fr_120px_auto] sm:items-end"
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
                    className="border border-border p-3 text-ivory/35 transition-colors duration-300 hover:border-danger/50 hover:text-danger"
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
        <h2 className="font-heading text-[10px] uppercase tracking-[0.25em] text-gold/70">
          Totals
        </h2>

        <div className="grid gap-6 sm:grid-cols-2">
          <AdminInput
            id="shipEgp"
            label="Delivery (EGP)"
            type="number"
            min={0}
            step="0.01"
            value={shipEgp}
            error={fieldErrors.shipInCents}
            onChange={setShipEgp}
            hint="Zero for a collection at the boutique."
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

        <dl className="border border-border p-6 text-[12px] tracking-wide">
          <div className="flex justify-between py-1">
            <dt className="text-ivory/35">Subtotal</dt>
            <dd className="text-ivory/70">{egp(subtotalInCents)}</dd>
          </div>
          <div className="flex justify-between py-1">
            <dt className="text-ivory/35">Delivery</dt>
            <dd className="text-ivory/70">{egp(shipInCents)}</dd>
          </div>
          <div className="mt-3 flex justify-between border-t border-border pt-3">
            <dt className="font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/35">
              Total
            </dt>
            <dd className="font-heading text-[13px] tracking-[0.1em] text-gold">
              {egp(subtotalInCents + shipInCents)}
            </dd>
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-ivory/25">
            A preview. The order is priced from the catalog when it is saved, so
            a price edited in another tab wins over this figure.
          </p>
        </dl>
      </section>

      <div className="flex items-center gap-4 border-t border-border pt-8">
        <AdminButton type="submit" disabled={isPending || products.length === 0}>
          {isPending ? "Recording…" : "Record order"}
        </AdminButton>
      </div>
    </form>
  );
}
