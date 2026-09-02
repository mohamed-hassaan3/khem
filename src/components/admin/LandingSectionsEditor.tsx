"use client";

/**
 * The home page's running order.
 *
 * Move, show, hide — and nothing else. Each band's *content* is edited where
 * that band's records live, and the row says where that is rather than
 * pretending this screen owns it. That honesty is inherited from the page this
 * replaces, whose whole job was to be a map.
 *
 * Every control writes immediately and refreshes: there is no Save button
 * because there is no draft. Moving a section up is one fact, and holding it in
 * local state until a submit would mean the screen could disagree with the site.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp } from "lucide-react";

import { moveSection, toggleSection } from "@/src/actions/admin/landing";
import { useAdminToast } from "@/src/providers/admin-toast-provider";
import {
  SECTION_REGISTRY,
  type LandingSection,
  type LandingSectionKey,
} from "@/src/lib/landing-sections";

export default function LandingSectionsEditor({
  sections,
}: {
  sections: LandingSection[];
}) {
  const router = useRouter();
  const { toast } = useAdminToast();
  const [pendingKey, setPendingKey] = useState<LandingSectionKey | null>(null);
  /*
   * Failures are printed on the row, not toasted. The toast provider takes
   * successes only, deliberately — a confirmation may float away unread, but an
   * editor who missed a failure would believe the page changed when it did not.
   */
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  /** The movable band positions, so the end buttons can be disabled. */
  const movable = sections.filter((section) => !section.isPinned);

  function run(key: LandingSectionKey, work: () => Promise<{ ok: boolean; message: string }>) {
    setPendingKey(key);
    setError(null);
    startTransition(async () => {
      const outcome = await work();
      setPendingKey(null);

      if (!outcome.ok) {
        setError(outcome.message);
        return;
      }

      toast(outcome.message);
      router.refresh();
    });
  }

  return (
    <>
      {error ? (
        <p role="alert" className="mb-4 text-[11px] text-danger">
          {error}
        </p>
      ) : null}

      <ol className="flex flex-col gap-px bg-ground-border">
      {sections.map((section) => {
        const meta = SECTION_REGISTRY[section.key];
        const index = movable.indexOf(section);
        const busy = isPending && pendingKey === section.key;

        return (
          <li
            key={section.key}
            className={`flex flex-col gap-3 bg-ground-bg p-5 sm:flex-row sm:items-center sm:justify-between ${
              section.isEnabled ? "" : "opacity-55"
            }`}
          >
            <div className="min-w-0">
              <p className="font-heading text-[13px] text-ground">
                {meta.name}
                {section.isPinned ? (
                  <span className="ms-2 font-body text-[9px] uppercase tracking-[0.2em] text-ground-subtle">
                    Always first
                  </span>
                ) : null}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-ground-muted">
                {meta.source}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {/*
                A pinned band gets no move controls at all rather than disabled
                ones: it is not "temporarily unmovable", it is structural, and a
                greyed arrow would invite someone to keep clicking it.
              */}
              {section.isPinned ? null : (
                <>
                  <MoveButton
                    label={`Move ${meta.name} up`}
                    disabled={busy || index <= 0}
                    onClick={() =>
                      run(section.key, () =>
                        moveSection({ key: section.key, direction: "up" }),
                      )
                    }
                  >
                    <ArrowUp size={14} strokeWidth={1.25} aria-hidden="true" />
                  </MoveButton>
                  <MoveButton
                    label={`Move ${meta.name} down`}
                    disabled={busy || index >= movable.length - 1}
                    onClick={() =>
                      run(section.key, () =>
                        moveSection({ key: section.key, direction: "down" }),
                      )
                    }
                  >
                    <ArrowDown size={14} strokeWidth={1.25} aria-hidden="true" />
                  </MoveButton>
                </>
              )}

              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  run(section.key, () =>
                    toggleSection({
                      key: section.key,
                      isEnabled: !section.isEnabled,
                    }),
                  )
                }
                className="rounded-none border border-ground-border px-4 py-2 font-heading text-[9px] uppercase tracking-[0.2em] text-ground-muted transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-gold/40 hover:text-ground-accent disabled:pointer-events-none disabled:opacity-30"
              >
                {busy ? "…" : section.isEnabled ? "Hide" : "Show"}
              </button>
            </div>
          </li>
        );
        })}
      </ol>
    </>
  );
}

function MoveButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-9 place-items-center border border-ground-border text-ground-muted transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-gold/40 hover:text-ground-accent disabled:pointer-events-none disabled:opacity-25"
    >
      {children}
    </button>
  );
}
