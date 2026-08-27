"use client";

/**
 * Create or edit a discount code.
 *
 * ## The code is permanent
 *
 * Editable while creating and fixed afterwards. Orders carry the code as a
 * snapshot (`"Order"."discountCode"`), and grants are keyed to the row — a
 * rename would leave old orders naming a code that no longer exists and would
 * silently invalidate every outstanding grant.
 *
 * ## Restrictions appear only when they mean something
 *
 * The product and collection pickers are shown for the scope that uses them. A
 * restricted code with nothing restricted to it can never apply, so the schema
 * refuses it rather than letting somebody publish a code that does nothing.
 *
 * ## Everything here describes a rule, not a price
 *
 * No amount is computed in this component or in the action behind it.
 * `resolve_discount()` prices a code against the order being written — see
 * `supabase/sql/0028_discounts.sql`.
 */

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  createDiscount,
  deleteDiscount,
  updateDiscount,
} from "@/src/actions/admin/discounts";
import {
  AdminButton,
  AdminField,
  AdminInput,
  AdminNotice,
  AdminSelect,
  AdminTextarea,
  AdminToggle,
} from "@/src/components/admin/fields";
import { localizePath, type Locale } from "@/src/lib/i18n/config";
import { useUnsavedGuard } from "@/src/hooks/useUnsavedGuard";
import { useAdminToast } from "@/src/providers/admin-toast-provider";
import type { AdminActionResult } from "@/src/schemas/admin";
import type { DiscountDetail } from "@/src/types/discount";

export interface PickerOption {
  slug: string;
  name: string;
}

const KIND_OPTIONS = [
  { value: "PERCENTAGE", label: "Percentage off" },
  { value: "FIXED", label: "Fixed amount off, in piastres" },
] as const;

const SCOPE_OPTIONS = [
  { value: "ALL", label: "Everything in the bag" },
  { value: "PRODUCTS", label: "Selected products only" },
  { value: "COLLECTIONS", label: "Selected collections only" },
] as const;

