"use client";

import { useUser } from "@clerk/nextjs";
import { useState, useTransition, type FormEvent } from "react";

import CommentImageUploader from "@/src/components/ecommerce/CommentImageUploader";
import CommentRow from "@/src/components/ecommerce/CommentRow";
import StarRatingInput from "@/src/components/ecommerce/StarRatingInput";
import { postProductComment } from "@/src/actions/comments";
import { formatRating } from "@/src/lib/format";
import type { Locale } from "@/src/lib/i18n/config";
import { interpolate } from "@/src/lib/i18n/interpolate";
import {
  COMMENT_MAX_LENGTH,
  COMMENT_MIN_LENGTH,
  type CommentImageUpload,
} from "@/src/schemas/comments";
import { useDictionary } from "@/src/providers/i18n-provider";
import type { ProductComment } from "@/src/types/comments";

/**
 * Leave a comment on a fragrance.
 *
 * There is no name field, by design. A signed-in visitor is attributed from
 * their Clerk session and a signed-out one as "Guest" — both decided inside
 * `actions/comments.ts`, which means the byline below is a *preview* of what
 * the server will write, never an input to it. `useUser()` here is cosmetic;
 * if it were wrong, the stored comment would still be right.
 *
 * ## Three ways to say something
 *
 * Stars alone, words alone, or both. The rating sits above the textarea because
 * it is the cheaper act: a visitor who only wants to say "five stars" should
 * meet that control first and never have to touch the one below it. What the
 * form refuses is an empty submission — the same rule the schema enforces and
 * the database carries as `product_comment_has_content`.
 *
 * The length and photograph checks are the same UX affordance `ContactForm`
 * makes: the schema re-validates every submission inside the action, the action
 * re-sniffs every uploaded byte, and the database carries the same bounds.
 */

const FIELD_CLASS =
  "w-full resize-y border border-border bg-ivory/3 px-5 py-4 text-[13px] leading-relaxed tracking-wide text-ivory transition-colors duration-300 placeholder:text-ivory/25 focus:border-gold/40 focus:outline-none";

const LABEL_CLASS =
  "mb-2.5 block font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/35";

export interface CommentFormProps {
  slug: string;
  locale: Locale;
  /** Translated "Guest", for the byline preview and for guest rows. */
  guestLabel: string;
  /** Comment ids already rendered by the server list. */
  storedIds: string[];
}

