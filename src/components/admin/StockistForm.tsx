"use client";

/**
 * Create or edit a stockist.
 *
 * One component for both, as `CollectionForm` is: the fields are identical and
 * the only difference is whether the id is editable.
 *
 * ## Both languages, side by side
 *
 * Six fields have an Arabic twin, and they are laid out in pairs rather than in
 * two separate tabs. The Arabic column is usually the empty one — it is the
 * thing an editor opened this screen to fill in — and putting it beside the
 * English makes the gap visible instead of one click away.
 *
 * The five fields with no twin are deliberate, not oversights: `phone`,
 * `phoneHref` and `mapsUrl` are link targets and Latin data, and `region`,
 * `type` and `status` are enum members whose labels are translated in
 * `dict.stockists.*` rather than stored per row.
 *
 * ## The status rule is enforced in the UI too
 *
 * An announced location publishes no details. Rather than let somebody fill in
 * six fields and then be told to clear them, the detail block is disabled while
 * the status is `comingSoon`, and switching to it clears what was typed. The
 * database CHECK and `schemas/stockists.ts` are still the boundary — this is
 * only what stops the boundary being reached by accident.
 */

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  createStockist,
  deleteStockist,
  updateStockist,
} from "@/src/actions/admin/directory";
import {
  AdminButton,
  AdminInput,
  AdminNotice,
  AdminSelect,
  AdminToggle,
} from "@/src/components/admin/fields";
import { localizePath, type Locale } from "@/src/lib/i18n/config";
import type { AdminActionResult } from "@/src/schemas/admin";
import type { AdminStockist } from "@/src/types/stockist";

const REGION_OPTIONS = [
  { value: "middleEast", label: "Middle East" },
  { value: "europe", label: "Europe" },
  { value: "americas", label: "Americas" },
  { value: "asiaPacific", label: "Asia Pacific" },
] as const;

const TYPE_OPTIONS = [
  { value: "flagship", label: "Flagship — the house's own boutique" },
  { value: "boutique", label: "Boutique" },
  { value: "retailPartner", label: "Retail partner" },
  { value: "departmentStore", label: "Department store" },
] as const;

const STATUS_OPTIONS = [
  { value: "open", label: "Open — trading today" },
  { value: "comingSoon", label: "Announced — no details published" },
] as const;

