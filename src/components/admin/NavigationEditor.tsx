"use client";

/**
 * The Nav and the Footer, edited as a tree.
 *
 * Three columns, in the order the header prints them, each a list of entries
 * that can be reordered, switched off, reworded or removed. A row inside a
 * disclosure is drawn indented under it — one level, which is all the renderer
 * and the database allow.
 *
 * ## No URL field
 *
 * Adding an entry means *choosing* a category, a collection, or one of the
 * pages KHEM ships. There is nowhere here to type an address, which is why a
 * menu entry cannot 404 and cannot be pointed off-site. See
 * `src/actions/admin/navigation.ts`.
 *
 * ## Blank label means "the target's own name"
 *
 * And that is the setting that makes this work in both languages: a collection
 * row carries `name` and `name_ar`, so an entry with no override is translated
 * the moment the collection is. An override is English-only, so it is offered
 * as a deliberate act rather than as the default.
 */

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronDown, ChevronUp, Plus, X } from "lucide-react";

import {
  createNavLink,
  deleteNavLink,
  moveNavLink,
  updateNavLink,
} from "@/src/actions/admin/navigation";
import {
  AdminButton,
  AdminInput,
  AdminNotice,
  AdminSelect,
  AdminToggle,
} from "@/src/components/admin/fields";
import { useAdminToast } from "@/src/providers/admin-toast-provider";
import type { AdminNavLink } from "@/src/schemas/db/admin";

export type NavColumnValue = "COLLECTIONS" | "QUICK_ACCESS" | "WORLD";
export type NavTargetValue = "CATEGORY" | "COLLECTION" | "PAGE" | "GROUP";

export interface NavTargetOptions {
  categories: readonly { value: string; label: string }[];
  collections: readonly { value: string; label: string }[];
  pages: readonly { value: string; label: string }[];
  groups: readonly { value: string; label: string }[];
  /**
   * The collections standing under each category, in catalogue order.
   *
   * Shown, not editable: an entry pointing at a category prints these on the
   * storefront by itself, so the screen has to say so — otherwise the ranges
   * look missing from the menu and somebody adds them again by hand.
   */
  collectionsByCategory: Readonly<
    Record<string, readonly { slug: string; name: string }[]>
  >;
}

/** The columns, in the order the header prints them. */
const COLUMNS: readonly { value: NavColumnValue; title: string; hint: string }[] = [
  {
    value: "COLLECTIONS",
    title: "Our Collections",
    hint: "The shelf. Disclosures group the ranges; the Footer flattens them into a sitemap.",
  },
  {
    value: "QUICK_ACCESS",
    title: "Quick Access",
    hint: "The ways in — what a returning visitor reaches for rather than browses.",
  },
  {
    value: "WORLD",
    title: "The World of KHEM",
    hint: "Editorial pages. Groups are not printed in this column.",
  },
];

const TARGET_OPTIONS: readonly { value: NavTargetValue; label: string }[] = [
  { value: "CATEGORY", label: "Category" },
  { value: "COLLECTION", label: "Collection" },
  { value: "PAGE", label: "A page KHEM ships" },
  { value: "GROUP", label: "Disclosure — a heading with rows beneath it" },
];

interface DraftState {
  columnKey: NavColumnValue;
  parentId: string | null;
  targetType: NavTargetValue;
  categorySlug: string;
  collectionSlug: string;
  pageKey: string;
  groupKey: string;
  label: string;
  desc: string;
  showInNav: boolean;
  showInFooter: boolean;
  isEnabled: boolean;
  sortOrder: number;
}

function draftFrom(link: AdminNavLink): DraftState {
  return {
    columnKey: link.column_key,
    parentId: link.parentId,
    targetType: link.targetType,
    categorySlug: link.categorySlug ?? "",
    collectionSlug: link.collectionSlug ?? "",
    pageKey: link.pageKey ?? "",
    groupKey: link.groupKey ?? "",
    label: link.label ?? "",
    desc: link.desc ?? "",
    showInNav: link.showInNav,
    showInFooter: link.showInFooter,
    isEnabled: link.isEnabled,
    sortOrder: link.sortOrder,
  };
}

