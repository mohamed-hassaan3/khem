import Link from "next/link";
import { Plus } from "lucide-react";

import {
  AdminCell,
  AdminEmpty,
  AdminLinkButton,
  AdminPageHeader,
  AdminRow,
  AdminTable,
} from "@/src/components/admin/AdminTable";
import MarketingSettingsForm from "@/src/components/admin/MarketingSettingsForm";
import { egp } from "@/src/lib/admin/money";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import {
  getAdminMarketingSettings,
  listAdminAnnouncements,
} from "@/src/services/admin/marketing";
import { getWelcomeOffer } from "@/src/services/marketing";

/**
 * The announcement bar and the offer popup — the two pieces of house chrome.
 *
 * They share a screen because they share a settings row and because they are the
 * same job: what the house says to somebody who has not bought anything yet.
 * Promotional pricing is a different job and has its own screen.
 *
 * The state column reads the schedule rather than the switch alone: an
 * announcement can be on and still not showing because its window has not opened
 * or has closed, and an editor who cannot see that will conclude the bar is
 * broken.
 */
export const dynamic = "force-dynamic";

function stamp(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

function state(announcement: {
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
}): { label: string; tone: "live" | "muted" | "warning" } {
  if (!announcement.isActive) return { label: "Hidden", tone: "muted" };
  if (announcement.startsAt && new Date(announcement.startsAt) > new Date()) {
    return { label: "Scheduled", tone: "warning" };
  }
  if (announcement.endsAt && new Date(announcement.endsAt) <= new Date()) {
    return { label: "Ended", tone: "muted" };
  }
  return { label: "Showing", tone: "live" };
}

export default async function AdminAnnouncementsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  const [announcements, settings, offer] = await Promise.all([
    listAdminAnnouncements(),
    getAdminMarketingSettings(),
    getWelcomeOffer(),
  ]);

  const basePath = localizePath(activeLocale, "/admin/announcements");

  /*
   * Stated on the toggle so the desk can see what the popup is currently
   * promising without opening the discount editor. Read from the live welcome
   * offer — never a number kept on this screen.
   */
  const offerSummary =
    offer === null
      ? "No welcome offer is running, so the popup invites people to the list and promises nothing."
      : offer.kind === "PERCENTAGE"
        ? `It currently promises ${offer.value}% off a first order.`
        : `It currently promises ${egp(offer.value)} off a first order.`;

  return (
    <>
      <AdminPageHeader
        title="Announcements"
        description="The line above the header, and the offer popup. Both are house chrome — neither can change what anybody is charged."
        action={
          <AdminLinkButton href={`${basePath}/new`}>
            <Plus size={13} strokeWidth={1.25} />
            New announcement
          </AdminLinkButton>
        }
      />

      {announcements.length === 0 ? (
        <AdminEmpty
          message="No announcements yet. The bar stays hidden until one is live."
          action={
            <AdminLinkButton href={`${basePath}/new`}>
              Write the first one
            </AdminLinkButton>
          }
        />
      ) : (
        <AdminTable
          headers={[
            "Message",
            "Link",
            "Order",
            "Window",
            "State",
            { label: "Edit", hidden: true },
          ]}
        >
          {announcements.map((announcement) => {
            const shown = state(announcement);

            return (
              <AdminRow key={announcement.id}>
                <AdminCell>
                  <span className="block max-w-md truncate">
                    {announcement.message}
                  </span>
                  {announcement.messageAr ? (
                    <span
                      dir="rtl"
                      className="mt-1 block max-w-md truncate text-[11px] text-ivory/30"
                    >
                      {announcement.messageAr}
                    </span>
                  ) : (
                    <span
                      title="The Arabic site will print the English line"
                      className="mt-1 inline-block border border-warning/40 px-2 py-0.5 font-heading text-[9px] uppercase tracking-[0.2em] text-warning"
                    >
                      No Arabic
                    </span>
                  )}
                </AdminCell>

                <AdminCell muted>{announcement.href ?? "—"}</AdminCell>
                <AdminCell muted>{announcement.sortOrder}</AdminCell>

                <AdminCell muted>
                  {announcement.startsAt || announcement.endsAt
                    ? `${stamp(announcement.startsAt)} → ${stamp(announcement.endsAt)}`
                    : "Always"}
                </AdminCell>

                <AdminCell>
                  <span
                    className={`inline-block border px-3 py-1 font-heading text-[9px] uppercase tracking-[0.2em] ${
                      shown.tone === "live"
                        ? "border-success/40 text-success"
                        : shown.tone === "warning"
                          ? "border-warning/40 text-warning"
                          : "border-border text-ivory/30"
                    }`}
                  >
                    {shown.label}
                  </span>
                </AdminCell>

                <AdminCell>
                  <Link
                    href={`${basePath}/${announcement.id}`}
                    className="font-heading text-[10px] uppercase tracking-[0.2em] text-gold/70 transition-colors duration-300 hover:text-gold"
                  >
                    Edit
                  </Link>
                </AdminCell>
              </AdminRow>
            );
          })}
        </AdminTable>
      )}

      <section className="mt-14">
        <h2 className="mb-6 font-heading text-sm uppercase tracking-[0.2em] text-ivory/60">
          Behaviour
        </h2>

        {settings === null ? (
          <p className="border border-border px-5 py-10 text-center text-[12px] leading-relaxed text-ivory/35">
            The marketing settings row could not be read. Run{" "}
            <code className="text-gold/70">npm run db:migrate</code> and reload.
          </p>
        ) : (
          <MarketingSettingsForm
            settings={settings}
            locale={activeLocale}
            offerSummary={offerSummary}
          />
        )}
      </section>
    </>
  );
}
