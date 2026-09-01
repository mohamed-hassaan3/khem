"use client";

/**
 * The landing-page hero.
 *
 * One screen for one decision — what somebody sees in the first viewport of `/`
 * — and one write, for the reason `saveHero()` gives: a save that stored the
 * media type but not the images could leave a video hero with no film.
 *
 * ## The two branches are never both shown
 *
 * Choosing `Images` hides the video fields and choosing `Video` hides the slide
 * list. Their values are kept and re-submitted either way, so a desk that runs a
 * film for a fortnight comes back to the campaign images it had lined up — but
 * nobody is ever editing a slideshow that is not being shown.
 *
 * ## Add and remove, with no ceiling
 *
 * A hero is one image or twenty. One is static — the storefront arms no timer
 * and draws no progress bar, because there is nowhere to rotate to — and two or
 * more cross-fade. The hint under the list says exactly that, because it is the
 * one rule an editor cannot see by looking at the form.
 *
 * A thumbnail is a plain `<img>`, deliberately: `next/image` throws on a host
 * that is not in `next.config.ts`, and this is the screen whose job includes
 * showing an editor that the address they pasted does not work. The schema still
 * refuses to save an unusable one.
 */

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { useState, useTransition } from "react";

import { saveHero } from "@/src/actions/admin/content";
import {
  AdminButton,
  AdminInput,
  AdminNotice,
  AdminSelect,
  AdminTextarea,
  AdminToggle,
  ERROR_CLASS,
  FIELD_CLASS,
  LABEL_CLASS,
} from "@/src/components/admin/fields";
import { useUnsavedGuard } from "@/src/hooks/useUnsavedGuard";
import { useAdminToast } from "@/src/providers/admin-toast-provider";
import type { AdminActionResult } from "@/src/schemas/admin";
import type { AdminHero, AdminHeroSlide } from "@/src/types/content";

/**
 * Where the words sit in the frame.
 *
 * Named for the Latin-script reading because that is what the editor is
 * choosing; the storefront places it logically, so in Arabic the corner
 * composition lands bottom-right. The hint says so, because an editor looking
 * at the Arabic site would otherwise read it as a bug.
 */
const POSITION_OPTIONS = [
  { value: "CENTER", label: "Centre — over the middle of the image" },
  { value: "BOTTOM_LEFT", label: "Bottom left — gathered into the lower corner" },
] as const;

const MEDIA_OPTIONS = [
  { value: "IMAGES", label: "Images — one, or several that fade" },
  { value: "VIDEO", label: "Video — a single film, no rotation" },
] as const;

/** How long one image holds. Bounded by the column; these are the useful steps. */
const DURATION_OPTIONS = [
  { value: "4000", label: "4 seconds" },
  { value: "5000", label: "5 seconds" },
  { value: "6000", label: "6 seconds" },
  { value: "8000", label: "8 seconds" },
  { value: "10000", label: "10 seconds" },
  { value: "12000", label: "12 seconds" },
] as const;

interface Row {
  /** `null` for a row added in this session; the server mints an id. */
  id: string | null;
  imageUrl: string;
  alt: string;
  altAr: string;
}

function toRows(slides: readonly AdminHeroSlide[]): Row[] {
  return slides.map((slide) => ({
    id: slide.id,
    imageUrl: slide.imageUrl,
    alt: slide.alt,
    altAr: slide.altAr ?? "",
  }));
}

/**
 * A row the editor added and left empty.
 *
 * Dropped before submitting rather than sent and refused — and dropped here as
 * well as in the schema, so the indices the server reports errors against are
 * the indices this list renders. Without that agreement a complaint about the
 * second image could be printed under the third.
 */
function isBlank(row: Row): boolean {
  return (
    row.imageUrl.trim().length === 0 &&
    row.alt.trim().length === 0 &&
    row.altAr.trim().length === 0
  );
}

