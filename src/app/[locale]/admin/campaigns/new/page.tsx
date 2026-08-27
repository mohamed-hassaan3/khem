import CampaignForm from "@/src/components/admin/CampaignForm";
import { AdminPageHeader } from "@/src/components/admin/AdminTable";
import { isLocale } from "@/src/lib/i18n/config";
import { audienceCount } from "@/src/services/admin/campaigns";

/**
 * Composing a new campaign.
 *
 * Both audience counts are read here rather than in the form, because the form
 * is a Client Component and the count is a secret-key query. Both, not one: the
 * language selector changes which figure applies, and a number that arrived only
 * after switching would be a number the desk did not have when it chose.
 */
export const dynamic = "force-dynamic";

export default async function NewCampaignPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const [{ locale }, en, ar] = await Promise.all([
    params,
    audienceCount("en"),
    audienceCount("ar"),
  ]);

  const activeLocale = isLocale(locale) ? locale : "en";

  return (
    <>
      <AdminPageHeader
        title="New campaign"
        description="Write the letter, then send yourself a test before it goes anywhere near the list."
      />

      <CampaignForm
        campaign={null}
        locale={activeLocale}
        audienceEn={en}
        audienceAr={ar}
      />
    </>
  );
}
