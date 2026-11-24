/**
 * The desk's loading state — inside the panel, under the shell.
 *
 * Without this file the nearest boundary was `[locale]/loading.tsx`, the
 * storefront's full-screen loader, which covered the header, the rail and the
 * page the admin had just left on every move between admin screens. Declared
 * here, below `admin/layout.tsx`, the shell stays on screen and only the panel
 * shows a quiet outline of a page (prompts/admin-redesign-stage-6.md).
 *
 * Static shapes and one CSS pulse; nothing that moves under reduced motion.
 */
export default function AdminLoading() {
  return (
    <div role="status" aria-label="Loading" className="animate-pulse motion-reduce:animate-none">
      <div className="h-3 w-24 rounded bg-ground-border" />
      <div className="mt-3 h-8 w-56 max-w-full rounded bg-ground-border" />
      <div className="mt-8 grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="h-20 rounded-lg border border-ground-border bg-stone" />
        ))}
      </div>
      <div className="mt-6 space-y-2">
        {[0, 1, 2, 3, 4].map((index) => (
          <div key={index} className="h-14 rounded-lg border border-ground-border bg-stone" />
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
