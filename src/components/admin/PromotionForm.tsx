"use client";

/**
 * Create or edit a promotion.
 *
 * ## This screen sets a price, not a code
 *
 * A promotion here reprices products for everybody, with nothing to type at
 * checkout. Codes — the welcome offer, invitations, anything a customer enters —
 * live in the discount editor and have their own grants and redemption ledger.
 * The two systems meet at exactly one switch on this form, *Allow codes on top*,
 * and its default is off.
 *
 * ## Nothing is computed here
 *
 * No price is calculated in this component or in the action behind it. The
 * promotion describes a rule; `active_product_promotions` picks the winning one
 * per product and `place_order()` reads it under a row lock inside the
 * transaction that writes the order — see `supabase/sql/0035_marketing.sql`.
 *
 * ## Targets appear only when they mean something
 *
 * A promotion has no "everything" scope, so one picker or the other is always
 * shown and the schema refuses an empty selection: a promotion that prices
 * nothing is never what somebody meant.
 */

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  createPromotion,
  deletePromotion,
  updatePromotion,
} from "@/src/actions/admin/promotions";
import {
  AdminButton,
  AdminField,
  AdminInput,
  AdminNotice,
  AdminSelect,
  AdminTextarea,
  AdminToggle,
} from "@/src/components/admin/fields";
import { useUnsavedGuard } from "@/src/hooks/useUnsavedGuard";
import { localizePath, type Locale } from "@/src/lib/i18n/config";
import { useAdminToast } from "@/src/providers/admin-toast-provider";
import type { AdminActionResult } from "@/src/schemas/admin";
import type { PromotionDetail } from "@/src/types/marketing";

export interface PickerOption {
  slug: string;
  name: string;
}

const KIND_OPTIONS = [
  { value: "PERCENTAGE", label: "Percentage off the list price" },
  { value: "FIXED", label: "Fixed amount off, in piastres" },
] as const;

const SCOPE_OPTIONS = [
  { value: "PRODUCTS", label: "Selected products" },
  { value: "COLLECTIONS", label: "Selected collections" },
] as const;

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function Chips({
  options,
  selected,
  onToggle,
}: {
  options: readonly PickerOption[];
  selected: readonly string[];
  onToggle: (slug: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = selected.includes(option.slug);

        return (
          <button
            key={option.slug}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(option.slug)}
            className={`border px-4 py-2 text-[11px] tracking-wide transition-colors duration-300 ${
              active
                ? "border-gold/50 bg-gold/10 text-ground-accent"
                : "border-ground-border text-ground-muted hover:border-gold/30 hover:text-ground"
            }`}
          >
            {option.name}
          </button>
        );
      })}
    </div>
  );
}

