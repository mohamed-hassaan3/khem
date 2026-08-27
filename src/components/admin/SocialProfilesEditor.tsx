"use client";

/**
 * The house's social profiles.
 *
 * Same card-per-row shape as `ContactChannelsEditor`, and for the same reason:
 * one form over every row would let a single validation error block unrelated
 * edits.
 *
 * ## No Arabic twins here
 *
 * A platform name and a handle are proper nouns and a URL is a target — none of
 * the three is display copy that changes language. `supabase/sql/0008` gives
 * `"SocialProfile"` no `_ar` columns for exactly that reason.
 *
 * ## These rows reach further than they look
 *
 * They render on `/contact` **and** in the signature of every branded email the
 * house sends — the welcome letter, the order mail. A dead URL here is a dead
 * link in somebody's inbox, which is why `schemas/settings.ts` requires a real
 * http(s) address rather than accepting an empty one.
 */

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus } from "lucide-react";

import {
  createSocialProfile,
  deleteSocialProfile,
  updateSocialProfile,
} from "@/src/actions/admin/settings";
import {
  AdminButton,
  AdminInput,
  AdminNotice,
} from "@/src/components/admin/fields";
import type { AdminActionResult } from "@/src/schemas/admin";
import type { AdminSocialProfile } from "@/src/schemas/db/directory";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

const BLANK: AdminSocialProfile = {
  id: "",
  platform: "",
  handle: "",
  url: "",
  sortOrder: 0,
};

function ProfileCard({
  profile,
  isNew,
  onDone,
}: {
  profile: AdminSocialProfile;
  isNew: boolean;
  onDone: () => void;
}) {
  const router = useRouter();

  const [id, setId] = useState(profile.id);
  const [idTouched, setIdTouched] = useState(!isNew);
  const [platform, setPlatform] = useState(profile.platform);
  const [handle, setHandle] = useState(profile.handle);
  const [url, setUrl] = useState(profile.url);
  const [sortOrder, setSortOrder] = useState(String(profile.sortOrder));

  const [result, setResult] = useState<AdminActionResult | null>(null);
  const [armed, setArmed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const fieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {};

  function save() {
    setResult(null);

    startTransition(async () => {
      const payload = { id, platform, handle, url, sortOrder };

      const outcome = isNew
        ? await createSocialProfile(payload)
        : await updateSocialProfile(payload);

      setResult(outcome);

      if (outcome.ok) {
        router.refresh();
        if (isNew) onDone();
      }
    });
  }

  function remove() {
    startTransition(async () => {
      const outcome = await deleteSocialProfile({ id });

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
            id={`platform-${id || "new"}`}
            label="Platform"
            value={platform}
            onChange={(next) => {
              setPlatform(next);
              if (!idTouched) setId(slugify(next));
            }}
            error={fieldErrors.platform}
            hint="Instagram, Pinterest…"
          />
          <AdminInput
            id={`handle-${id || "new"}`}
            label="Handle"
            value={handle}
            onChange={setHandle}
            error={fieldErrors.handle}
            hint="@khemperfumes"
          />
          <AdminInput
            id={`url-${id || "new"}`}
            label="URL"
            value={url}
            onChange={setUrl}
            error={fieldErrors.url}
            hint="Also linked from every branded email."
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
              id="profile-id"
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
            {isPending ? "Saving" : isNew ? "Add profile" : "Save"}
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

export default function SocialProfilesEditor({
  profiles,
}: {
  profiles: readonly AdminSocialProfile[];
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-5">
      {profiles.length === 0 && !adding ? (
        <p className="border border-border px-5 py-10 text-center text-[12px] leading-relaxed text-ivory/35">
          No social profiles. Email signatures render without them.
        </p>
      ) : null}

      {profiles.map((profile) => (
        <ProfileCard
          key={profile.id}
          profile={profile}
          isNew={false}
          onDone={() => undefined}
        />
      ))}

      {adding ? (
        <ProfileCard profile={BLANK} isNew onDone={() => setAdding(false)} />
      ) : (
        <AdminButton variant="ghost" onClick={() => setAdding(true)}>
          <Plus size={13} strokeWidth={1.25} />
          Add a profile
        </AdminButton>
      )}
    </div>
  );
}
