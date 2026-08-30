"use client";

import { useEffect } from "react";

import {
  type GroundName,
  useSetNavGround,
} from "@/src/providers/nav-ground-provider";

/**
 * A page's declaration of what `<Nav>` is sitting on. Renders nothing.
 *
 * ```tsx
 * <NavGround ground="ivory" />
 * ```
 *
 * The header has one appearance — a translucent wash over a blur, identical at
 * every scroll position — so the only thing left to declare is the ground that
 * wash and its links are drawn from. Ivory on every route today.
 *
 * ## The flash that is not a flash
 *
 * This writes through an effect, so on the first paint the header still holds
 * the default. Since the default is `ivory` and every page that declares one
 * declares `ivory` too, there is nothing to see — and even a page that chose
 * differently would show one frame of a *legible* header rather than an
 * illegible one, because the wash and the links always come from the same
 * ground and cannot disagree.
 *
 * The cleanup resets to the default, so a page that declares a ground cannot
 * leave it behind for the next route to inherit.
 */

export interface NavGroundProps {
  ground: GroundName;
}

export default function NavGround({ ground }: NavGroundProps) {
  const { setNavGround, resetNavGround } = useSetNavGround();

  useEffect(() => {
    setNavGround?.({ ground });
    return () => resetNavGround?.();
  }, [ground, setNavGround, resetNavGround]);

  return null;
}
