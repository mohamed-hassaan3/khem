import type { Metadata } from "next";

import LegalDocumentBody from "@/src/components/legal/LegalDocumentBody";
import LegalHero from "@/src/components/legal/LegalHero";
import { getLegalDocument } from "@/src/services/legal";

/** ISR, 24 hours — legal copy changes far less often than editorial content. */
export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Returns & Exchanges",
  description:
    "How to cancel, return, or exchange a KHEM order, and what to do if a parcel arrives damaged or incorrect.",
  alternates: { canonical: "/return-exchange" },
  // Indexable, but a policy page should not pass link equity onward.
  robots: { index: true, follow: false },
  openGraph: {
    title: "Returns & Exchanges | KHEM",
    description:
      "Cancellations, returns, exchanges, refunds, and damaged orders — the full KHEM customer care procedure.",
  },
};

export default async function ReturnExchange() {
  const doc = await getLegalDocument("return-exchange");

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
