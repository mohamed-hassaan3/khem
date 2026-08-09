import type { Metadata } from "next";

import LegalDocumentBody from "@/src/components/legal/LegalDocumentBody";
import LegalHero from "@/src/components/legal/LegalHero";
import { getLegalDocument } from "@/src/services/legal";

/** ISR, 24 hours — legal copy changes far less often than editorial content. */
export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "What KHEM collects, why we collect it, and the control you keep over it — including who we share data with and how long we keep it.",
  alternates: { canonical: "/privacy-policy" },
  // Indexable, but a policy page should not pass link equity onward.
  robots: { index: true, follow: false },
  openGraph: {
    title: "Privacy Policy | KHEM",
    description:
      "How KHEM Fragrance House handles your personal information, and the rights you hold over it.",
  },
};

export default async function PrivacyPolicy() {
  const doc = await getLegalDocument("privacy-policy");

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
