import type { Metadata } from "next";

import LegalDocumentBody from "@/src/components/legal/LegalDocumentBody";
import LegalHero from "@/src/components/legal/LegalHero";
import { isLocale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { localeMetadata } from "@/src/lib/i18n/metadata";
import { getLegalDocument } from "@/src/services/legal";

/** ISR, 24 hours — legal copy changes far less often than editorial content. */
export const revalidate = 86400;

const PATH = "/terms-conditions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const dict = await getDictionary(locale);
  const copy = dict.legal.termsConditions;

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

export default async function TermsConditions({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const [{ locale }, doc] = await Promise.all([
    params,
    getLegalDocument("terms-conditions"),
  ]);

  return (
    <div className="min-h-screen bg-background text-ivory">
      {/*
        The legal documents in `src/data/legal.ts` are English-only for now.
        Marking the subtree `ltr`/`en` keeps punctuation, numbering, and list
        markers correct when it renders inside the Arabic (RTL) page, and lets
        screen readers switch voice for it.
      */}
      <div {...(locale === "ar" ? { dir: "ltr" as const, lang: "en" } : {})}>
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