export default function HeroForm({ hero }: { hero: AdminHero }) {
  const [mediaType, setMediaType] = useState<string>(hero.mediaType);
  const [contentPosition, setContentPosition] = useState<string>(
    hero.contentPosition,
  );
  const [slideDurationMs, setSlideDurationMs] = useState(
    String(hero.slideDurationMs),
  );
  const [rows, setRows] = useState<Row[]>(toRows(hero.slides));

  const [videoUrl, setVideoUrl] = useState(hero.videoUrl ?? "");
  const [videoPosterUrl, setVideoPosterUrl] = useState(hero.videoPosterUrl ?? "");
  const [videoAlt, setVideoAlt] = useState(hero.videoAlt ?? "");
  const [videoAltAr, setVideoAltAr] = useState(hero.videoAltAr ?? "");

  const [showHeadline, setShowHeadline] = useState(hero.showHeadline);
  const [showDescription, setShowDescription] = useState(hero.showDescription);
  const [showButton, setShowButton] = useState(hero.showButton);

  const [headline, setHeadline] = useState(hero.headline ?? "");
  const [headlineAr, setHeadlineAr] = useState(hero.headlineAr ?? "");
  const [description, setDescription] = useState(hero.description ?? "");
  const [descriptionAr, setDescriptionAr] = useState(hero.descriptionAr ?? "");
  const [buttonLabel, setButtonLabel] = useState(hero.buttonLabel ?? "");
  const [buttonLabelAr, setButtonLabelAr] = useState(hero.buttonLabelAr ?? "");
  const [buttonHref, setButtonHref] = useState(hero.buttonHref ?? "");

  const [result, setResult] = useState<AdminActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const fieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {};

  const payload = {
    mediaType,
    contentPosition,
    slideDurationMs,
    slides: rows.filter((row) => !isBlank(row)),
    videoUrl,
    videoPosterUrl,
    videoAlt,
    videoAltAr,
    showHeadline,
    showDescription,
    showButton,
    headline,
    headlineAr,
    description,
    descriptionAr,
    buttonLabel,
    buttonLabelAr,
    buttonHref,
  };

  const { toast } = useAdminToast();

  const { markSaved } = useUnsavedGuard({
    payload,
    save: () => persist(),
    pending: isPending,
  });

  async function persist(): Promise<boolean> {
    setResult(null);

    const outcome = await saveHero(payload);

    if (outcome.ok) toast(outcome.message);
    setResult(outcome.ok ? null : outcome);
    if (outcome.ok) markSaved();

    return outcome.ok;
  }

  function update(index: number, patch: Partial<Row>) {
    setRows((current) =>
      current.map((row, at) => (at === index ? { ...row, ...patch } : row)),
    );
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;

    setRows((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  const liveRows = rows.filter((row) => !isBlank(row));

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

      <section className="space-y-4 md:space-y-6">
        <h3 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
          Hero media
        </h3>

        <p className="max-w-2xl text-[11px] leading-relaxed text-ground-muted">
          With no images and no video, the home page opens on the typographic
          composition — the wordmark, the rule and the tagline — exactly as it
          does today. Adding media here replaces that first screen.
        </p>

        <AdminSelect
          id="mediaType"
          label="Media type"
          value={mediaType}
          onChange={setMediaType}
          options={[...MEDIA_OPTIONS]}
          error={fieldErrors.mediaType}
          hint="Images and video are alternatives, never both. Switching keeps whatever the other holds."
        />
      </section>

      {mediaType === "IMAGES" ? (
        <>
          <section className="space-y-4">
            <div>
              <h3 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
                Images
              </h3>
              <p className="mt-2 max-w-2xl text-[11px] leading-relaxed text-ground-muted">
                One image is a still hero — nothing rotates. Two or more fade
                from one to the next, in this order. Add as many as the campaign
                needs; only the first is loaded before the page paints.
              </p>
            </div>

            {fieldErrors.slides ? (
              <p className={ERROR_CLASS} role="alert">
                {fieldErrors.slides}
              </p>
            ) : null}

            <div className="space-y-4">
              {rows.map((row, index) => (
                <div
                  key={row.id ?? `new-${index}`}
                  className="border border-ground-border p-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-subtle">
                      Image {index + 1}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label={`Move image ${index + 1} earlier`}
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                        className="border border-ground-border p-2 text-ground-muted transition-colors duration-300 hover:border-gold/40 hover:text-ground-accent disabled:opacity-30 focus:outline-none"
                      >
                        <ArrowUp size={13} strokeWidth={1.25} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Move image ${index + 1} later`}
                        disabled={index === rows.length - 1}
                        onClick={() => move(index, 1)}
                        className="border border-ground-border p-2 text-ground-muted transition-colors duration-300 hover:border-gold/40 hover:text-ground-accent disabled:opacity-30 focus:outline-none"
                      >
                        <ArrowDown size={13} strokeWidth={1.25} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove image ${index + 1}`}
                        onClick={() =>
                          setRows((current) =>
                            current.filter((_, at) => at !== index),
                          )
                        }
                        className="border border-ground-border p-2 text-ground-muted transition-colors duration-300 hover:border-danger/50 hover:text-danger focus:outline-none"
                      >
                        <X size={13} strokeWidth={1.25} />
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={row.imageUrl || undefined}
                      alt=""
                      className="h-20 w-28 shrink-0 border border-ground-border object-cover"
                    />

                    <div className="min-w-0 flex-1 space-y-3">
                      <div>
                        <label
                          className={LABEL_CLASS}
                          htmlFor={`hero-image-${index}`}
                        >
                          Image address
                        </label>
                        <input
                          id={`hero-image-${index}`}
                          type="url"
                          value={row.imageUrl}
                          placeholder="https://res.cloudinary.com/…"
                          onChange={(event) =>
                            update(index, { imageUrl: event.target.value })
                          }
                          className={FIELD_CLASS}
                        />
                        {fieldErrors[`slides.${index}.imageUrl`] ? (
                          <p className={ERROR_CLASS} role="alert">
                            {fieldErrors[`slides.${index}.imageUrl`]}
                          </p>
                        ) : null}
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <AdminInput
                          id={`hero-alt-${index}`}
                          label="Description — English"
                          value={row.alt}
                          onChange={(value) => update(index, { alt: value })}
                          error={fieldErrors[`slides.${index}.alt`]}
                          required
                          hint="For somebody who cannot see it."
                        />
                        <AdminInput
                          id={`hero-alt-ar-${index}`}
                          label="Description — Arabic"
                          value={row.altAr}
                          onChange={(value) => update(index, { altAr: value })}
                          error={fieldErrors[`slides.${index}.altAr`]}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                setRows((current) => [
                  ...current,
                  { id: null, imageUrl: "", alt: "", altAr: "" },
                ])
              }
              className="inline-flex items-center gap-2 border border-ground-border px-4 py-2 font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted transition-colors duration-300 hover:border-gold/40 hover:text-ground-accent focus:outline-none"
            >
              <Plus size={13} strokeWidth={1.25} />
              Add image
            </button>
          </section>

          <section className="space-y-4 md:space-y-6">
            <h3 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
              Timing
            </h3>

            <AdminSelect
              id="slideDurationMs"
              label="Each image holds for"
              value={slideDurationMs}
              onChange={setSlideDurationMs}
              options={[...DURATION_OPTIONS]}
              error={fieldErrors.slideDurationMs}
              hint={
                liveRows.length > 1
                  ? "The progress line under the hero fills over this time."
                  : "Ignored until there is a second image to fade to."
              }
            />
          </section>
        </>
      ) : (
        <section className="space-y-4 md:space-y-6">
          <div>
            <h3 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
              Video
            </h3>
            <p className="mt-2 max-w-2xl text-[11px] leading-relaxed text-ground-muted">
              One film, muted and looping. There is no video slideshow — a
              rotation of films would cost a phone several megabytes above the
              fold — so this is a single address, not a list.
            </p>
          </div>

          <AdminInput
            id="videoUrl"
            type="url"
            label="Video address"
            value={videoUrl}
            onChange={setVideoUrl}
            error={fieldErrors.videoUrl}
            required
            hint="An https:// address to an MP4 the browser can play inline."
          />

          <AdminInput
            id="videoPosterUrl"
            type="url"
            label="Poster image"
            value={videoPosterUrl}
            onChange={setVideoPosterUrl}
            error={fieldErrors.videoPosterUrl}
            hint="Shown before the first frame, and instead of the film wherever autoplay is refused. Strongly recommended."
          />

          <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
            <AdminInput
              id="videoAlt"
              label="Description — English"
              value={videoAlt}
              onChange={setVideoAlt}
              error={fieldErrors.videoAlt}
              hint="What the film shows, for somebody who cannot see it."
            />
            <AdminInput
              id="videoAltAr"
              label="Description — Arabic"
              value={videoAltAr}
              onChange={setVideoAltAr}
              error={fieldErrors.videoAltAr}
            />
          </div>
        </section>
      )}

      <section className="space-y-4 md:space-y-6">
        <div>
          <h3 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
            What the hero says
          </h3>
          <p className="mt-2 max-w-2xl text-[11px] leading-relaxed text-ground-muted">
            Each of the three is independent. Switch them all off for a hero that
            is the photograph alone — nothing empty is printed in their place.
          </p>
        </div>

        <AdminSelect
          id="contentPosition"
          label="Content position"
          value={contentPosition}
          onChange={setContentPosition}
          options={[...POSITION_OPTIONS]}
          error={fieldErrors.contentPosition}
          hint="Applies to the headline, description and button together. In Arabic the corner composition mirrors to the bottom right, which is the same corner of the reading order."
        />

        <AdminToggle
          id="showHeadline"
          label="Show the headline"
          description="Printed as the page's heading. With it off, the home page keeps an invisible one so search engines still see a title."
          checked={showHeadline}
          onChange={setShowHeadline}
        />

        {showHeadline ? (
          <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
            <AdminInput
              id="headline"
              label="Headline — English"
              value={headline}
              onChange={setHeadline}
              error={fieldErrors.headline}
              required
            />
            <AdminInput
              id="headlineAr"
              label="Headline — Arabic"
              value={headlineAr}
              onChange={setHeadlineAr}
              error={fieldErrors.headlineAr}
            />
          </div>
        ) : null}

        <AdminToggle
          id="showDescription"
          label="Show the description"
          checked={showDescription}
          onChange={setShowDescription}
        />

        {showDescription ? (
          <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
            <AdminTextarea
              id="description"
              label="Description — English"
              value={description}
              onChange={setDescription}
              error={fieldErrors.description}
              rows={3}
              required
            />
            <AdminTextarea
              id="descriptionAr"
              label="Description — Arabic"
              value={descriptionAr}
              onChange={setDescriptionAr}
              error={fieldErrors.descriptionAr}
              rows={3}
            />
          </div>
        ) : null}

        <AdminToggle
          id="showButton"
          label="Show the button"
          checked={showButton}
          onChange={setShowButton}
        />

        {showButton ? (
          <>
            <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
              <AdminInput
                id="buttonLabel"
                label="Button label — English"
                value={buttonLabel}
                onChange={setButtonLabel}
                error={fieldErrors.buttonLabel}
                required
              />
              <AdminInput
                id="buttonLabelAr"
                label="Button label — Arabic"
                value={buttonLabelAr}
                onChange={setButtonLabelAr}
                error={fieldErrors.buttonLabelAr}
              />
            </div>

            <AdminInput
              id="buttonHref"
              label="Button link"
              value={buttonHref}
              onChange={setButtonHref}
              error={fieldErrors.buttonHref}
              required
              placeholder="/collections"
              hint="A path on this site, starting with a slash. The Arabic tree is prefixed automatically."
            />
          </>
        ) : null}
      </section>

      <AdminButton type="submit" disabled={isPending}>
        {isPending ? "Saving" : "Save hero"}
      </AdminButton>
    </form>
  );
}
