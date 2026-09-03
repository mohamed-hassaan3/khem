"use client";

/**
 * The New Arrival band, configured in one place.
 *
 * Everything the band shows is set here: which product it features, what supplies
 * its backdrop, and — optionally — its own title, paragraph and button. The
 * featured product used to be edited under System → Settings; it moved here so
 * the band has one screen rather than two. The *column* did not move, and there
 * is still exactly one of it (`"BoutiqueSetting"."featuredProductSlug"`).
 *
 * ## Empty means inherit
 *
 * Each override is a switch and a box. The switch decides whether the element
 * appears at all; an empty box means "use the featured product's own", which is
 * what this band did before any of it was configurable. So a band nobody has
 * touched renders exactly what it always rendered, and clearing a field is the
 * way back rather than a state you have to remember the old value to restore.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { updateNewArrival } from "@/src/actions/admin/landing";
import { AdminSelect, FIELD_CLASS } from "@/src/components/admin/fields";
import { useAdminToast } from "@/src/providers/admin-toast-provider";
import type {
  SectionMediaType,
  SectionSettings,
} from "@/src/lib/landing-sections";

export interface FeaturableProduct {
  slug: string;
  name: string;
}

const MEDIA_OPTIONS: ReadonlyArray<{
  value: SectionMediaType;
  label: string;
  hint: string;
}> = [
  {
    value: "FEATURED",
    label: "Featured",
    hint: "The featured product’s own photograph — how this band has always looked.",
  },
  {
    value: "IMAGE",
    label: "Image",
    hint: "A banner belonging to this band alone.",
  },
  { value: "FILM", label: "Film", hint: "A muted, looping film behind the copy." },
];

export default function NewArrivalForm({
  settings,
  featuredProductSlug,
  products,
}: {
  settings: SectionSettings;
  featuredProductSlug: string | null;
  products: readonly FeaturableProduct[];
}) {
  const router = useRouter();
  const { toast } = useAdminToast();
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  const [product, setProduct] = useState(featuredProductSlug ?? "");
  const [mediaType, setMediaType] = useState<SectionMediaType>(
    settings.mediaType ?? "FEATURED",
  );
  const [videoUrl, setVideoUrl] = useState(settings.videoUrl ?? "");
  const [imageUrl, setImageUrl] = useState(settings.imageUrl ?? "");
  const [imageAlt, setImageAlt] = useState(settings.imageAlt ?? "");

  const [showTitle, setShowTitle] = useState(settings.showTitle ?? true);
  const [title, setTitle] = useState(settings.title ?? "");
  const [showDescription, setShowDescription] = useState(
    settings.showDescription ?? true,
  );
  const [description, setDescription] = useState(settings.description ?? "");
  const [showCta, setShowCta] = useState(settings.showCta ?? true);
  const [ctaLabel, setCtaLabel] = useState(settings.ctaLabel ?? "");
  const [ctaHref, setCtaHref] = useState(settings.ctaHref ?? "");

  function save() {
    setErrors({});
    setMessage(null);

    startTransition(async () => {
      const outcome = await updateNewArrival({
        featuredProductSlug: product,
        mediaType,
        videoUrl,
        imageUrl,
        imageAlt,
        showTitle,
        title,
        showDescription,
        description,
        showCta,
        ctaLabel,
        ctaHref,
      });

      if (!outcome.ok) {
        setErrors(outcome.fieldErrors ?? {});
        setMessage(outcome.message);
        return;
      }

      toast(outcome.message);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-7 border border-ground-border p-6">
      <AdminSelect
        id="featuredProductSlug"
        label="Featured product"
        value={product}
        onChange={setProduct}
        options={[
          /*
           * An empty choice, and not a way to hide the band.
           *
           * It used to read "None — hide this band", which made this select a
           * second visibility control beside the band's own Show/Hide row in
           * Landing Sections — and the storefront then refused to draw the band
           * without a product no matter what media was configured. Visibility
           * is that row's job alone now. What is left here is the legitimate
           * case: a campaign band carrying its own banner and its own copy,
           * which features no single bottle. Choosing it while Media is set to
           * Featured is refused on save, because that combination has no
           * photograph to show.
           */
          { value: "", label: "None — a band with its own banner and copy" },
          ...products.map((p) => ({ value: p.slug, label: p.name })),
        ]}
        error={errors.featuredProductSlug}
        hint="Supplies the title, paragraph and button unless you override them below. Hiding the band is the Show/Hide switch in Landing Sections."
      />

      <fieldset className="flex flex-col gap-3">
        <legend className="font-heading text-[9px] uppercase tracking-[0.2em] text-ground-subtle">
          Media
        </legend>
        {MEDIA_OPTIONS.map((option) => (
          <label key={option.value} className="flex items-start gap-3">
            <input
              type="radio"
              name="mediaType"
              value={option.value}
              checked={mediaType === option.value}
              onChange={() => setMediaType(option.value)}
              className="mt-1 accent-gold"
            />
            <span>
              <span className="block text-[12px] text-ground">{option.label}</span>
              <span className="block text-[10px] leading-relaxed text-ground-muted">
                {option.hint}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      {mediaType === "FILM" ? (
        <Field
          label="Film address"
          hint="Must be https — a film served over http is blocked on a secure page."
          error={errors.videoUrl}
        >
          <input
            type="url"
            inputMode="url"
            placeholder="https://…"
            value={videoUrl}
            onChange={(event) => setVideoUrl(event.target.value)}
            className={`${FIELD_CLASS} px-3 py-2 text-[12px]`}
          />
        </Field>
      ) : null}

      {mediaType === "IMAGE" ? (
        <>
          <Field label="Banner address" hint="Must be https." error={errors.imageUrl}>
            <input
              type="url"
              inputMode="url"
              placeholder="https://…"
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              className={`${FIELD_CLASS} px-3 py-2 text-[12px]`}
            />
          </Field>
          <Field
            label="Banner description"
            hint="Read aloud by screen readers. Describe the picture, not the product."
            error={errors.imageAlt}
          >
            <input
              type="text"
              value={imageAlt}
              onChange={(event) => setImageAlt(event.target.value)}
              className={`${FIELD_CLASS} px-3 py-2 text-[12px]`}
            />
          </Field>
        </>
      ) : null}

      <Override
        label="Title"
        shown={showTitle}
        onToggle={setShowTitle}
        error={errors.title}
        placeholder="The product’s name"
      >
        <input
          type="text"
          value={title}
          placeholder="The product’s name"
          onChange={(event) => setTitle(event.target.value)}
          className={`${FIELD_CLASS} px-3 py-2 text-[12px]`}
        />
      </Override>

      <Override
        label="Description"
        shown={showDescription}
        onToggle={setShowDescription}
        error={errors.description}
      >
        <textarea
          rows={3}
          value={description}
          placeholder="The product’s story"
          onChange={(event) => setDescription(event.target.value)}
          className={`${FIELD_CLASS} px-3 py-2 text-[12px]`}
        />
      </Override>

      <Override
        label="Button"
        shown={showCta}
        onToggle={setShowCta}
        error={errors.ctaLabel ?? errors.ctaHref}
      >
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={ctaLabel}
            placeholder="Discover {name}"
            onChange={(event) => setCtaLabel(event.target.value)}
            className={`${FIELD_CLASS} px-3 py-2 text-[12px]`}
          />
          <input
            type="text"
            value={ctaHref}
            placeholder="/perfume/… — the product’s own page"
            onChange={(event) => setCtaHref(event.target.value)}
            className={`${FIELD_CLASS} px-3 py-2 text-[12px]`}
          />
        </div>
      </Override>

      {message ? (
        <p role="alert" className="text-[11px] text-danger">
          {message}
        </p>
      ) : null}

      <div>
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="rounded-none border border-ground-border px-5 py-2.5 font-heading text-[9px] uppercase tracking-[0.2em] text-ground-muted transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-gold/40 hover:text-ground-accent disabled:pointer-events-none disabled:opacity-30"
        >
          {isPending ? "Saving…" : "Save New Arrival"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="font-heading text-[9px] uppercase tracking-[0.2em] text-ground-subtle">
        {label}
      </span>
      {children}
      {hint ? <span className="text-[10px] text-ground-subtle">{hint}</span> : null}
      {error ? <span className="text-[10px] text-danger">{error}</span> : null}
    </label>
  );
}

/** A show/hide switch and the optional value it governs. */
function Override({
  label,
  shown,
  onToggle,
  error,
  children,
}: {
  label: string;
  shown: boolean;
  onToggle: (next: boolean) => void;
  error?: string;
  placeholder?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-ground-border pt-5">
      <div className="flex items-center justify-between gap-4">
        <span className="font-heading text-[9px] uppercase tracking-[0.2em] text-ground-subtle">
          {label}
        </span>
        <label className="flex items-center gap-2 text-[11px] text-ground-muted">
          <input
            type="checkbox"
            checked={shown}
            onChange={(event) => onToggle(event.target.checked)}
            className="accent-gold"
          />
          Show
        </label>
      </div>

      {shown ? (
        <>
          {children}
          <span className="text-[10px] text-ground-subtle">
            Leave empty to use the featured product’s own.
          </span>
        </>
      ) : null}

      {error ? <span className="text-[10px] text-danger">{error}</span> : null}
    </div>
  );
}
