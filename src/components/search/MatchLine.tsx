/**
 * "Matches · Smoked Incense · Black Oud" — why a result matched.
 *
 * The notes come from `search_match_notes()` (0076): only notes the product
 * really contains, and only when the meaning-based pass ran. With no notes the
 * line renders nothing at all — a result never claims a reason it lacks.
 *
 * Server-safe. `dir="auto"` per note keeps a Latin note name readable inside
 * an Arabic line and vice versa.
 */

export default function MatchLine({
  label,
  notes,
  className = "",
}: {
  label: string;
  notes: readonly string[] | undefined;
  className?: string;
}) {
  if (!notes || notes.length === 0) return null;

  return (
    <p className={`text-[11px] leading-relaxed tracking-wide text-ground-muted ${className}`}>
      <span className="text-ground-accent">{label}</span>
      {notes.map((note) => (
        <span key={note}>
          {" · "}
          <span dir="auto">{note}</span>
        </span>
      ))}
    </p>
  );
}
