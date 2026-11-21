import { ChevronDown } from "lucide-react";

/**
 * One row of the product page's long reads: the story, the key ingredient,
 * delivery and returns.
 *
 * A native `<details>`, so it opens without JavaScript, is keyboard and
 * screen-reader operable out of the box, and its content stays in the server
 * HTML (search engines read a closed `<details>`). The body rises in with
 * `khem-rise`, which `globals.css` switches off under reduced motion.
 *
 * Stage 2, `prompts/storefront-redesign-stage-2.md` D7.
 */
export interface ProductAccordionProps {
  title: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export default function ProductAccordion({
  title,
  defaultOpen = false,
  children,
}: ProductAccordionProps) {
  return (
    <details
      open={defaultOpen}
      className="group border-t border-ground-border last:border-b"
    >
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 font-heading text-[13px] tracking-[0.08em] text-ground transition-colors duration-300 ease-out hover:text-ground-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ground-accent [&::-webkit-details-marker]:hidden">
        <span dir="auto">{title}</span>
        <ChevronDown
          size={16}
          strokeWidth={1.25}
          aria-hidden="true"
          className="shrink-0 text-ground-muted transition-transform duration-500 ease-luxury-bezier group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <div className="khem-rise pb-5">{children}</div>
    </details>
  );
}
