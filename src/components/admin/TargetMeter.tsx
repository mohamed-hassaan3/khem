/**
 * One target, read back as Target / Actual / Remaining / Achievement.
 *
 * A Server Component: nothing here is interactive, and the four numbers are the
 * point. The bar is capped at 100% of its track while the *figure* is not — a
 * month at 115% says 115% and fills the bar, because a bar that overflowed its
 * container would be a layout bug and a bar that reset to 15% would be a lie.
 *
 * `null` actuals are rendered as an em dash rather than as zero, and the
 * achievement with them: an unknown gross profit is not 0% of its target, and
 * printing it as such would tell the desk it had failed a month it simply has
 * not costed yet.
 */

import { egpCompact } from "@/src/lib/admin/money";
import { formatAchievement, type TargetProgress } from "@/src/lib/admin/finance";

export default function TargetMeter({
  label,
  progress,
  note,
}: {
  label: string;
  progress: TargetProgress;
  note?: string;
}) {
  const met = progress.achievement !== null && progress.achievement >= 100;
  const fill =
    progress.achievement === null ? 0 : Math.min(Math.max(progress.achievement, 0), 100);

  return (
    <div className="border border-ground-border p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="font-heading text-[9px] uppercase tracking-[0.2em] text-ground-subtle">
          {label}
        </p>
        <p
          className={`font-heading text-[11px] tracking-[0.1em] ${
            met ? "text-ground-accent" : "text-ground-muted"
          }`}
        >
          {formatAchievement(progress.achievement)}
        </p>
      </div>

      <div className="mt-4 h-px w-full bg-ivory/8">
        <div
          className={`h-px transition-[width] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            met ? "bg-gold" : "bg-gold/50"
          }`}
          style={{ width: `${Math.max(fill, 1)}%` }}
        />
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-3">
        <div>
          <dt className="font-heading text-[9px] uppercase tracking-[0.2em] text-ground-subtle">
            Target
          </dt>
          <dd className="mt-1.5 text-[12px] tracking-wide text-ground">
            {egpCompact(progress.targetInCents)}
          </dd>
        </div>
        <div>
          <dt className="font-heading text-[9px] uppercase tracking-[0.2em] text-ground-subtle">
            Actual
          </dt>
          <dd className="mt-1.5 text-[12px] tracking-wide text-ground">
            {progress.actualInCents === null ? "—" : egpCompact(progress.actualInCents)}
          </dd>
        </div>
        <div>
          <dt className="font-heading text-[9px] uppercase tracking-[0.2em] text-ground-subtle">
            Remaining
          </dt>
          <dd className="mt-1.5 text-[12px] tracking-wide text-ground">
            {progress.remainingInCents === null
              ? "—"
              : progress.remainingInCents === 0
                ? "Met"
                : egpCompact(progress.remainingInCents)}
          </dd>
        </div>
      </dl>

      {note ? (
        <p className="mt-4 text-[11px] leading-relaxed tracking-wide text-ground-muted">
          {note}
        </p>
      ) : null}
    </div>
  );
}
