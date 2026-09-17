import Image from "next/image";

/**
 * The opening hero shared by the four category collections under
 * `/collections/[slug]` — Server Component.
 *
 * All of them open on the same shape: a full-bleed photograph graded down
 * to near-black, a two-line display title whose second line is gold, a rule,
 * and a paragraph. Keeping it in one component is what stops the three pages
 * drifting apart the way the original SPA files had, where the same hero was
 * pasted three times with three different scrim gradients.
 */

export interface CategoryHeroProps {
  eyebrow: string;
  /** First line of the display title — ivory. */
  titleLead: string;
  /** Optional second line — gold. */
  titleAccent?: string;
  description: string;
  /** Optional single line under the description, e.g. the discovery promise. */
  note?: string;
  imageUrl: string;
  imageAlt: string;
}

export default function CategoryHero({
  eyebrow,
  titleLead,
  titleAccent,
  description,
  note,
  imageUrl,
  imageAlt,
}: CategoryHeroProps) {
  /*
   * The category banner, as an *editorial* banner (§14).
   *
   * ## The type sits on the floor, not in the middle of the picture
   *
   * This was `items-center` with a reading-column scrim: the words ran across
   * the middle of the frame, which meant the gradient had to be strong enough
   * to carry a paragraph over the busiest part of the photograph. The result
   * was a banner you could read and could not see — at 390px, Body Care was a
   * washed corner of a bottle behind a lede, while `/collections/signature`
   * one section away showed its photograph whole.
   *
   * So the composition follows `<CollectionView>`, which is the house
   * reference: the photograph owns the top of the frame at its own luminance,
   * the ivory floor comes up under the type, and the reader sees the artwork
   * before reading a word. The copy, the type scale and the two-line title are
   * untouched — this is where they sit, not what they say.
   *
   * The frame is taller on a phone than on a desktop (`80vh` → `70vh`) and
   * not by accident: the text block is a fixed number of *lines*, so it eats a
   * far larger share of a narrow frame. Holding the picture's share roughly
   * constant across widths is what makes one banner rather than three.
   */
  return (
    <section className="ground-ivory relative flex h-[80vh] min-h-150 items-end overflow-hidden bg-sand md:h-[70vh] md:min-h-140">
      <Image
        src={imageUrl}
        alt={imageAlt}
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />

      {/*
       * The house banner scrim — one variant, the floor. With the type on the
       * bottom edge there is nothing left for a horizontal wash to protect,
       * and the mirrored reading-column gradient this used to carry went with
       * it: an RTL page now gets the same floor as an LTR one, because a floor
       * has no side.
       */}
      {/*
       * The floor is pushed up to clear this banner's own copy — eyebrow,
       * two-line title, rule, lede and an optional note. Measured, not
       * guessed: the block's top edge sits at ~53% of the frame on a phone and
       * ~73% on a desktop, so the wash has to have fallen to nothing above
       * that, not at the collection banners' 64%.
       */}
      <div
        aria-hidden="true"
        className="banner-scrim banner-scrim-base [--scrim-mid:32%] [--scrim-end:72%] md:[--scrim-mid:46%] md:[--scrim-end:90%]"
      />

      <div className="relative z-1 w-full px-4 pb-14 md:px-20 md:pb-18">
        <div className="mx-auto max-w-350">
          <div className="max-w-2xl">
            <p className="eyebrow mb-5">{eyebrow}</p>

            <h1 className="font-heading text-4xl font-normal leading-tight text-ground sm:text-6xl md:text-7xl">
              {titleLead}
              {titleAccent ? (
                <>
                  <br />
                  <span className="text-ground-accent">{titleAccent}</span>
                </>
              ) : null}
            </h1>

            <div className="gold-line my-7" />

            <p className="max-w-lg text-[15px] leading-loose text-ground-muted">
              {description}
            </p>

            {note ? (
              <p className="mt-9 font-heading text-[11px] tracking-[0.2em] text-ground-accent">
                {note}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