function emptyDraft(
  columnKey: NavColumnValue,
  parentId: string | null,
  sortOrder: number,
): DraftState {
  return {
    columnKey,
    parentId,
    targetType: parentId === null && columnKey === "COLLECTIONS" ? "CATEGORY" : "PAGE",
    categorySlug: "",
    collectionSlug: "",
    pageKey: "",
    groupKey: "",
    label: "",
    desc: "",
    showInNav: true,
    showInFooter: true,
    isEnabled: true,
    sortOrder,
  };
}

/** The payload both actions take — empty strings normalised to null. */
function toPayload(draft: DraftState) {
  const blank = (value: string) => (value.trim().length === 0 ? null : value.trim());

  return {
    columnKey: draft.columnKey,
    parentId: draft.parentId,
    targetType: draft.targetType,
    categorySlug: blank(draft.categorySlug),
    collectionSlug: blank(draft.collectionSlug),
    pageKey: blank(draft.pageKey),
    groupKey: blank(draft.groupKey),
    label: blank(draft.label),
    desc: blank(draft.desc),
    showInNav: draft.showInNav,
    showInFooter: draft.showInFooter,
    isEnabled: draft.isEnabled,
    sortOrder: draft.sortOrder,
  };
}

export default function NavigationEditor({
  links,
  targets,
}: {
  links: readonly AdminNavLink[];
  targets: NavTargetOptions;
}) {
  const router = useRouter();
  const { toast } = useAdminToast();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  /** The row being edited, or `new:<column>:<parentId>` for an addition. */
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState | null>(null);

  function run(work: () => Promise<{ ok: boolean; message: string }>) {
    setMessage(null);

    startTransition(async () => {
      const outcome = await work();

      if (!outcome.ok) {
        setMessage(outcome.message);
        return;
      }

      toast(outcome.message);
      setOpenRow(null);
      setDraft(null);
      router.refresh();
    });
  }

  const topLevel = (column: NavColumnValue) =>
    links
      .filter((link) => link.column_key === column && link.parentId === null)
      .sort((a, b) => a.sortOrder - b.sortOrder);

  const childrenOf = (id: string) =>
    links
      .filter((link) => link.parentId === id)
      .sort((a, b) => a.sortOrder - b.sortOrder);

  /** What a row points at, in words — the dashboard's preview of the label. */
  function describe(link: AdminNavLink): string {
    const find = (
      options: readonly { value: string; label: string }[],
      value: string | null,
    ) => options.find((option) => option.value === value)?.label ?? value ?? "—";

    switch (link.targetType) {
      case "CATEGORY":
        return `Category · ${find(targets.categories, link.categorySlug)}`;
      case "COLLECTION":
        return `Collection · ${find(targets.collections, link.collectionSlug)}`;
      case "PAGE":
        return `Page · ${find(targets.pages, link.pageKey)}`;
      case "GROUP":
        return `Disclosure · ${find(targets.groups, link.groupKey)}`;
    }
  }

  function renderForm(key: string, siblings: number) {
    if (openRow !== key || draft === null) return null;

    const isNew = key.startsWith("new:");

    return (
      <div className="mt-3 space-y-5 border border-ground-border p-5">
        <AdminSelect
          id={`${key}-targetType`}
          label="Points at"
          value={draft.targetType}
          options={
            draft.parentId === null && draft.columnKey === "COLLECTIONS"
              ? TARGET_OPTIONS
              : TARGET_OPTIONS.filter((option) => option.value !== "GROUP")
          }
          onChange={(value) =>
            setDraft({ ...draft, targetType: value as NavTargetValue })
          }
          hint="A disclosure is a heading with rows beneath it, and only the Collections column prints one."
        />

        {draft.targetType === "CATEGORY" ? (
          <AdminSelect
            id={`${key}-categorySlug`}
            label="Category"
            value={draft.categorySlug}
            options={[{ value: "", label: "Choose a category…" }, ...targets.categories]}
            onChange={(value) => setDraft({ ...draft, categorySlug: value })}
          />
        ) : null}

        {draft.targetType === "COLLECTION" ? (
          <AdminSelect
            id={`${key}-collectionSlug`}
            label="Collection"
            value={draft.collectionSlug}
            options={[
              { value: "", label: "Choose a collection…" },
              ...targets.collections,
            ]}
            onChange={(value) => setDraft({ ...draft, collectionSlug: value })}
          />
        ) : null}

        {draft.targetType === "PAGE" ? (
          <AdminSelect
            id={`${key}-pageKey`}
            label="Page"
            value={draft.pageKey}
            options={[{ value: "", label: "Choose a page…" }, ...targets.pages]}
            onChange={(value) => setDraft({ ...draft, pageKey: value })}
          />
        ) : null}

        {draft.targetType === "GROUP" ? (
          <AdminSelect
            id={`${key}-groupKey`}
            label="Heading"
            value={draft.groupKey}
            options={[{ value: "", label: "Choose a heading…" }, ...targets.groups]}
            onChange={(value) => setDraft({ ...draft, groupKey: value })}
            hint="Headings are translated in the dictionaries, which is why the set is fixed."
          />
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <AdminInput
            id={`${key}-label`}
            label="Label override"
            value={draft.label}
            onChange={(value) => setDraft({ ...draft, label: value })}
            hint="Leave blank to print the target's own name — which is already translated."
          />
          <AdminInput
            id={`${key}-desc`}
            label="Description"
            value={draft.desc}
            onChange={(value) => setDraft({ ...draft, desc: value })}
            hint="The small line under the label in the mega-menu. Optional."
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <AdminToggle
            id={`${key}-showInNav`}
            label="In the menu"
            checked={draft.showInNav}
            onChange={(value) => setDraft({ ...draft, showInNav: value })}
          />
          <AdminToggle
            id={`${key}-showInFooter`}
            label="In the footer"
            checked={draft.showInFooter}
            onChange={(value) => setDraft({ ...draft, showInFooter: value })}
          />
          <AdminToggle
            id={`${key}-isEnabled`}
            label="Shown at all"
            checked={draft.isEnabled}
            onChange={(value) => setDraft({ ...draft, isEnabled: value })}
          />
        </div>

        <div className="flex gap-3">
          <AdminButton
            disabled={isPending}
            onClick={() =>
              run(() =>
                isNew
                  ? createNavLink({
                      ...toPayload(draft),
                      sortOrder: siblings,
                    })
                  : updateNavLink({ id: key, ...toPayload(draft) }),
              )
            }
          >
            {isPending ? "Saving…" : isNew ? "Add entry" : "Save entry"}
          </AdminButton>

          <AdminButton
            variant="ghost"
            disabled={isPending}
            onClick={() => {
              setOpenRow(null);
              setDraft(null);
            }}
          >
            Cancel
          </AdminButton>
        </div>
      </div>
    );
  }

  function renderRow(
    link: AdminNavLink,
    index: number,
    total: number,
    indented: boolean,
  ) {
    const kids = childrenOf(link.id);

    /*
     * The collections this row prints on its own — a category disclosure at the
     * top of the Collections column, minus anything already listed by hand.
     * The same rule `resolveNavigation()` applies, stated here so the screen
     * shows what the storefront will do.
     */
    const claimed = new Set(
      kids.map((kid) => kid.collectionSlug).filter((slug) => slug !== null),
    );

    const automatic =
      link.targetType === "CATEGORY" &&
      link.parentId === null &&
      link.column_key === "COLLECTIONS" &&
      link.categorySlug !== null
        ? (targets.collectionsByCategory[link.categorySlug] ?? []).filter(
            (collection) => !claimed.has(collection.slug),
          )
        : [];

    return (
      <li key={link.id} className={indented ? "border-s border-ground-border ps-4" : ""}>
        <div className="flex flex-wrap items-center gap-3 border-b border-ground-border py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[12px] text-ground">
              {link.label ?? describe(link).split(" · ")[1]}
            </p>
            <p className="text-[10px] tracking-wide text-ground-subtle">
              {describe(link)}
              {link.isEnabled ? "" : " · hidden"}
              {link.showInNav ? "" : " · not in menu"}
              {link.showInFooter ? "" : " · not in footer"}
            </p>
          </div>

          <div className="flex items-center gap-1">
            <IconButton
              label="Move up"
              disabled={isPending || index === 0}
              onClick={() => run(() => moveNavLink({ id: link.id, direction: "up" }))}
            >
              <ChevronUp size={13} strokeWidth={1.25} />
            </IconButton>
            <IconButton
              label="Move down"
              disabled={isPending || index === total - 1}
              onClick={() => run(() => moveNavLink({ id: link.id, direction: "down" }))}
            >
              <ChevronDown size={13} strokeWidth={1.25} />
            </IconButton>

            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                setOpenRow(openRow === link.id ? null : link.id);
                setDraft(openRow === link.id ? null : draftFrom(link));
              }}
              className="px-2 font-heading text-[9px] uppercase tracking-[0.2em] text-ground-accent transition-colors duration-300 hover:text-ground disabled:opacity-30"
            >
              Edit
            </button>

            <IconButton
              label="Remove entry"
              disabled={isPending}
              onClick={() => run(() => deleteNavLink(link.id))}
            >
              <X size={13} strokeWidth={1.25} />
            </IconButton>
          </div>
        </div>

        {renderForm(link.id, total)}

        {/*
          What this entry prints without being told to.
          
          A category disclosure lists the collections assigned to it, so the
          absence of rows for them here is the feature rather than an omission.
          Adding a row for one is still allowed — it wins, and is how an entry
          gets its own wording or a description.
        */}
        {automatic.length > 0 ? (
          <p className="pb-3 text-[10px] leading-relaxed text-ground-subtle">
            Prints automatically beneath this heading:{" "}
            {automatic.map((collection) => collection.name).join(", ")}
          </p>
        ) : null}

        {kids.length > 0 || link.targetType === "GROUP" ? (
          <ul className="mt-2 space-y-1 ps-4">
            {kids.map((child, childIndex) =>
              renderRow(child, childIndex, kids.length, true),
            )}
            <li>
              <AddButton
                disabled={isPending}
                onClick={() => {
                  const key = `new:${link.column_key}:${link.id}`;
                  setOpenRow(openRow === key ? null : key);
                  setDraft(
                    openRow === key
                      ? null
                      : emptyDraft(link.column_key, link.id, kids.length),
                  );
                }}
              >
                Add inside “{link.label ?? describe(link).split(" · ")[1]}”
              </AddButton>
              {renderForm(`new:${link.column_key}:${link.id}`, kids.length)}
            </li>
          </ul>
        ) : null}
      </li>
    );
  }

  return (
    <div className="max-w-3xl space-y-12">
      {message ? <AdminNotice tone="error">{message}</AdminNotice> : null}

      {COLUMNS.map((column) => {
        const rows = topLevel(column.value);
        const key = `new:${column.value}:`;

        return (
          <section key={column.value}>
            <h2 className="font-heading text-[10px] uppercase tracking-[0.25em] text-ground-subtle">
              {column.title}
            </h2>
            <p className="mt-2 mb-4 text-[11px] leading-relaxed text-ground-muted">
              {column.hint}
            </p>

            <ul className="space-y-1">
              {rows.map((link, index) =>
                renderRow(link, index, rows.length, false),
              )}
            </ul>

            <div className="mt-4">
              <AddButton
                disabled={isPending}
                onClick={() => {
                  setOpenRow(openRow === key ? null : key);
                  setDraft(
                    openRow === key
                      ? null
                      : emptyDraft(column.value, null, rows.length),
                  );
                }}
              >
                Add to {column.title}
              </AddButton>
              {renderForm(key, rows.length)}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center text-ground-muted transition-colors duration-300 hover:text-ground-accent disabled:pointer-events-none disabled:opacity-25"
    >
      {children}
    </button>
  );
}

function AddButton({
  disabled,
  onClick,
  children,
}: {
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center gap-2 border border-ground-border px-4 py-2 font-heading text-[9px] uppercase tracking-[0.2em] text-ground-muted transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-gold/40 hover:text-ground-accent disabled:pointer-events-none disabled:opacity-30"
    >
      <Plus size={12} strokeWidth={1.25} />
      {children}
    </button>
  );
}