export default function PromotionForm({
  promotion,
  products,
  collections,
  locale,
}: {
  /** `null` when creating. */
  promotion: PromotionDetail | null;
  products: readonly PickerOption[];
  collections: readonly PickerOption[];
  locale: Locale;
}) {
  const router = useRouter();
  const isEdit = promotion !== null;

  const [name, setName] = useState(promotion?.name ?? "");
  const [description, setDescription] = useState(promotion?.description ?? "");
  const [label, setLabel] = useState(promotion?.label ?? "");
  const [labelAr, setLabelAr] = useState(promotion?.labelAr ?? "");
  const [kind, setKind] = useState<string>(promotion?.kind ?? "PERCENTAGE");
  const [value, setValue] = useState(String(promotion?.value ?? 20));
  const [appliesTo, setAppliesTo] = useState<string>(
    promotion?.appliesTo ?? "PRODUCTS",
  );
  const [isActive, setIsActive] = useState(promotion?.isActive ?? true);
  const [startsAt, setStartsAt] = useState(toLocalInput(promotion?.startsAt ?? null));
  const [endsAt, setEndsAt] = useState(toLocalInput(promotion?.endsAt ?? null));
  const [stacksWithCodes, setStacksWithCodes] = useState(
    promotion?.stacksWithCodes ?? false,
  );
  const [priority, setPriority] = useState(String(promotion?.priority ?? 0));
  const [productSlugs, setProductSlugs] = useState<string[]>([
    ...(promotion?.targets.productSlugs ?? []),
  ]);
  const [collectionSlugs, setCollectionSlugs] = useState<string[]>([
    ...(promotion?.targets.collectionSlugs ?? []),
  ]);

  const [result, setResult] = useState<AdminActionResult | null>(null);
  const [armed, setArmed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const fieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {};

  function toggle(list: string[], set: (next: string[]) => void, slug: string) {
    set(list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug]);
  }

  const payload = {
    id: promotion?.id ?? "",
    name,
    description,
    label,
    labelAr,
    kind,
    value,
    appliesTo,
    isActive,
    startsAt: startsAt ? new Date(startsAt).toISOString() : "",
    endsAt: endsAt ? new Date(endsAt).toISOString() : "",
    stacksWithCodes,
    priority,
    productSlugs,
    collectionSlugs,
  };

  const { toast } = useAdminToast();

  const { markSaved } = useUnsavedGuard({
    payload,
    save: () => persist(),
    pending: isPending,
  });

  async function persist(): Promise<boolean> {
    setResult(null);

    const outcome = isEdit
      ? await updatePromotion(payload)
      : await createPromotion(payload);

    if (outcome.ok) toast(outcome.message);
    setResult(outcome.ok ? null : outcome);

    if (outcome.ok && !isEdit) {
      router.push(localizePath(locale, `/admin/promotions/${outcome.slug}`));
      router.refresh();
    } else if (outcome.ok) {
      router.refresh();
    }

    if (outcome.ok) markSaved();
    return outcome.ok;
  }

  function submit() {
    startTransition(async () => {
      await persist();
    });
  }

  function remove() {
    if (!isEdit) return;

    startTransition(async () => {
      const outcome = await deletePromotion({ id: promotion.id });

      if (outcome.ok) {
        router.push(localizePath(locale, "/admin/promotions"));
        router.refresh();
        return;
      }

      setArmed(false);
      setResult(outcome);
    });
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="max-w-3xl space-y-8"
    >
      {result ? (
        <AdminNotice tone={result.ok ? "success" : "error"}>
          {result.message}
        </AdminNotice>
      ) : null}

      <section className="space-y-4 md:space-y-6">
        <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
          The promotion
        </h2>

        <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
          <AdminInput
            id="name"
            label="Name"
            value={name}
            onChange={setName}
            error={fieldErrors.name}
            required
            hint="For the desk. Never shown to a customer."
          />
          <AdminInput
            id="priority"
            type="number"
            label="Priority"
            value={priority}
            onChange={setPriority}
            error={fieldErrors.priority}
            hint="Higher wins when two promotions name the same product. A product-level promotion already beats a collection-level one."
          />
        </div>

        <AdminTextarea
          id="description"
          label="Notes"
          value={description}
          onChange={setDescription}
          error={fieldErrors.description}
          hint="For the desk. Never shown to a customer."
        />

        <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
          <AdminInput
            id="label"
            label="Badge label — English"
            value={label}
            onChange={setLabel}
            error={fieldErrors.label}
            placeholder="BLACK FRIDAY"
            hint="Printed on the card corner and beside the price. Leave empty for a quiet reduction that carries no banner."
          />
          <AdminInput
            id="labelAr"
            label="Badge label — Arabic"
            value={labelAr}
            onChange={setLabelAr}
            error={fieldErrors.labelAr}
          />
        </div>
      </section>

      <section className="space-y-4 md:space-y-6">
        <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
          What it takes off
        </h2>

        <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
          <AdminSelect
            id="kind"
            label="Kind"
            value={kind}
            onChange={setKind}
            options={[...KIND_OPTIONS]}
            error={fieldErrors.kind}
          />
          <AdminInput
            id="value"
            label={kind === "PERCENTAGE" ? "Percentage" : "Amount, in piastres"}
            value={value}
            onChange={setValue}
            error={fieldErrors.value}
            hint={
              kind === "PERCENTAGE"
                ? "1 to 100. Rounded down to the piastre, so the house never gives away more than it meant to."
                : "50000 is 500.00 EGP. Never takes a price below zero."
            }
          />
        </div>

        <AdminToggle
          id="stacksWithCodes"
          label="Allow discount codes on top"
          description="Off — the safe default — means a discounted line is not part of any code's eligible total, so a customer cannot compound this promotion with a voucher. On, the two combine."
          checked={stacksWithCodes}
          onChange={setStacksWithCodes}
        />
      </section>

      <section className="space-y-4 md:space-y-6">
        <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
          What it applies to
        </h2>

        <AdminSelect
          id="appliesTo"
          label="Target"
          value={appliesTo}
          onChange={setAppliesTo}
          options={[...SCOPE_OPTIONS]}
          error={fieldErrors.appliesTo}
          hint="Only one promotion ever prices a product — the most specific, then the highest priority, then the deepest reduction."
        />

        {appliesTo === "PRODUCTS" ? (
          <AdminField label="Products" error={fieldErrors.productSlugs} required>
            <Chips
              options={products}
              selected={productSlugs}
              onToggle={(slug) => toggle(productSlugs, setProductSlugs, slug)}
            />
          </AdminField>
        ) : (
          <AdminField
            label="Collections"
            error={fieldErrors.collectionSlugs}
            required
          >
            <Chips
              options={collections}
              selected={collectionSlugs}
              onToggle={(slug) => toggle(collectionSlugs, setCollectionSlugs, slug)}
            />
          </AdminField>
        )}
      </section>

      <section className="space-y-4 md:space-y-6">
        <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
          When it runs
        </h2>

        <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
          <AdminInput
            id="startsAt"
            type="datetime-local"
            label="Starts"
            value={startsAt}
            onChange={setStartsAt}
            error={fieldErrors.startsAt}
            hint="Leave empty to start as soon as it is switched on."
          />
          <AdminInput
            id="endsAt"
            type="datetime-local"
            label="Ends"
            value={endsAt}
            onChange={setEndsAt}
            error={fieldErrors.endsAt}
            hint="Leave empty for no end. Outside its window a promotion stops pricing on its own."
          />
        </div>

        <AdminToggle
          id="isActive"
          label="Running"
          description="Switching this off restores the list prices immediately, without touching the promotion or its selection."
          checked={isActive}
          onChange={setIsActive}
        />
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <AdminButton type="submit" disabled={isPending}>
          {isPending ? "Saving" : isEdit ? "Save promotion" : "Create promotion"}
        </AdminButton>

        {isEdit ? (
          <AdminButton
            variant={armed ? "danger" : "ghost"}
            disabled={isPending}
            onClick={() => (armed ? remove() : setArmed(true))}
          >
            {armed ? "Confirm — delete permanently" : "Delete"}
          </AdminButton>
        ) : null}
      </div>

      {armed ? (
        <p className="text-[11px] leading-relaxed text-ground-muted">
          Deleting removes the promotion and its selection. Orders already placed
          keep the price they were charged and what it was reduced from — only the
          promotion&rsquo;s name is lost from them. To stop it and keep the record,
          switch off &ldquo;Running&rdquo; instead.
        </p>
      ) : null}
    </form>
  );
}
