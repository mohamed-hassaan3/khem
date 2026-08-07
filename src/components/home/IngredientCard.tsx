import Image from "next/image";
import Link from "next/link";

import type { Ingredient } from "@/src/types/content";

/** Ingredient card — Server Component. Rendered inside the horizontal rail. */

export interface IngredientCardProps {
  ingredient: Ingredient;
}

export default function IngredientCard({ ingredient }: IngredientCardProps) {
  return (
    <Link
      href="/ingredients"
      className="img-zoom group relative w-[260px] flex-none overflow-hidden bg-surface no-underline sm:w-[300px]"
    >
      <div className="relative h-[380px] overflow-hidden">
        <Image
          src={ingredient.image.url}
          alt={ingredient.image.alt}
          fill
          sizes="(min-width: 640px) 300px, 260px"
          className="object-cover brightness-50 saturate-[0.7]"
        />
      </div>
      <div className="border-t border-border p-6">
        <h3 className="mb-1 font-heading text-base font-normal text-ivory">
          {ingredient.name}
        </h3>
        <p className="text-xs tracking-wider text-gold/60">
          From {ingredient.origin}
        </p>
      </div>
    </Link>
  );
}
