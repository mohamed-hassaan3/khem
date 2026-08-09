import type { Metadata } from "next";

import Reveal from "@/src/components/animation/Reveal";
import ContactForm from "@/src/components/contact/ContactForm";
import {
  getConciergeEmail,
  getContactChannels,
  getEnquirySubjects,
  getSocialProfiles,
} from "@/src/services/contact";

/** ISR, 1 hour — editorial copy, aligned with the other content routes. */
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contact KHEM for fragrance enquiries, order support, bespoke commissions, or to arrange a private consultation at our Cairo boutique.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact KHEM",
    description:
      "Reach the KHEM team in Cairo — enquiries, order support, press, wholesale, and private fragrance consultations.",
  },
};

/** Stagger step between siblings, in seconds. */
const STAGGER_STEP = 0.1;

export default async function Contact() {
  const [channels, socialProfiles, subjects, conciergeEmail] =
    await Promise.all([
      getContactChannels(),
      getSocialProfiles(),
      getEnquirySubjects(),
      getConciergeEmail(),
    ]);

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
            <p className="eyebrow mb-5">We Are Here</p>
            <h1 className="mb-7 font-heading text-4xl font-normal leading-tight text-ivory sm:text-5xl md:text-6xl lg:text-7xl">
              Contact
              <br />
              <span className="text-gold">KHEM</span>
            </h1>
            <div className="gold-line mb-7" />
            <p className="text-sm leading-loose text-ivory/45">
              Our team is available to answer questions about our fragrances,
              assist with orders, arrange private consultations at our Cairo
              boutique, or discuss bespoke commissions.
            </p>
          </Reveal>

          <Reveal delay={STAGGER_STEP * 2}>
            <dl className="flex flex-col gap-8">
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
            <p className="eyebrow mb-6">Send a Message</p>
            <h2 className="mb-12 font-heading text-2xl font-normal leading-snug text-ivory sm:text-3xl md:text-4xl">
              How can we
              <br />
              assist you?
            </h2>

            <ContactForm subjects={subjects} />
          </Reveal>

          <div className="flex flex-col gap-0.5">
            <Reveal className="border border-border bg-surface p-10 md:p-12">
              <p className="eyebrow mb-6">Private Consultation</p>
              <h3 className="mb-5 font-heading text-xl font-normal leading-snug text-ivory">
                Experience KHEM in Person
              </h3>
              <p className="mb-7 text-[13px] leading-loose text-ivory/45">
                Arrange a private fragrance consultation at our Cairo boutique.
                Our perfumers will guide you through the complete KHEM library
                and help you discover your signature scent.
              </p>
              <a
                href={`mailto:${conciergeEmail}`}
                className="btn-luxury inline-flex"
              >
                Request Appointment
              </a>
            </Reveal>

            <Reveal
              delay={STAGGER_STEP}
              className="border border-border bg-surface p-10 md:px-12 md:py-10"
            >
              <p className="eyebrow mb-6">Follow KHEM</p>
              <ul className="flex flex-col">
                {socialProfiles.map((profile) => (
                  <li key={profile.id}>
                    <a
                      href={profile.url}
                      aria-label={`KHEM on ${profile.platform}`}
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
