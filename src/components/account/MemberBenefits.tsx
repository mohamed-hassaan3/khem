/**
 * The membership note at the foot of the overview.
 *
 * Editorial copy, not data — it states what a KHEM account is for, which is
 * exactly the sort of thing the dictionary owns. Its own file because the
 * overview panel is a composition root, not a place to inline blocks.
 */
export default function MemberBenefits({
  heading,
  body,
}: {
  heading: string;
  body: string;
}) {
  return (
    <section className="border border-gold/15 bg-gold/6 px-8 py-6">
      <p className="mb-1.5 font-heading text-[13px] tracking-[0.08em] text-gold">
        {heading}
      </p>

      <p className="text-xs leading-loose text-ivory/40">{body}</p>
    </section>
  );
}
