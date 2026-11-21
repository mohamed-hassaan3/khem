import Image from "next/image";

/**
 * A product's thumbnail on an order: its primary photograph in a 3:4 frame,
 * or — for an archived product or one without an image — a drawn bottle in
 * the house's obsidian and gold, so a row never shows a broken image.
 *
 * Decorative (`alt=""`): the product's name is always printed beside it.
 */
export default function OrderThumb({
  src,
  size = "md",
}: {
  src: string | null;
  size?: "sm" | "md";
}) {
  const box = size === "sm" ? "h-10 w-[30px]" : "h-14 w-[42px]";

  if (src) {
    return (
      <span className={`relative block shrink-0 overflow-hidden rounded-[3px] border border-ground-border bg-sand ${box}`}>
        <Image src={src} alt="" fill sizes="42px" className="object-cover" />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`relative block shrink-0 rounded-[3px] border border-gold/70 bg-[linear-gradient(180deg,#2a2622_0%,#0d0d0d_100%)] ${box}`}
    >
      <span className="absolute -top-1.5 left-1/2 h-1.5 w-1/3 -translate-x-1/2 rounded-[1px] bg-gold" />
    </span>
  );
}
