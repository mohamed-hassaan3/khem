"use client";

import { useEffect, useState } from "react";

/**
 * Whether the site footer (`[data-site-footer]`) is on screen.
 *
 * Sticky bottom bars (the checkout's action bar on a phone) step aside while
 * it is, so they never cover the footer's last lines. One observer, no scroll
 * listener. False on the server and until the footer is found.
 */
export function useSiteFooterInView(): boolean {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const footer = document.querySelector("[data-site-footer]");
    if (!footer) return;

    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  return inView;
}
