"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { setScentProfileOrder, updateScentProfile } from "@/src/actions/admin/catalog";
import { AdminButton, AdminInput, AdminNotice, AdminTextarea } from "@/src/components/admin/fields";
import { localizePath, type Locale } from "@/src/lib/i18n/config";
import type { AdminScentProfile, AdminScentProfileMember } from "@/src/services/admin/catalog";
import type { AdminActionResult } from "@/src/schemas/admin";

export default function ScentProfileEditor({
  profile,
  members,
  locale,
}: {
  profile: AdminScentProfile;
  members: readonly AdminScentProfileMember[];
  locale: Locale;
}) {
  const [name, setName] = useState(profile.name);
  const [nameAr, setNameAr] = useState(profile.name_ar ?? "");
  const [description, setDescription] = useState(profile.description);
  const [descriptionAr, setDescriptionAr] = useState(profile.description_ar ?? "");
  const [bannerUrl, setBannerUrl] = useState(profile.bannerUrl);
  const [bannerAlt, setBannerAlt] = useState(profile.bannerAlt);
  const [bannerAltAr, setBannerAltAr] = useState(profile.bannerAlt_ar ?? "");
  const [ordered, setOrdered] = useState([...members]);
  const [result, setResult] = useState<AdminActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const fieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {};

  function saveCopy() {
    startTransition(async () => {
      const outcome = await updateScentProfile({ slug: profile.slug, name, name_ar: nameAr, description, description_ar: descriptionAr, bannerUrl, bannerAlt, bannerAlt_ar: bannerAltAr });
      setResult(outcome);
    });
  }

  function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= ordered.length) return;
    setOrdered((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function saveOrder() {
    startTransition(async () => {
      const outcome = await setScentProfileOrder({ profileSlug: profile.slug, productSlugs: ordered.map((member) => member.slug) });
      setResult(outcome);
    });
  }

  return (
    <div className="max-w-3xl space-y-10">
      {result ? <AdminNotice tone={result.ok ? "success" : "error"}>{result.message}</AdminNotice> : null}
      <section className="space-y-5">
        <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-accent">Profile copy</h2>
        <AdminInput id="name" label="Name" value={name} onChange={setName} error={fieldErrors.name} />
        <AdminInput id="name_ar" label="Name — Arabic" value={nameAr} onChange={setNameAr} error={fieldErrors.name_ar} />
        <AdminTextarea id="description" label="Description" rows={5} value={description} onChange={setDescription} error={fieldErrors.description} />
        <AdminTextarea id="description_ar" label="Description — Arabic" rows={5} value={descriptionAr} onChange={setDescriptionAr} error={fieldErrors.description_ar} />
        <AdminInput id="bannerUrl" label="Banner URL" type="url" value={bannerUrl} onChange={setBannerUrl} error={fieldErrors.bannerUrl} hint="Use an approved HTTPS image host." />
        <AdminInput id="bannerAlt" label="Banner alt text" value={bannerAlt} onChange={setBannerAlt} error={fieldErrors.bannerAlt} />
        <AdminInput id="bannerAlt_ar" label="Banner alt text — Arabic" value={bannerAltAr} onChange={setBannerAltAr} error={fieldErrors.bannerAlt_ar} />
        <AdminButton type="button" disabled={pending} onClick={saveCopy}>{pending ? "Saving…" : "Save profile"}</AdminButton>
      </section>

      <section className="space-y-4 border-t border-ground-border pt-8">
        <div>
          <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-accent">Assigned products ({ordered.length})</h2>
          <p className="mt-2 text-[11px] text-ground-muted">Use the arrows to change storefront order. Membership is managed on each product.</p>
        </div>
        <ol className="divide-y divide-ground-border border-y border-ground-border">
          {ordered.map((member, index) => (
            <li key={member.slug} className="flex items-center gap-3 py-3">
              <span className="min-w-0 flex-1 text-sm text-ground">{member.name}</span>
              <Link href={localizePath(locale, `/admin/products/${member.slug}`)} className="font-heading text-[9px] uppercase tracking-[0.16em] text-ground-accent">Edit product</Link>
              <button type="button" aria-label={`Move ${member.name} up`} disabled={pending || index === 0} onClick={() => move(index, -1)} className="border border-ground-border px-2 py-1 text-ground-muted disabled:opacity-30">↑</button>
              <button type="button" aria-label={`Move ${member.name} down`} disabled={pending || index === ordered.length - 1} onClick={() => move(index, 1)} className="border border-ground-border px-2 py-1 text-ground-muted disabled:opacity-30">↓</button>
            </li>
          ))}
        </ol>
        {ordered.length > 0 ? <AdminButton type="button" disabled={pending} onClick={saveOrder}>{pending ? "Saving…" : "Save product order"}</AdminButton> : null}
      </section>
    </div>
  );
}