/** `datetime-local` wants `YYYY-MM-DDTHH:mm`; the column is a timestamptz. */
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
                ? "border-gold/50 bg-gold/10 text-gold"
                : "border-border text-ivory/35 hover:border-gold/30 hover:text-ivory"
            }`}
          >
            {option.name}
          </button>
        );
      })}
    </div>
  );
}

export default function DiscountForm({
  discount,
  products,
  collections,
  locale,
}: {
  /** `null` when creating. */
  discount: DiscountDetail | null;
  products: readonly PickerOption[];
  collections: readonly PickerOption[];
  locale: Locale;
}) {
  const router = useRouter();
  const isEdit = discount !== null;

  const [code, setCode] = useState(discount?.code ?? "");
  const [kind, setKind] = useState<string>(discount?.kind ?? "PERCENTAGE");
  const [value, setValue] = useState(String(discount?.value ?? 10));
  const [isActive, setIsActive] = useState(discount?.isActive ?? true);
  const [startsAt, setStartsAt] = useState(toLocalInput(discount?.startsAt ?? null));
  const [endsAt, setEndsAt] = useState(toLocalInput(discount?.endsAt ?? null));
  const [totalUseLimit, setTotalUseLimit] = useState(
    discount?.totalUseLimit === null || discount === null
      ? ""
      : String(discount.totalUseLimit),
  );
  const [perCustomerLimit, setPerCustomerLimit] = useState(
    discount?.perCustomerLimit === null || discount === null
      ? ""
      : String(discount.perCustomerLimit),
  );
  const [minimumOrderInCents, setMinimumOrderInCents] = useState(
    String(discount?.minimumOrderInCents ?? 0),
  );
  const [appliesTo, setAppliesTo] = useState<string>(discount?.appliesTo ?? "ALL");
  const [requiresGrant, setRequiresGrant] = useState(discount?.requiresGrant ?? false);
  const [isWelcome, setIsWelcome] = useState(discount?.isWelcome ?? false);
  const [description, setDescription] = useState(discount?.description ?? "");
  const [productSlugs, setProductSlugs] = useState<string[]>([
    ...(discount?.restrictions.productSlugs ?? []),
  ]);
  const [collectionSlugs, setCollectionSlugs] = useState<string[]>([
    ...(discount?.restrictions.collectionSlugs ?? []),
  ]);

  const [result, setResult] = useState<AdminActionResult | null>(null);
  const [armed, setArmed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const fieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {};

  function toggle(list: string[], set: (next: string[]) => void, slug: string) {
    set(list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug]);
  }

  /*
   * Hoisted out of `submit()` so it can be compared as well as posted: this
   * one object is both what the action receives and what `useUnsavedGuard`
   * watches, so a field that reaches the server necessarily reaches the
   * comparison too.
   */
  const payload = {
    id: discount?.id ?? "",
    code,
    kind,
    value,
    isActive,
    // A `datetime-local` value has no zone; the browser's offset is applied
    // by `new Date()` here so the stored instant is the one the editor meant.
    startsAt: startsAt ? new Date(startsAt).toISOString() : "",
    endsAt: endsAt ? new Date(endsAt).toISOString() : "",
    totalUseLimit,
    perCustomerLimit,
    minimumOrderInCents,
    appliesTo,
    requiresGrant,
    isWelcome,
    description,
    productSlugs,
    collectionSlugs,
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

    const outcome = isEdit
      ? await updateDiscount(payload)
      : await createDiscount(payload);

    /*
     * Successes leave, failures stay. A receipt has done its job the moment it
     * is read; a refusal names a field and has to be acted on, so it keeps its
     * place above the form. See `admin-toast-provider.tsx`.
     */
    if (outcome.ok) toast(outcome.message);
    setResult(outcome.ok ? null : outcome);

    if (outcome.ok && !isEdit) {
      router.push(localizePath(locale, `/admin/discounts/${outcome.slug}`));
      router.refresh();
    } else if (outcome.ok) {
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

  function remove() {
    if (!isEdit) return;

    startTransition(async () => {
      const outcome = await deleteDiscount({ id: discount.id });

      if (outcome.ok) {
        router.push(localizePath(locale, "/admin/discounts"));
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
        <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/35">
          The code
        </h2>

        <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
          <AdminInput
            id="code"
            label="Code"
            value={code}
            onChange={(next) => setCode(next.toUpperCase())}
            error={fieldErrors.code}
            readOnly={isEdit}
            hint={
              isEdit
                ? "Permanent — orders carry it and grants are keyed to it."
                : "Letters, numbers and hyphens. Stored uppercased."
            }
          />
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
            hint={kind === "PERCENTAGE" ? "1 to 100." : "5000 is 50.00 EGP."}
          />
          <AdminInput
            id="minimumOrderInCents"
            label="Minimum order, in piastres"
            value={minimumOrderInCents}
            onChange={setMinimumOrderInCents}
            error={fieldErrors.minimumOrderInCents}
            hint="Judged on the subtotal before any reduction. 0 for none."
          />
        </div>

        <AdminTextarea
          id="description"
          label="Description"
          value={description}
          onChange={setDescription}
          error={fieldErrors.description}
          hint="For the desk. Never shown to a customer."
        />
      </section>

      <section className="space-y-4 md:space-y-6">
        <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/35">
          When and how often
        </h2>

        <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
          <AdminInput
            id="startsAt"
            type="date"
            label="Starts"
            value={startsAt}
            onChange={setStartsAt}
            error={fieldErrors.startsAt}
            hint="Leave empty to start immediately."
          />
          <AdminInput
            id="endsAt"
            type="date"
            label="Ends"
            value={endsAt}
            onChange={setEndsAt}
            error={fieldErrors.endsAt}
            hint="Leave empty for no end."
          />
          <AdminInput
            id="totalUseLimit"
            label="Total uses"
            value={totalUseLimit}
            onChange={setTotalUseLimit}
            error={fieldErrors.totalUseLimit}
            hint="Empty for unlimited. Refunded orders return their use."
          />
          <AdminInput
            id="perCustomerLimit"
            label="Uses per customer"
            value={perCustomerLimit}
            onChange={setPerCustomerLimit}
            error={fieldErrors.perCustomerLimit}
            hint="Empty for unlimited."
          />
        </div>

        <AdminToggle
          id="isActive"
          label="Accepted at checkout"
          description="Switching this off stops the code without touching its history."
          checked={isActive}
          onChange={setIsActive}
        />

        <AdminToggle
          id="requiresGrant"
          label="By invitation only"
          description="Only customers issued a grant may redeem it — how the welcome offer shares one code string without it leaking."
          checked={requiresGrant}
          onChange={setRequiresGrant}
        />

        <AdminToggle
          id="isWelcome"
          label="Use as the welcome offer"
          description="Every new account is granted this code and told about it in their welcome letter. Only one campaign can hold this — ticking it here releases whichever held it before. Pair it with “By invitation only”."
          checked={isWelcome}
          onChange={setIsWelcome}
        />
      </section>

      <section className="space-y-4 md:space-y-6">
        <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/35">
          What it applies to
        </h2>

        <AdminSelect
          id="appliesTo"
          label="Scope"
          value={appliesTo}
          onChange={setAppliesTo}
          options={[...SCOPE_OPTIONS]}
          error={fieldErrors.appliesTo}
          hint="A restricted code comes off the eligible lines only, never the whole bag."
        />

        {appliesTo === "PRODUCTS" ? (
          <AdminField label="Products" error={fieldErrors.productSlugs} required>
            <Chips
              options={products}
              selected={productSlugs}
              onToggle={(slug) => toggle(productSlugs, setProductSlugs, slug)}
            />
          </AdminField>
        ) : null}

        {appliesTo === "COLLECTIONS" ? (
          <AdminField
            label="Collections"
            error={fieldErrors.collectionSlugs}
            required
          >
            <Chips
              options={collections}
              selected={collectionSlugs}
              onToggle={(slug) =>
                toggle(collectionSlugs, setCollectionSlugs, slug)
              }
            />
          </AdminField>
        ) : null}
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <AdminButton type="submit" disabled={isPending}>
          {isPending ? "Saving" : isEdit ? "Save code" : "Create code"}
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
        <p className="text-[11px] leading-relaxed text-ivory/35">
          Deleting removes the code, its restrictions, every outstanding grant
          and its whole redemption history — the usage figures go with it. To
          stop a code and keep the record, switch off &ldquo;Accepted at
          checkout&rdquo; instead.
        </p>
      ) : null}
    </form>
  );
}
