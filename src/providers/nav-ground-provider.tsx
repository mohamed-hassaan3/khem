"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

/**
 * What the header is sitting on.
 *
 * ## The problem this solves
 *
 * `<Nav>` is a single fixed element mounted once in the locale layout, and it
 * has to be legible over whatever the page beneath it happens to be. While the
 * site was obsidian everywhere that was free. Under a multi-ground system it is
 * the one piece of chrome that can be catastrophically wrong — ivory type on an
 * ivory bar is not a degraded state, it is an invisible header.
 *
 * ## Why the page declares it rather than the header detecting it
 *
 * The tempting implementation is for the header to look at what is physically
 * underneath it — `elementFromPoint` below the header's own bottom edge, or an
 * `IntersectionObserver` over every `.ground-*` section — and adapt. Both work,
 * both run on every scroll frame, and both answer a question the page already
 * knows the answer to statically. They also fail in the same place: during the
 * gap between two sections, or over a full-bleed image that belongs to neither.
 *
 * So the page states it, once, and the header believes it. `<NavGround>` is the
 * declaration; this is where it is kept.
 *
 * ## One state, so there is only a colour left to declare
 *
 * The header used to have two appearances — transparent over a banner,
 * surfaced once scrolled — and a `hero` flag per page to choose which one it
 * started in. Both are gone. The bar is translucent-over-blur at every scroll
 * position on every route, the page runs underneath it, and the only thing a
 * page still has to say is which ground the bar's wash and links are drawn
 * from.
 *
 * That also removes the failure this file was originally written to prevent:
 * with no second state, there is no combination of declarations that can
 * produce an invisible header.
 */

export type GroundName =
  | "ivory"
  | "stone"
  | "sand"
  | "charcoal"
  | "obsidian";

export interface NavGroundState {
  /**
   * The ground the header's wash and links are drawn from. It is what decides
   * whether the links are charcoal or ivory.
   */
  ground: GroundName;
}

export const DEFAULT_NAV_GROUND: NavGroundState = {
  ground: "ivory",
};

interface NavGroundContextValue extends NavGroundState {
  setNavGround: (state: NavGroundState) => void;
  resetNavGround: () => void;
}

const NavGroundContext = createContext<NavGroundContextValue | null>(null);

export function NavGroundProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<NavGroundState>(DEFAULT_NAV_GROUND);

  const setNavGround = useCallback((next: NavGroundState) => {
    setState((current) => (current.ground === next.ground ? current : next));
  }, []);

  const resetNavGround = useCallback(() => {
    setState(DEFAULT_NAV_GROUND);
  }, []);

  const value = useMemo(
    () => ({ ...state, setNavGround, resetNavGround }),
    [state, setNavGround, resetNavGround],
  );

  return (
    <NavGroundContext.Provider value={value}>
      {children}
    </NavGroundContext.Provider>
  );
}

/**
 * Read the current header ground.
 *
 * Falls back to the default rather than throwing when no provider is mounted:
 * the header is chrome, and a missing provider should not be able to take the
 * whole page down.
 */
export function useNavGround(): NavGroundState {
  const context = useContext(NavGroundContext);
  return context ?? DEFAULT_NAV_GROUND;
}

export function useSetNavGround() {
  const context = useContext(NavGroundContext);
  return {
    setNavGround: context?.setNavGround,
    resetNavGround: context?.resetNavGround,
  };
}
