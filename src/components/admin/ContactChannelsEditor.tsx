"use client";

/**
 * The rows behind the contact panel on `/contact`.
 *
 * One card per channel, each saving on its own. A single form over every
 * channel would mean one validation error blocking four unrelated edits, and
 * would make "remove this one" a strange thing to express.
 *
 * ## Both languages, side by side
 *
 * `label` and `value` have Arabic twins; `href` does not, because it is a
 * `mailto:`/`tel:` target rather than display text. Same reasoning as
 * `StockistForm`: the empty Arabic field is the thing an editor came to fill
 * in, so it sits beside the English rather than behind a tab.
 *
 * ## `value` is a textarea
 *
 * The address and the opening hours are multi-line and are rendered with
 * `whitespace-pre-line` on the public page. A single-line input would silently
 * make those newlines unenterable.
 */

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus } from "lucide-react";

import {
  createContactChannel,
  deleteContactChannel,
  updateContactChannel,
} from "@/src/actions/admin/settings";
import {
  AdminButton,
  AdminInput,
  AdminNotice,
  AdminTextarea,
} from "@/src/components/admin/fields";
import type { AdminActionResult } from "@/src/schemas/admin";
import type { AdminContactChannel } from "@/src/schemas/db/directory";

/** Id suggestion while creating, from the label. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

const BLANK: AdminContactChannel = {
  id: "",
  label: "",
  label_ar: null,
  value: "",
  value_ar: null,
  href: null,
  sortOrder: 0,
};

function ChannelCard({
  channel,
  isNew,
  onDone,
}: {
  channel: AdminContactChannel;
  isNew: boolean;
  onDone: () => void;
}) {
  const router = useRouter();

  const [id, setId] = useState(channel.id);
  const [idTouched, setIdTouched] = useState(!isNew);
  const [label, setLabel] = useState(channel.label);
  const [labelAr, setLabelAr] = useState(channel.label_ar ?? "");
  const [value, setValue] = useState(channel.value);
  const [valueAr, setValueAr] = useState(channel.value_ar ?? "");
  const [href, setHref] = useState(channel.href ?? "");
  const [sortOrder, setSortOrder] = useState(String(channel.sortOrder));

  const [result, setResult] = useState<AdminActionResult | null>(null);
  const [armed, setArmed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const fieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {};

  function save() {
    setResult(null);

    startTransition(async () => {
      const payload = {
        id,
        label,
        label_ar: labelAr,
        value,
        value_ar: valueAr,
        href,
        sortOrder,
      };

      const outcome = isNew
        ? await createContactChannel(payload)
        : await updateContactChannel(payload);

      setResult(outcome);

      if (outcome.ok) {
        router.refresh();
        if (isNew) onDone();
      }
    });
  }

  function remove() {
    startTransition(async () => {
      const outcome = await deleteContactChannel({ id });

      if (outcome.ok) {
        router.refresh();
        return;
      }

      setArmed(false);
      setResult(outcome);
    });
  }

  return (
    <div className="border border-border p-5 sm:p-6">
      <div className="space-y-4 md:space-y-6">
        {result ? (
          <AdminNotice tone={result.ok ? "success" : "error"}>
            {result.message}
          </AdminNotice>
        ) : null}

        <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
          <AdminInput
            id={`label-${id || "new"}`}
            label="Label"
            value={label}
            onChange={(next) => {
              setLabel(next);
              if (!idTouched) setId(slugify(next));
            }}
            error={fieldErrors.label}
            hint="Shown in gold beside the value."
          />
          <AdminInput
            id={`label_ar-${id || "new"}`}
            label="Label — Arabic"
            value={labelAr}
            onChange={setLabelAr}
            error={fieldErrors.label_ar}
          />

          <AdminTextarea
            id={`value-${id || "new"}`}
            label="Value"
            value={value}
            onChange={setValue}
            error={fieldErrors.value}
            hint="Line breaks are preserved on the public page."
          />
          <AdminTextarea
            id={`value_ar-${id || "new"}`}
            label="Value — Arabic"
            value={valueAr}
            onChange={setValueAr}
            error={fieldErrors.value_ar}
          />

          <AdminInput
            id={`href-${id || "new"}`}
            label="Link target"
            value={href}
            onChange={setHref}
            error={fieldErrors.href}
            hint="mailto: or tel:. Leave empty for an address."
          />
          <AdminInput
            id={`sortOrder-${id || "new"}`}
            label="Sort order"
            value={sortOrder}
            onChange={setSortOrder}
            error={fieldErrors.sortOrder}
          />

          {isNew ? (
            <AdminInput
              id="channel-id"
              label="Id"
              value={id}
              onChange={(next) => {
                setIdTouched(true);
                setId(next);
              }}
              error={fieldErrors.id}
              hint="Permanent once saved."
            />
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <AdminButton disabled={isPending} onClick={save}>
            {isPending ? "Saving" : isNew ? "Add channel" : "Save"}
          </AdminButton>

          {isNew ? (
            <AdminButton variant="ghost" disabled={isPending} onClick={onDone}>
              Cancel
            </AdminButton>
          ) : (
            <AdminButton
              variant={armed ? "danger" : "ghost"}
              disabled={isPending}
              onClick={() => (armed ? remove() : setArmed(true))}
            >
              {armed ? "Confirm — remove" : "Remove"}
            </AdminButton>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ContactChannelsEditor({
  channels,
}: {
  channels: readonly AdminContactChannel[];
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-5">
      {channels.length === 0 && !adding ? (
        <p className="border border-border px-5 py-10 text-center text-[12px] leading-relaxed text-ivory/35">
          No contact channels. The contact page renders its panel empty until
          one is added.
        </p>
      ) : null}

      {channels.map((channel) => (
        <ChannelCard
          key={channel.id}
          channel={channel}
          isNew={false}
          onDone={() => undefined}
        />
      ))}

      {adding ? (
        <ChannelCard channel={BLANK} isNew onDone={() => setAdding(false)} />
      ) : (
        <AdminButton variant="ghost" onClick={() => setAdding(true)}>
          <Plus size={13} strokeWidth={1.25} />
          Add a channel
        </AdminButton>
      )}
    </div>
  );
}