/** Id suggestion, applied only while creating and only if untouched. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export default function StockistForm({
  stockist,
  locale,
}: {
  /** `null` when creating. */
  stockist: AdminStockist | null;
  locale: Locale;
}) {
  const router = useRouter();
  const isEdit = stockist !== null;

  const [id, setId] = useState(stockist?.id ?? "");
  const [idTouched, setIdTouched] = useState(isEdit);

  const [name, setName] = useState(stockist?.name ?? "");
  const [nameAr, setNameAr] = useState(stockist?.name_ar ?? "");
  const [city, setCity] = useState(stockist?.city ?? "");
  const [cityAr, setCityAr] = useState(stockist?.city_ar ?? "");
  const [country, setCountry] = useState(stockist?.country ?? "");
  const [countryAr, setCountryAr] = useState(stockist?.country_ar ?? "");

  const [region, setRegion] = useState<string>(stockist?.region ?? "middleEast");
  const [type, setType] = useState<string>(stockist?.type ?? "boutique");
  const [status, setStatus] = useState<string>(stockist?.status ?? "open");

  const [address, setAddress] = useState(stockist?.address ?? "");
  const [addressAr, setAddressAr] = useState(stockist?.address_ar ?? "");
  const [phone, setPhone] = useState(stockist?.phone ?? "");
  const [phoneHref, setPhoneHref] = useState(stockist?.phoneHref ?? "");
  const [hours, setHours] = useState(stockist?.hours ?? "");
  const [hoursAr, setHoursAr] = useState(stockist?.hours_ar ?? "");
  const [mapsUrl, setMapsUrl] = useState(stockist?.mapsUrl ?? "");

  const [imageUrl, setImageUrl] = useState(stockist?.imageUrl ?? "");
  const [imageAlt, setImageAlt] = useState(stockist?.imageAlt ?? "");
  const [imageAltAr, setImageAltAr] = useState(stockist?.imageAlt_ar ?? "");

  const [isPublished, setIsPublished] = useState(stockist?.isPublished ?? true);
  const [sortOrder, setSortOrder] = useState(String(stockist?.sortOrder ?? 0));

  const [result, setResult] = useState<AdminActionResult | null>(null);
  const [armed, setArmed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const fieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {};
  const announced = status === "comingSoon";

  /**
   * Switching to "announced" empties the detail block.
   *
   * The alternative — leaving the values in disabled inputs — would send them
   * anyway on submit and be refused by the database, which is the confusing
   * version of the same rule.
   */
  function changeStatus(next: string) {
    setStatus(next);

    if (next === "comingSoon") {
      setAddress("");
      setAddressAr("");
      setPhone("");
      setPhoneHref("");
      setHours("");
      setHoursAr("");
      setMapsUrl("");
    }
  }

  function submit() {
    setResult(null);

    startTransition(async () => {
      const payload = {
        id,
        name,
        name_ar: nameAr,
        city,
        city_ar: cityAr,
        country,
        country_ar: countryAr,
        region,
        type,
        status,
        address,
        address_ar: addressAr,
        phone,
        phoneHref,
        hours,
        hours_ar: hoursAr,
        mapsUrl,
        imageUrl,
        imageAlt,
        imageAlt_ar: imageAltAr,
        isPublished,
        sortOrder,
      };

      const outcome = isEdit
        ? await updateStockist(payload)
        : await createStockist(payload);

      setResult(outcome);

      if (outcome.ok && !isEdit) {
        router.push(localizePath(locale, `/admin/stockists/${outcome.slug}`));
        router.refresh();
      } else if (outcome.ok) {
        router.refresh();
      }
    });
  }

  function remove() {
    if (!isEdit) return;

    startTransition(async () => {
      const outcome = await deleteStockist({ id });

      if (outcome.ok) {
        router.push(localizePath(locale, "/admin/stockists"));
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

      {/* ── Identity ─────────────────────────────────────── */}
      <section className="space-y-4 md:space-y-6">
        <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/35">
          The location
        </h2>

        <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
          <AdminInput
            id="name"
            label="Name"
            value={name}
            onChange={(value) => {
              setName(value);
              if (!idTouched) setId(slugify(value));
            }}
            error={fieldErrors.name}
            hint="As it appears on the directory."
          />
          <AdminInput
            id="name_ar"
            label="Name — Arabic"
            value={nameAr}
            onChange={setNameAr}
            error={fieldErrors.name_ar}
            hint="Leave empty to use the Latin name on the Arabic site."
          />

          <AdminInput
            id="id"
            label="Id"
            value={id}
            onChange={(value) => {
              setIdTouched(true);
              setId(value);
            }}
            error={fieldErrors.id}
            hint={
              isEdit
                ? "Permanent — this is how the row is addressed."
                : "Lowercase, hyphenated. Cannot be changed later."
            }
          />
          <AdminInput
            id="sortOrder"
            label="Sort order"
            value={sortOrder}
            onChange={setSortOrder}
            error={fieldErrors.sortOrder}
            hint="Lower numbers come first within a region."
          />

          <AdminInput
            id="city"
            label="City"
            value={city}
            onChange={setCity}
            error={fieldErrors.city}
          />
          <AdminInput
            id="city_ar"
            label="City — Arabic"
            value={cityAr}
            onChange={setCityAr}
            error={fieldErrors.city_ar}
          />

          <AdminInput
            id="country"
            label="Country"
            value={country}
            onChange={setCountry}
            error={fieldErrors.country}
          />
          <AdminInput
            id="country_ar"
            label="Country — Arabic"
            value={countryAr}
            onChange={setCountryAr}
            error={fieldErrors.country_ar}
          />

          <AdminSelect
            id="region"
            label="Region"
            value={region}
            onChange={setRegion}
            options={[...REGION_OPTIONS]}
            error={fieldErrors.region}
          />
          <AdminSelect
            id="type"
            label="Type"
            value={type}
            onChange={setType}
            options={[...TYPE_OPTIONS]}
            error={fieldErrors.type}
          />
        </div>
      </section>

      {/* ── Status and details ───────────────────────────── */}
      <section className="space-y-4 md:space-y-6">
        <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/35">
          Visiting
        </h2>

        <AdminSelect
          id="status"
          label="Status"
          value={status}
          onChange={changeStatus}
          options={[...STATUS_OPTIONS]}
          error={fieldErrors.status}
        />

        {announced ? (
          <p className="border border-border bg-ivory/2 px-4 py-3 text-[12px] leading-relaxed tracking-wide text-ivory/45">
            An announced location is an announcement, not a destination. It
            publishes no address, phone, hours or map link — the database
            refuses a row that carries them.
          </p>
        ) : (
          <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
            <AdminInput
              id="address"
              label="Address"
              value={address}
              onChange={setAddress}
              error={fieldErrors.address}
              hint="Rendered in an LTR island on both sites."
            />
            <AdminInput
              id="address_ar"
              label="Address — Arabic"
              value={addressAr}
              onChange={setAddressAr}
              error={fieldErrors.address_ar}
            />

            <AdminInput
              id="phone"
              label="Phone — as displayed"
              value={phone}
              onChange={setPhone}
              error={fieldErrors.phone}
              hint="+20 11 234 5678"
            />
            <AdminInput
              id="phoneHref"
              label="Phone — link target"
              value={phoneHref}
              onChange={setPhoneHref}
              error={fieldErrors.phoneHref}
              hint="tel:+201123456789 — digits, no spaces."
            />

            <AdminInput
              id="hours"
              label="Opening hours"
              value={hours}
              onChange={setHours}
              error={fieldErrors.hours}
              hint="Mon–Sat 10:00–20:00"
            />
            <AdminInput
              id="hours_ar"
              label="Opening hours — Arabic"
              value={hoursAr}
              onChange={setHoursAr}
              error={fieldErrors.hours_ar}
            />

            <AdminInput
              id="mapsUrl"
              label="Map link"
              value={mapsUrl}
              onChange={setMapsUrl}
              error={fieldErrors.mapsUrl}
              hint="The full URL, so the target is reviewable beside the address."
            />
          </div>
        )}
      </section>

      {/* ── Photograph ───────────────────────────────────── */}
      <section className="space-y-4 md:space-y-6">
        <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/35">
          Photograph
        </h2>

        <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
          <AdminInput
            id="imageUrl"
            label="Image URL"
            value={imageUrl}
            onChange={setImageUrl}
            error={fieldErrors.imageUrl}
          />
          <AdminInput
            id="imageAlt"
            label="Alt text"
            value={imageAlt}
            onChange={setImageAlt}
            error={fieldErrors.imageAlt}
            hint="What someone who cannot see the photograph should be told."
          />
          <AdminInput
            id="imageAlt_ar"
            label="Alt text — Arabic"
            value={imageAltAr}
            onChange={setImageAltAr}
            error={fieldErrors.imageAlt_ar}
          />
        </div>
      </section>

      {/* ── Publication ──────────────────────────────────── */}
      <AdminToggle
        id="isPublished"
        label="On the public directory"
        description="Unpublished locations stay here in full and are invisible on /stockists."
        checked={isPublished}
        onChange={setIsPublished}
      />

      <div className="flex flex-wrap items-center gap-4">
        <AdminButton type="submit" disabled={isPending}>
          {isPending ? "Saving" : isEdit ? "Save location" : "Add location"}
        </AdminButton>

        {isEdit ? (
          <AdminButton
            variant={armed ? "danger" : "ghost"}
            disabled={isPending}
            onClick={() => (armed ? remove() : setArmed(true))}
          >
            {armed ? "Confirm — remove permanently" : "Remove"}
          </AdminButton>
        ) : null}
      </div>

      {armed ? (
        <p className="text-[11px] leading-relaxed text-ivory/35">
          Removing deletes the row and both languages of its copy. To take a
          location off the public site and keep it, switch off &ldquo;On the
          public directory&rdquo; instead.
        </p>
      ) : null}
    </form>
  );
}
