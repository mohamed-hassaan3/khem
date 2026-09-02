import { AdminPageHeader } from "@/src/components/admin/AdminTable";
import ContactChannelsEditor from "@/src/components/admin/ContactChannelsEditor";
import HouseSettingsForm from "@/src/components/admin/HouseSettingsForm";
import SocialProfilesEditor from "@/src/components/admin/SocialProfilesEditor";
import { isLocale } from "@/src/lib/i18n/config";
import {
  getAdminSettings,
  listAdminContactChannels,
  listAdminSocialProfiles,
} from "@/src/services/admin/settings";

/**
 * House settings.
 *
 * Three groups on one screen because they are one job — "what the house says
 * about itself" — and because each is small enough that separate routes would
 * be navigation for its own sake.
 *
 * ## No secret is on this page
 *
 * `supabase/AGENTS.md` §17 requires it, and it is worth saying plainly rather
 * than leaving as an absence: the Stripe keys, the Clerk secret, the Resend key,
 * the Supabase secret key and the connection string live in environment
 * variables. Nothing here reads one, and no action behind it could return one.
 *
 * ## Enquiry subjects are not editable
 *
 * They look like they belong beside the contact channels. They are excluded
 * because the contact form validates its subject against `ENQUIRY_SUBJECTS` in
 * `src/constants/contact.ts` — that value reaches a mail header, so it is
 * checked against something that cannot change without a deploy — and
 * `npm run db:seed`/`db:verify` keep the table and the constant in step. A
 * dashboard that added a subject would break that check the moment somebody
 * used it. See the header of `src/schemas/settings.ts`.
 */
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  void isLocale(locale);

  /*
   * No product list here any more.
   *
   * The featured fragrance moved to Content → Landing Page → New Arrival, which
   * is where the band it controls is configured. The column it writes is
   * unchanged; only its editor moved, so there is still exactly one of it.
   */
  const [settings, channels, profiles] = await Promise.all([
    getAdminSettings(),
    listAdminContactChannels(),
    listAdminSocialProfiles(),
  ]);

  return (
    <>
      <AdminPageHeader
        title="Settings"
        description="What the house says about itself. API keys and secrets are not here and never will be — they live in environment variables."
      />

      <section className="space-y-5">
        <div>
          <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
            The house
          </h2>
          <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-ground-muted">
            The house address receives the contact form and every Inner Circle
            signup. A typo there is a swallowed enquiry, so it is checked as a
            real address before it is saved.
          </p>
        </div>

        <HouseSettingsForm settings={settings} />
      </section>

      <section className="mt-12 space-y-5">
        <div>
          <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
            Contact channels
          </h2>
          <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-ground-muted">
            The panel beside the enquiry form on /contact. Line breaks in a
            value are preserved; leave the link target empty for anything that
            is not a telephone number or an address to write to.
          </p>
        </div>

        <ContactChannelsEditor channels={channels} />
      </section>

      <section className="mt-12 space-y-5">
        <div>
          <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
            Social profiles
          </h2>
          <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-ground-muted">
            Shown on /contact and in the signature of every branded email the
            house sends — a dead link here is a dead link in somebody&rsquo;s
            inbox.
          </p>
        </div>

        <SocialProfilesEditor profiles={profiles} />
      </section>
    </>
  );
}
