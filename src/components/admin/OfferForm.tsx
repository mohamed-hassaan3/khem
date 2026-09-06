"use client";

/**
 * An offer, in the sections a marketer thinks in.
 *
 * ## Not a Buy 2 Get 1 form
 *
 * The first campaign is Buy 2 Get 1; this form is not. A trigger is a quantity
 * and a set; a reward is a quantity, a kind and a set. Buy 3 Get 1, buy-two-for-
 * a-percentage, a gift with purchase, and "buy from Signature, receive from
 * Noir" are all configurations of the same six fields, which is what the
 * specification asks for and what stops the next campaign being a migration.
 *
 * ## The two sets are separate on purpose
 *
 * A campaign that points both at the same collection is the common case and is
 * two identical selections, which looks like duplication until the first
 * cross-collection offer — at which point collapsing them would have made it
 * unrepresentable. The live sentence at the top of the form is what stops the
 * duplication being confusing: it reads the campaign back as English.
 *
 * ## Lowest-priced is the default and the form says why
 *
 * Choosing highest-priced is a legitimate campaign and a very easy accident, so
 * the hint beside it states the consequence in money rather than in principle.
 */

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  createOffer,
  deleteOffer,
  updateOffer,
} from "@/src/actions/admin/offers";
import {
  AdminButton,
  AdminField,
  AdminInput,
  AdminNotice,
  AdminSelect,
  AdminTextarea,
  AdminToggle,
} from "@/src/components/admin/fields";
import type { PickerOption } from "@/src/components/admin/PromotionForm";
import { useUnsavedGuard } from "@/src/hooks/useUnsavedGuard";
import { localizePath, type Locale } from "@/src/lib/i18n/config";
import { useAdminToast } from "@/src/providers/admin-toast-provider";
import type { AdminActionResult } from "@/src/schemas/admin";
import type { OfferDetail } from "@/src/types/offer";

const SCOPE_OPTIONS = [
  { value: "COLLECTIONS", label: "Selected collections" },
  { value: "PRODUCTS", label: "Selected products" },
] as const;

const REWARD_KIND_OPTIONS = [
  { value: "FREE_ITEM", label: "Free — the reward items cost nothing" },
  { value: "PERCENTAGE", label: "Percentage off the reward items" },
] as const;

const SELECTION_OPTIONS = [
  { value: "LOWEST_PRICED", label: "The lowest-priced eligible item" },
  { value: "HIGHEST_PRICED", label: "The highest-priced eligible item" },
] as const;

