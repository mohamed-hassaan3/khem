"use client";

import { ImagePlus, X } from "lucide-react";
import { useRef, type ChangeEvent } from "react";

import {
  COMMENT_IMAGE_ACCEPT,
  COMMENT_MAX_IMAGES,
  COMMENT_MAX_IMAGE_BYTES,
  isCommentImageType,
} from "@/src/lib/comment-images";
import { interpolate } from "@/src/lib/i18n/interpolate";
import type { CommentImageUpload } from "@/src/schemas/comments";
import { useDictionary } from "@/src/providers/i18n-provider";

/**
 * Photographs on a comment.
 *
 * An icon in the same row as Post Comment, framed like `<AddToBagButton>` so
 * the two secondary controls on a product page read as siblings. The file input
 * itself is hidden and clicked through the button — a native file input cannot
 * be styled into this palette, and every browser makes the label-click route
 * work identically.
 *
 * Files become data URLs *here*, in the browser, so the payload the Server
 * Action receives is plain JSON like every other field on the form. The checks
 * below — count, size, type — are the same UX affordance the textarea's length
 * limit is: `prepareImages()` re-does all three on the decoded bytes and does
 * not believe the `type` a browser reports.
 */

export interface CommentImageUploaderProps {
  images: CommentImageUpload[];
  onChange: (images: CommentImageUpload[]) => void;
  /** Raised with a translated sentence, or `null` when the selection is fine. */
  onError: (message: string | null) => void;
  disabled?: boolean;
}

export default function CommentImageUploader({
  images,
  onChange,
  onError,
  disabled = false,
}: CommentImageUploaderProps) {
  const dict = useDictionary();
  const copy = dict.product.comments;
  const inputRef = useRef<HTMLInputElement>(null);

  const isFull = images.length >= COMMENT_MAX_IMAGES;

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    // Reset immediately: without it, choosing the same file twice in a row
    // fires no `change` event the second time.
    event.target.value = "";
    if (files.length === 0) return;

    if (images.length + files.length > COMMENT_MAX_IMAGES) {
      onError(copy.photoLimit);
      return;
    }

    const next: CommentImageUpload[] = [];

    for (const file of files) {
      if (!isCommentImageType(file.type)) {
        onError(copy.photoType);
        return;
      }

      if (file.size > COMMENT_MAX_IMAGE_BYTES) {
        onError(copy.photoTooLarge);
        return;
      }

      const dataUrl = await readAsDataUrl(file);
      if (!dataUrl) {
        onError(copy.photoType);
        return;
      }

      next.push({ dataUrl, type: file.type, size: file.size });
    }

    onError(null);
    onChange([...images, ...next]);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={COMMENT_IMAGE_ACCEPT}
        onChange={(event) => {
          void handleFiles(event);
        }}
        // Off-screen rather than `display:none`, so the click the button
        // forwards always lands on a rendered element.
        className="absolute h-0 w-0 overflow-hidden opacity-0"
        tabIndex={-1}
        aria-hidden="true"
      />

      <button
        type="button"
        disabled={disabled || isFull}
        onClick={() => inputRef.current?.click()}
        aria-label={copy.addPhotos}
        title={copy.addPhotos}
        className="group grid size-11 cursor-pointer place-items-center border border-ground-border bg-ivory/3 transition-colors duration-300 ease-out hover:border-gold focus-visible:border-gold focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40"
      >
        <ImagePlus
          size={16}
          strokeWidth={1.25}
          aria-hidden="true"
          className="text-ground-muted transition-colors duration-300 ease-out group-hover:text-ground-accent"
        />
      </button>

      {images.map((image, index) => (
        <div key={image.dataUrl.slice(-32) + index} className="relative">
          {/* A data URL cannot go through `next/image`; the admin image editor
              renders its previews the same way and for the same reason. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.dataUrl}
            alt=""
            className="size-16 border border-ground-border object-cover"
          />

          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              onError(null);
              onChange(images.filter((_, position) => position !== index));
            }}
            aria-label={interpolate(copy.removePhoto, { index: index + 1 })}
            className="absolute -end-2 -top-2 grid size-6 cursor-pointer place-items-center border border-ground-border bg-ground-bg text-ground-muted transition-colors duration-300 ease-out hover:border-gold hover:text-ground-accent focus-visible:border-gold focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40"
          >
            <X size={12} strokeWidth={1.25} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}

/** `FileReader` as a promise. Resolves `null` on an unreadable file. */
function readAsDataUrl(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}
