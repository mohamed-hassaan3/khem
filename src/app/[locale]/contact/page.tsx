import type { Metadata } from "next";

import Reveal from "@/src/components/animation/Reveal";
import ContactForm from "@/src/components/contact/ContactForm";
import { isLocale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { localeMetadata } from "@/src/lib/i18n/metadata";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { ltrIsland } from "@/src/lib/i18n/rtl";
import {
  getConciergeEmail,
  getContactChannels,
  getEnquirySubjects,
  getSocialProfiles,
} from "@/src/services/contact";

/** ISR, 1 hour — editorial copy, aligned with the other content routes. */
export const revalidate = 3600;

const PATH = "/contact";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const dict = await getDictionary(locale);

  return localeMetadata({
    locale: isLocale(locale) ? locale : "en",
    path: PATH,
    title: dict.contact.meta.title,
    description: dict.contact.meta.description,
    ogTitle: dict.contact.meta.ogTitle,
    ogDescription: dict.contact.meta.ogDescription,
  });
}

/** Stagger step between siblings, in seconds. */
const STAGGER_STEP = 0.1;

export default async function Contact({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const [{ locale }, channels, socialProfiles, subjects, conciergeEmail] =
    await Promise.all([
      params,
      getContactChannels(),
      getSocialProfiles(),
      getEnquirySubjects(),
      getConciergeEmail(),
    ]);

  const activeLocale = isLocale(locale) ? locale : "en";
  const dict = await getDictionary(activeLocale);
  const island = ltrIsland(activeLocale);

  return (
    <div className="min-h-screen bg-background text-ivory">
      {/* ── HEADER ─────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border px-6 py-24 md:px-20 md:py-30">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_70%_50%,_color-mix(in_srgb,var(--color-gold)_4%,transparent)_0%,_transparent_60%)]"
          aria-hidden="true"
        />

        <div className="relative mx-auto grid max-w-350 grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <Reveal>
            <p className="eyebrow mb-5">{dict.contact.hero.eyebrow}</p>
            <h1 className="mb-7 font-heading text-4xl font-normal leading-tight text-ivory sm:text-5xl md:text-6xl lg:text-7xl">
              {dict.contact.hero.headingLine1}
              <br />
              <span className="text-gold">
                {dict.contact.hero.headingLine2}
              </span>
            </h1>
            <div className="gold-line mb-7" />
            <p className="text-sm leading-loose text-ivory/45">
              {dict.contact.hero.lede}
            </p>
          </Reveal>

          <Reveal delay={STAGGER_STEP * 2}>
            {/* Channel labels and values come from `src/data` — English only. */}
            <dl className="flex flex-col gap-8" {...island}>
              {channels.map((channel) => (
                <div
                  key={channel.id}
                  className="flex flex-col gap-2 border-b border-border pb-8 sm:flex-row sm:gap-7"
                >
                  <dt className="flex-none pt-0.5 font-heading text-[10px] uppercase tracking-[0.2em] text-gold/50 sm:w-25">
                    {channel.label}
                  </dt>
                  <dd className="text-sm leading-relaxed text-ivory/70">
                    {channel.href ? (
                      <a
                        href={channel.href}
                        className="no-underline transition-colors duration-300 hover:text-gold"
                      >
                        {channel.value}
                      </a>
                    ) : (
                      <span className="whitespace-pre-line">
                        {channel.value}
                      </span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
      </section>

      {/* ── FORM + ASIDE ────────────────────────────── */}
      <section className="px-6 py-24 md:px-20 md:py-30">
        <div className="mx-auto grid max-w-350 grid-cols-1 gap-12 lg:grid-cols-[1fr_500px] lg:gap-25">
          <Reveal>
            <p className="eyebrow mb-6">{dict.contact.form.eyebrow}</p>
            <h2 className="mb-12 font-heading text-2xl font-normal leading-snug text-ivory sm:text-3xl md:text-4xl">
              {dict.contact.form.headingLine1}
              <br />
              {dict.contact.form.headingLine2}
            </h2>

            <ContactForm subjects={subjects} />
          </Reveal>

          <div className="flex flex-col gap-0.5">
            <Reveal className="border border-border bg-surface p-10 md:p-12">
              <p className="eyebrow mb-6">
                {dict.contact.consultation.eyebrow}
              </p>
              <h3 className="mb-5 font-heading text-xl font-normal leading-snug text-ivory">
                {dict.contact.consultation.heading}
              </h3>
              <p className="mb-7 text-[13px] leading-loose text-ivory/45">
                {dict.contact.consultation.body}
              </p>
              <a
                href={`mailto:${conciergeEmail}`}
                className="btn-luxury inline-flex"
              >
                {dict.contact.consultation.cta}
              </a>
            </Reveal>

            <Reveal
              delay={STAGGER_STEP}
              className="border border-border bg-surface p-10 md:px-12 md:py-10"
            >
              <p className="eyebrow mb-6">{dict.contact.social.eyebrow}</p>
              <ul className="flex flex-col">
                {socialProfiles.map((profile) => (
                  <li key={profile.id}>
                    <a
                      href={profile.url}
                      aria-label={interpolate(
                        dict.contact.social.profileLabel,
                        { platform: profile.platform },
                      )}
                      className="flex items-center justify-between gap-4 border-b border-border py-3.5 no-underline transition-colors duration-300 hover:text-gold"
                    >
                      <span className="font-heading text-xs tracking-wider text-ivory">
                        {profile.platform}
                      </span>
                      <span className="text-[11px] tracking-wide text-gold/60">
                        {profile.handle}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>
    </div>
  );
}
