"use client";

import { useEffect } from "react";

/**
 * Opens the order an email linked to.
 *
 * Order emails link to `/account/orders#KHEM-2026-1042`. The browser scrolls
 * to that `<details>`, but a closed disclosure would show only its summary —
 * the customer clicked "Track your order" and should land on the timeline.
 * Renders nothing; listens for later hash changes too.
 */
export default function OpenOrderFromHash() {
  useEffect(() => {
    function open() {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;
      const target = document.getElementById(id);
      if (target instanceof HTMLDetailsElement) {
        target.open = true;
        target.scrollIntoView({ block: "start" });
      }
    }

    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);

  return null;
}
