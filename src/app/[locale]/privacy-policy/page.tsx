import type { Metadata } from "next";

import NavGround from "@/src/components/NavGround";
import LegalDocumentBody from "@/src/components/legal/LegalDocumentBody";
import LegalHero from "@/src/components/legal/LegalHero";
import { isLocale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { localeMetadata } from "@/src/lib/i18n/metadata";
import { getLegalDocument } from "@/src/services/legal";

/** ISR, 7 days — legal copy changes far less often than editorial content. */
export const revalidate = 604800;

const PATH = "/privacy-policy";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const dict = await getDictionary(locale);
  const copy = dict.legal.privacyPolicy;

  return {
    ...localeMetadata({
      locale: isLocale(locale) ? locale : "en",
      path: PATH,
      title: copy.title,
      description: copy.description,
      ogTitle: copy.ogTitle,
      ogDescription: copy.ogDescription,
    }),
    // Indexable, but a policy page should not pass link equity onward.
    robots: { index: true, follow: false },
  };
}

export default async function PrivacyPolicy({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  // The layout has already rejected any segment that is not a real locale.
  const { locale } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  // The document is fetched *after* the locale, not beside it: which
  // language's sections come back now depends on it.
  const doc = await getLegalDocument(activeLocale, "privacy-policy");

  return (
    <div className="ground-ivory min-h-screen">
      {/* Long-form legal copy is read, not admired. Ivory (§20's reasoning). */}
      <NavGround ground="ivory" />
      <div dir="auto">
        <LegalHero
          eyebrow={doc.eyebrow}
          title={doc.title}
          lede={doc.lede}
          updatedAt={doc.updatedAt}
          banner={doc.banner}
        />
        <LegalDocumentBody
          sections={doc.sections}
          contactEmail={doc.contactEmail}
        />
      </div>
    </div>
  );
}
