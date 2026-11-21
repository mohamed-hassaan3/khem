/**
 * Tells the site chrome what kind of page this is, before the first paint.
 *
 * Rendered by a page, read by CSS (`body:has([data-chrome=…])` in
 * `globals.css`): `purchase` drops the announcement bar on phones (product and
 * set pages), `task` drops it at every width (checkout). A server-rendered
 * attribute rather than client state, so the header stack's height is right in
 * the HTML and nothing shifts on hydration.
 *
 * The Nav decides its own variant from the pathname; this marker exists only
 * for the parts of the stack the layout renders and CSS sizes.
 */
export default function ChromeMarker({
  kind,
}: {
  kind: "purchase" | "task";
}) {
  return <span hidden data-chrome={kind} />;
}
