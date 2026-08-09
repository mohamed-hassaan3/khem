import type { Metadata } from "next";

import LegalDocumentBody from "@/src/components/legal/LegalDocumentBody";
import LegalHero from "@/src/components/legal/LegalHero";
import { getLegalDocument } from "@/src/services/legal";

/** ISR, 24 hours — legal copy changes far less often than editorial content. */
export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description:
    "The agreement between you and KHEM Fragrance House when you place an order — pricing, delivery, product information, fragrance safety, and governing law.",
  alternates: { canonical: "/terms-conditions" },
  // Indexable, but a policy page should not pass link equity onward.
  robots: { index: true, follow: false },
  openGraph: {
    title: "Terms & Conditions | KHEM",
    description:
      "What we owe you and what we ask in return when you order from KHEM Fragrance House, Cairo.",
  },
};

export default async function TermsConditions() {
  const doc = await getLegalDocument("terms-conditions");

  return (
    <div className="min-h-screen bg-background text-ivory">
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
  );
}