export default function CommentForm({
  slug,
  locale,
  guestLabel,
  storedIds,
}: CommentFormProps) {
  const dict = useDictionary();
  const copy = dict.product.comments;

  const { user } = useUser();
  const [body, setBody] = useState("");
  const [rating, setRating] = useState(0);
  const [images, setImages] = useState<CommentImageUpload[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSent, setIsSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  /**
   * Comments posted in this session, newest first.
   *
   * Shown until the revalidated server list catches up — see the filter below,
   * which retires each one the moment its id appears there.
   */
  const [posted, setPosted] = useState<ProductComment[]>([]);

  /**
   * Honeypot. Hidden from sight and from the tab order, so only a bot walking
   * the DOM fills it. The action drops any submission where it is non-empty.
   */
  const [company, setCompany] = useState("");

  /** Error codes the action returns, resolved against the dictionary here. */
  const fieldMessages: Record<string, string> = {
    bodyTooShort: copy.bodyTooShort,
    bodyTooLong: copy.bodyTooLong,
    contentRequired: copy.contentRequired,
    ratingInvalid: copy.ratingInvalid,
    imageCount: copy.photoLimit,
    imageTooLarge: copy.photoTooLarge,
    imageType: copy.photoType,
    slugInvalid: copy.deliveryError,
  };

  const stored = new Set(storedIds);
  const pending = posted.filter((comment) => !stored.has(comment.id));

  const trimmed = body.trim();
  const hasBody = trimmed.length >= COMMENT_MIN_LENGTH;
  const hasRating = rating > 0;
  const canSubmit = (hasBody || hasRating) && !isPending;

  const byline = interpolate(copy.postingAs, {
    name: user?.fullName?.trim() || guestLabel,
  });

  /** Clears the field-level notice the moment the visitor changes anything. */
  function touch() {
    if (error) setError(null);
    if (isSent) setIsSent(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;

    setError(null);
    setIsSent(false);

    // Words are optional now, but *something* is not.
    if (!hasBody && !hasRating) {
      setError(trimmed.length === 0 ? copy.contentRequired : copy.bodyTooShort);
      return;
    }

    startTransition(async () => {
      const result = await postProductComment({
        slug,
        body: hasBody ? trimmed : "",
        rating: hasRating ? rating : undefined,
        images: images.length > 0 ? images : undefined,
        company,
      });

      if (result.ok) {
        setBody("");
        setRating(0);
        setImages([]);
        setIsSent(true);
        // `null` is the honeypot branch: nothing was written, and nothing is
        // shown. A human never reaches it.
        const comment = result.comment;
        if (comment) setPosted((current) => [comment, ...current]);
        return;
      }

      if (result.error === "validation" && result.fieldErrors) {
        const [code] = Object.values(result.fieldErrors);
        setError(fieldMessages[code] ?? dict.forms.errorMessage);
        return;
      }

      setError(
        result.error === "rateLimited"
          ? dict.forms.rateLimited
          : copy.deliveryError,
      );
    });
  }

  return (
    <div>
      <form onSubmit={handleSubmit} noValidate className="relative">
        {/* Stars first: the cheapest way to say something. */}
        <div className="mb-8">
          <p className={LABEL_CLASS}>
            {copy.ratingLabel}
            <span className="ms-2 text-ivory/20">{copy.ratingOptional}</span>
          </p>

          <StarRatingInput
            value={rating}
            onChange={(next) => {
              setRating(next);
              touch();
            }}
            label={copy.ratingLabel}
            optionLabel={(stars) =>
              interpolate(copy.ratingOutOf, {
                rating: formatRating(stars, locale),
              })
            }
            clearLabel={copy.ratingClear}
            disabled={isPending}
          />
        </div>

        <label htmlFor="comment-body" className={LABEL_CLASS}>
          {byline}
        </label>

        <textarea
          id="comment-body"
          name="body"
          rows={4}
          value={body}
          maxLength={COMMENT_MAX_LENGTH}
          placeholder={copy.placeholder}
          onChange={(event) => {
            setBody(event.target.value);
            touch();
          }}
          aria-label={copy.srLabel}
          aria-invalid={error !== null}
          aria-describedby={error ? "comment-error" : undefined}
          className={FIELD_CLASS}
        />

        {/*
          Honeypot: off-screen rather than `display:none`, since some bots skip
          hidden fields. `tabIndex={-1}` and `aria-hidden` keep it away from
          keyboard and screen-reader users, who never encounter it.
        */}
        <div
          className="absolute left-[-9999px] h-0 w-0 overflow-hidden"
          aria-hidden="true"
        >
          <label htmlFor="comment-company">Company</label>
          <input
            id="comment-company"
            name="company"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={company}
            onChange={(event) => setCompany(event.target.value)}
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-4 md:gap-x-6 gap-y-3">
          <button
            type="submit"
            disabled={!canSubmit}
            aria-busy={isPending}
            className="btn-luxury btn-luxury-fill min-w-50 justify-center disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending
              ? copy.submitting
              : hasRating && !hasBody
                ? copy.submitRating
                : copy.submit}
          </button>

          <CommentImageUploader
            images={images}
            onChange={(next) => {
              setImages(next);
              touch();
            }}
            onError={(message) => {
              if (message) setIsSent(false);
              setError(message);
            }}
            disabled={isPending}
          />

          {error ? (
            <p
              id="comment-error"
              role="alert"
              className="text-[12px] leading-relaxed text-danger"
            >
              {error}
            </p>
          ) : null}

          {isSent && !error ? (
            <p role="status" className="text-[12px] tracking-wide text-gold">
              {copy.sent}
            </p>
          ) : null}
        </div>
      </form>

      {/* Only what this visitor just wrote, and only until the server list
          carries it. Nothing renders here on a first visit. */}
      {pending.length > 0 ? (
        <div className="mt-8 md:mt-14">
          {pending.map((comment) => (
            <CommentRow
              key={comment.id}
              comment={comment}
              guestLabel={guestLabel}
              ratingOutOfLabel={copy.ratingOutOf}
              locale={locale}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