const AUDIENCE_OPTIONS = [
  { value: "EVERYONE", label: "Everyone" },
  { value: "NEW_CUSTOMERS", label: "New customers — nobody with a paid order" },
  { value: "EXISTING_CUSTOMERS", label: "Existing customers" },
  { value: "SUBSCRIBERS", label: "Inner Circle subscribers" },
  { value: "INVITED", label: "Invitation only" },
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

export default function OfferForm({
  offer,
  products,
  collections,
  locale,
}: {
  /** `null` when creating. */
  offer: OfferDetail | null;
  products: readonly PickerOption[];
  collections: readonly PickerOption[];
  locale: Locale;
}) {
  const router = useRouter();
  const isEdit = offer !== null;

  const [name, setName] = useState(offer?.name ?? "");
  const [description, setDescription] = useState(offer?.description ?? "");
  const [label, setLabel] = useState(offer?.label ?? "");
  const [labelAr, setLabelAr] = useState(offer?.labelAr ?? "");
  const [isActive, setIsActive] = useState(offer?.isActive ?? true);
  const [startsAt, setStartsAt] = useState(toLocalInput(offer?.startsAt ?? null));
  const [endsAt, setEndsAt] = useState(toLocalInput(offer?.endsAt ?? null));

  const [triggerQuantity, setTriggerQuantity] = useState(
    String(offer?.triggerQuantity ?? 2),
  );
  const [triggerScope, setTriggerScope] = useState<string>(
    offer?.triggerScope ?? "COLLECTIONS",
  );
  const [triggerProductSlugs, setTriggerProductSlugs] = useState<string[]>([
    ...(offer?.targets.triggerProductSlugs ?? []),
  ]);
  const [triggerCollectionSlugs, setTriggerCollectionSlugs] = useState<string[]>([
    ...(offer?.targets.triggerCollectionSlugs ?? []),
  ]);

  const [rewardQuantity, setRewardQuantity] = useState(
    String(offer?.rewardQuantity ?? 1),
  );
  const [rewardKind, setRewardKind] = useState<string>(
    offer?.rewardKind ?? "FREE_ITEM",
  );
  const [rewardValue, setRewardValue] = useState(
    offer?.rewardValue === null || offer?.rewardValue === undefined
      ? ""
      : String(offer.rewardValue),
  );
  const [rewardScope, setRewardScope] = useState<string>(
    offer?.rewardScope ?? "COLLECTIONS",
  );
  const [rewardSelection, setRewardSelection] = useState<string>(
    offer?.rewardSelection ?? "LOWEST_PRICED",
  );
  const [rewardProductSlugs, setRewardProductSlugs] = useState<string[]>([
    ...(offer?.targets.rewardProductSlugs ?? []),
  ]);
  const [rewardCollectionSlugs, setRewardCollectionSlugs] = useState<string[]>([
    ...(offer?.targets.rewardCollectionSlugs ?? []),
  ]);

  const [audience, setAudience] = useState<string>(offer?.audience ?? "EVERYONE");
  const [requiresCode, setRequiresCode] = useState(offer?.requiresCode ?? "");
  const [totalUseLimit, setTotalUseLimit] = useState(
    offer?.totalUseLimit === null || offer?.totalUseLimit === undefined
      ? ""
      : String(offer.totalUseLimit),
  );
  const [perCustomerLimit, setPerCustomerLimit] = useState(
    offer?.perCustomerLimit === null || offer?.perCustomerLimit === undefined
      ? ""
      : String(offer.perCustomerLimit),
  );

  const [stacksWithCodes, setStacksWithCodes] = useState(
    offer?.stacksWithCodes ?? false,
  );
  const [stacksWithCredit, setStacksWithCredit] = useState(
    offer?.stacksWithCredit ?? false,
  );
  const [priority, setPriority] = useState(String(offer?.priority ?? 0));

  const [result, setResult] = useState<AdminActionResult | null>(null);
  const [armed, setArmed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const fieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {};

  function toggle(list: string[], set: (next: string[]) => void, slug: string) {
    set(list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug]);
  }

  const payload = {
    name,
    description,
    label,
    labelAr,
    isActive,
    startsAt: startsAt ? new Date(startsAt).toISOString() : "",
    endsAt: endsAt ? new Date(endsAt).toISOString() : "",
    triggerQuantity,
    triggerScope,
    triggerProductSlugs,
    triggerCollectionSlugs,
    rewardQuantity,
    rewardKind,
    rewardValue,
    rewardScope,
    rewardSelection,
    rewardProductSlugs,
    rewardCollectionSlugs,
    audience,
    requiresCode,
    totalUseLimit,
    perCustomerLimit,
    stacksWithCodes,
    stacksWithCredit,
    priority,
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
      ? await updateOffer(offer.id, payload)
      : await createOffer(payload);

    if (outcome.ok) toast(outcome.message);
    setResult(outcome.ok ? null : outcome);

    if (outcome.ok && !isEdit) {
      router.push(localizePath(locale, `/admin/offers/${outcome.slug}`));
      router.refresh();
    } else if (outcome.ok) {
      router.refresh();
    }

    if (outcome.ok) markSaved();
    return outcome.ok;
  }

  function remove() {
    if (!isEdit) return;

    startTransition(async () => {
      const outcome = await deleteOffer(offer.id);

      if (outcome.ok) {
        router.push(localizePath(locale, "/admin/offers"));
        router.refresh();
        return;
      }

      setArmed(false);
      setResult(outcome);
    });
  }

  /*
   * The campaign, read back as English.
   *
   * The single most useful thing on this screen: six fields spread over three
   * sections describe one sentence, and a marketer who has just set them has no
   * other way to check they said what they meant.
   */
  const sentence = `Buy ${triggerQuantity || "?"} → get ${rewardQuantity || "?"} ${
    rewardKind === "PERCENTAGE" ? `at ${rewardValue || "?"}% off` : "free"
  }${rewardSelection === "LOWEST_PRICED" ? ", cheapest first" : ", dearest first"}`;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          await persist();
        });
      }}
      className="max-w-3xl space-y-8"
    >
      {result ? (
        <AdminNotice tone={result.ok ? "success" : "error"}>
          {result.message}
        </AdminNotice>
      ) : null}

      <p className="border border-gold/30 bg-gold/6 px-5 py-4 font-heading text-[13px] tracking-[0.06em] text-ground-accent">
        {sentence}
      </p>

      <section className="space-y-4 md:space-y-6">
        <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
          The offer
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
            hint="Higher wins when two offers both apply. The larger reduction breaks a tie."
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
            label="Customer-facing line — English"
            value={label}
            onChange={setLabel}
            error={fieldErrors.label}
            placeholder="Choose 3, Pay for 2"
            hint="Printed on the bag and the order summary beside the reduction. Leave empty and the row simply reads “Offer”."
          />
          <AdminInput
            id="labelAr"
            label="Customer-facing line — Arabic"
            value={labelAr}
            onChange={setLabelAr}
            error={fieldErrors.labelAr}
          />
        </div>

        <AdminToggle
          id="isActive"
          label="Live"
          description="Off withdraws it immediately. Orders already placed keep the reduction they were written with."
          checked={isActive}
          onChange={setIsActive}
        />

        <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
          <AdminInput
            id="startsAt"
            type="datetime-local"
            label="Starts"
            value={startsAt}
            onChange={setStartsAt}
            error={fieldErrors.startsAt}
            hint="Leave empty to start now."
          />
          <AdminInput
            id="endsAt"
            type="datetime-local"
            label="Ends"
            value={endsAt}
            onChange={setEndsAt}
            error={fieldErrors.endsAt}
            hint="Leave empty to run until switched off."
          />
        </div>
      </section>

      <section className="space-y-4 md:space-y-6">
        <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
          What they have to buy
        </h2>

        <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
          <AdminInput
            id="triggerQuantity"
            type="number"
            label="Quantity"
            value={triggerQuantity}
            onChange={setTriggerQuantity}
            error={fieldErrors.triggerQuantity}
            required
          />
          <AdminSelect
            id="triggerScope"
            label="From"
            value={triggerScope}
            onChange={setTriggerScope}
            options={[...SCOPE_OPTIONS]}
          />
        </div>

        {triggerScope === "PRODUCTS" ? (
          <AdminField
            label="Products"
            error={fieldErrors.triggerProductSlugs}
            required
          >
            <Chips
              options={products}
              selected={triggerProductSlugs}
              onToggle={(slug) =>
                toggle(triggerProductSlugs, setTriggerProductSlugs, slug)
              }
            />
          </AdminField>
        ) : (
          <AdminField
            label="Collections"
            error={fieldErrors.triggerProductSlugs}
            required
          >
            <Chips
              options={collections}
              selected={triggerCollectionSlugs}
              onToggle={(slug) =>
                toggle(triggerCollectionSlugs, setTriggerCollectionSlugs, slug)
              }
            />
          </AdminField>
        )}
      </section>

      <section className="space-y-4 md:space-y-6">
        <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
          What they receive
        </h2>

        <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
          <AdminInput
            id="rewardQuantity"
            type="number"
            label="Quantity"
            value={rewardQuantity}
            onChange={setRewardQuantity}
            error={fieldErrors.rewardQuantity}
            required
          />
          <AdminSelect
            id="rewardKind"
            label="How"
            value={rewardKind}
            onChange={setRewardKind}
            options={[...REWARD_KIND_OPTIONS]}
          />
        </div>

        {rewardKind === "PERCENTAGE" ? (
          <AdminInput
            id="rewardValue"
            type="number"
            label="Percentage off"
            value={rewardValue}
            onChange={setRewardValue}
            error={fieldErrors.rewardValue}
            required
          />
        ) : null}

        <AdminSelect
          id="rewardSelection"
          label="Which item"
          value={rewardSelection}
          onChange={setRewardSelection}
          options={[...SELECTION_OPTIONS]}
          hint="Lowest-priced is the default and almost always what is meant. On a bag of 890, 1,470 and 2,200, lowest-priced gives away the 890 — highest-priced gives away the 2,200."
        />

        <AdminSelect
          id="rewardScope"
          label="From"
          value={rewardScope}
          onChange={setRewardScope}
          options={[...SCOPE_OPTIONS]}
          hint="Usually the same selection as the trigger. Point it somewhere else for “buy from one collection, receive from another”."
        />

        {rewardScope === "PRODUCTS" ? (
          <AdminField
            label="Products"
            error={fieldErrors.rewardProductSlugs}
            required
          >
            <Chips
              options={products}
              selected={rewardProductSlugs}
              onToggle={(slug) =>
                toggle(rewardProductSlugs, setRewardProductSlugs, slug)
              }
            />
          </AdminField>
        ) : (
          <AdminField
            label="Collections"
            error={fieldErrors.rewardProductSlugs}
            required
          >
            <Chips
              options={collections}
              selected={rewardCollectionSlugs}
              onToggle={(slug) =>
                toggle(rewardCollectionSlugs, setRewardCollectionSlugs, slug)
              }
            />
          </AdminField>
        )}
      </section>

      <section className="space-y-4 md:space-y-6">
        <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
          Who can use it
        </h2>

        <AdminSelect
          id="audience"
          label="Audience"
          value={audience}
          onChange={setAudience}
          options={[...AUDIENCE_OPTIONS]}
          hint="Judged from paid orders, the Inner Circle list, or an invitation issued by address."
        />

        <AdminInput
          id="requiresCode"
          label="Only with this code"
          value={requiresCode}
          onChange={setRequiresCode}
          error={fieldErrors.requiresCode}
          hint="Leave empty for an offer that applies on its own. A gated offer must also be allowed to run beside a code, below."
        />

        <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
          <AdminInput
            id="totalUseLimit"
            type="number"
            label="Total redemptions"
            value={totalUseLimit}
            onChange={setTotalUseLimit}
            error={fieldErrors.totalUseLimit}
            hint="Leave empty for unlimited. A refund returns its use."
          />
          <AdminInput
            id="perCustomerLimit"
            type="number"
            label="Per customer"
            value={perCustomerLimit}
            onChange={setPerCustomerLimit}
            error={fieldErrors.perCustomerLimit}
            hint="Leave empty for unlimited. 1 is “once per customer”."
          />
        </div>
      </section>

      <section className="space-y-4 md:space-y-6">
        <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
          Combining
        </h2>

        <p className="text-[12px] leading-relaxed text-ground-muted">
          KHEM runs one promotional mechanism per order by default. With these
          off, an offer simply does not apply to a basket already carrying the
          other benefit — quietly, because the customer never asked for it.
        </p>

        <AdminToggle
          id="stacksWithCodes"
          label="May apply beside a discount code"
          checked={stacksWithCodes}
          onChange={setStacksWithCodes}
        />
        <AdminToggle
          id="stacksWithCredit"
          label="May apply beside a Discovery Credit"
          checked={stacksWithCredit}
          onChange={setStacksWithCredit}
        />
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <AdminButton type="submit" disabled={isPending}>
          {isPending ? "Saving" : isEdit ? "Save offer" : "Create offer"}
        </AdminButton>

        {isEdit ? (
          armed ? (
            <>
              <AdminButton variant="danger" disabled={isPending} onClick={remove}>
                Delete for good
              </AdminButton>
              <AdminButton variant="ghost" onClick={() => setArmed(false)}>
                Keep it
              </AdminButton>
            </>
          ) : (
            <AdminButton variant="ghost" onClick={() => setArmed(true)}>
              Delete
            </AdminButton>
          )
        ) : null}
      </div>

      {isEdit && offer.redemptionCount > 0 ? (
        <p className="text-[12px] leading-relaxed text-warning">
          This offer has been used {offer.redemptionCount}{" "}
          {offer.redemptionCount === 1 ? "time" : "times"}. Deleting it removes
          those redemption records; switching it off instead keeps them. Orders
          keep the label they were written with either way.
        </p>
      ) : null}
    </form>
  );
}
