/**
 * Local seed data for the four legal documents.
 *
 * Same contract as `content.ts` and `contact.ts`: the only place this copy is
 * hardcoded, shaped for a straight insert into Supabase (or a CMS) later.
 *
 * Nothing here is a display string — `updatedAt` is ISO-8601 and is formatted by
 * `formatLegalDate` in `src/lib/format.ts`. Structure is expressed as typed
 * blocks, never as HTML.
 *
 * VOICE: plain, calm, second person. Short sentences. No legalese theatre, no
 * article citations. It should read like the rest of the site while still
 * saying something specific enough to be useful.
 *
 * TODO: the commercial registration number and tax ID are published as visible
 * placeholders until the entity paperwork is final. Replace the two `note`
 * blocks in `who-we-are` and `who-you-are-buying-from` — do not invent values.
 *
 * NOTE: this copy has not been reviewed by counsel. It is honest and specific,
 * but it must be checked by a lawyer before the store transacts.
 */

import type { LegalDocument, LegalDocumentSlug } from "@/src/types/legal";

/**
 * Single source for the entity name, so a change to the registered style is a
 * one-line edit rather than a search across four documents.
 */
const ENTITY = "KHEM Fragrance House";

/** Purpose-specific mailboxes, all on the brand domain used by `layout.tsx`. */
const PRIVACY_EMAIL = "privacy@khemperfumes.com";
const LEGAL_EMAIL = "legal@khemperfumes.com";
const CARE_EMAIL = "care@khemperfumes.com";

/** Every document is republished together, so they share one revision date. */
const LAST_UPDATED = "2026-08-09";

/**
 * Banner query string, matching the hero treatment in `app/about/page.tsx`.
 * Every photo ID below is already in use elsewhere in `src/`, so none can 404.
 */
const BANNER_PARAMS = "https://res.cloudinary.com/co1xzkhf/image/upload/";

export const LEGAL_DOCUMENTS: Record<LegalDocumentSlug, LegalDocument> = {
  // ── PRIVACY POLICY ─────────────────────────────
  "privacy-policy": {
    slug: "privacy-policy",
    eyebrow: "Legal",
    title: "Privacy Policy",
    lede: "What we collect, why we collect it, and the control you keep over it. Written to be read, not to be scrolled past.",
    updatedAt: LAST_UPDATED,
    banner: {
      url: `${BANNER_PARAMS}legal-logo.png`,
      alt: "",
    },
    contactEmail: PRIVACY_EMAIL,
    sections: [
      {
        id: "who-we-are",
        title: "Who We Are",
        blocks: [
          {
            kind: "text",
            text: `${ENTITY} is a fragrance house based in Cairo, Egypt. When you shop with us, browse our collections, or write to us, we are the ones responsible for the personal information you share.`,
          },
          {
            kind: "text",
            text: `Questions about anything on this page can go straight to ${PRIVACY_EMAIL}. A person reads that inbox.`,
          },
          {
            kind: "note",
            text: "Company details: KHEM Fragrance House, Cairo, Egypt. Our commercial registration and tax identification numbers are pending publication and will be listed here once issued.",
          },
        ],
      },
      {
        id: "what-we-collect",
        title: "What We Collect",
        blocks: [
          {
            kind: "text",
            text: "Only what an order or an account actually requires. Nothing is collected speculatively.",
          },
          {
            kind: "list",
            items: [
              "Account details — your name, email address, and password, held by our sign-in provider.",
              "Order and delivery details — the addresses, phone number, and items needed to get a parcel to you.",
              "Payment confirmation — the result of a transaction and the last four digits of a card. We never see or store a full card number; our payment provider handles that end to end.",
              "Messages you send us — the content of your enquiry and the address we reply to.",
              "Anonymous usage data — which pages are read and where visitors leave, aggregated and not tied to your name.",
            ],
          },
        ],
      },
      {
        id: "why-we-use-it",
        title: "Why We Use It",
        blocks: [
          {
            kind: "list",
            items: [
              "To take, fulfil, and deliver your order, and to tell you where it is.",
              "To keep your account secure and let you sign back into it.",
              "To answer your questions and resolve problems with an order.",
              "To meet our obligations under Egyptian tax and commercial law.",
              "To understand, in aggregate, which parts of the site work and which do not.",
              "To send you fragrance news — only if you asked for it, and only until you tell us to stop.",
            ],
          },
        ],
      },
      {
        id: "who-we-share-it-with",
        title: "Who We Share It With",
        blocks: [
          {
            kind: "text",
            text: "We do not sell your data, and we do not trade it with advertisers. It reaches only the service providers that make the shop function, and only the part of it they need:",
          },
          {
            kind: "table",
            table: {
              head: ["Partner", "What they handle"],
              rows: [
                ["Stripe", "Payment processing and card security"],
                ["Clerk", "Account sign-in and session security"],
                ["Supabase", "Database hosting"],
                ["Cloudinary", "Product and editorial imagery"],
                ["Resend", "Order and account emails"],
                ["Vercel", "Website hosting and delivery"],
              ],
            },
          },
          {
            kind: "text",
            text: "Beyond these, we share information only with the courier carrying your parcel, and where the law or a legitimate legal claim requires it.",
          },
        ],
      },
      {
        id: "how-long-we-keep-it",
        title: "How Long We Keep It",
        blocks: [
          {
            kind: "table",
            table: {
              head: ["Information", "Kept for"],
              rows: [
                ["Account details", "As long as your account is open"],
                [
                  "Order and invoice records",
                  "As long as Egyptian tax and commercial law requires",
                ],
                ["Support messages", "24 months from the close of your enquiry"],
                ["Marketing consent", "Until you withdraw it"],
                ["Anonymous usage data", "Aggregated; not linked to you"],
              ],
            },
          },
        ],
      },
      {
        id: "your-rights",
        title: "Your Rights",
        blocks: [
          {
            kind: "text",
            text: "Wherever you live, you can ask us to do any of the following, and we will act on it:",
          },
          {
            kind: "list",
            items: [
              "See the personal information we hold about you.",
              "Correct anything that is wrong or out of date.",
              "Delete your account and the data we are not legally required to keep.",
              "Receive a copy of your data in a portable format.",
              "Object to a particular use of your information.",
              "Withdraw consent to marketing at any time, without giving a reason.",
            ],
          },
          {
            kind: "text",
            text: `One address handles all of them: ${PRIVACY_EMAIL}. We aim to respond within thirty days, and we will never charge you for asking.`,
          },
        ],
      },
      {
        id: "security",
        title: "Security",
        blocks: [
          {
            kind: "text",
            text: "Every page and form on this site is served over an encrypted connection. Payment details go directly to our payment provider and never touch our servers. Access to customer records is limited to the people who need it to do their work.",
          },
          {
            kind: "text",
            text: "No system is perfect. If a breach ever affects your information, we will tell you what happened and what to do about it, promptly and in plain language.",
          },
        ],
      },
      {
        id: "changes-to-this-policy",
        title: "Changes To This Policy",
        blocks: [
          {
            kind: "text",
            text: "As the house grows, this policy will change with it. The revision date at the top of the page always reflects the current version, and we will tell you directly about any change that meaningfully affects you.",
          },
        ],
      },
    ],
  },

  // ── TERMS & CONDITIONS ─────────────────────────
  "terms-conditions": {
    slug: "terms-conditions",
    eyebrow: "Legal",
    title: "Terms & Conditions",
    lede: "The agreement between you and KHEM when you place an order — what we owe you, and what we ask in return.",
    updatedAt: LAST_UPDATED,
    banner: {
      url: `${BANNER_PARAMS}legal-logo.png`,
      alt: "",
    },
    contactEmail: LEGAL_EMAIL,
    sections: [
      {
        id: "who-you-are-buying-from",
        title: "Who You Are Buying From",
        blocks: [
          {
            kind: "text",
            text: `Every order placed on this site is a contract with ${ENTITY}, a fragrance house registered and operating in Cairo, Egypt. These terms apply to all of them.`,
          },
          {
            kind: "note",
            text: "Company details: KHEM Fragrance House, Cairo, Egypt. Our commercial registration and tax identification numbers are pending publication and will be listed here once issued.",
          },
        ],
      },
      {
        id: "orders-and-acceptance",
        title: "Orders And Acceptance",
        blocks: [
          {
            kind: "text",
            text: "An order becomes a contract when we send you a confirmation email — not when you click to pay. Until then we may decline it.",
          },
          {
            kind: "text",
            text: "We reserve the right to cancel or amend an order where an item turns out to be unavailable, or where a description or price is wrong. If that happens you will hear from us immediately, and anything you have paid is returned in full.",
          },
        ],
      },
      {
        id: "pricing-and-payment",
        title: "Pricing And Payment",
        blocks: [
          {
            kind: "text",
            text: "Prices are shown in Egyptian pounds and include applicable taxes. Shipping is calculated at checkout and shown before you confirm. If your order travels outside Egypt, any customs duties or import charges are yours to settle with the carrier.",
          },
          {
            kind: "text",
            text: "Payments are handled by our payment provider over an encrypted connection. By placing an order you confirm you are authorised to use the payment method and that funds are available.",
          },
          {
            kind: "text",
            text: "If a price is listed in error, we will contact you before charging you. You may confirm the order at the corrected price or cancel it. If we cannot reach you, we cancel and refund.",
          },
        ],
      },
      {
        id: "shipping-and-delivery",
        title: "Shipping And Delivery",
        blocks: [
          {
            kind: "text",
            text: "Orders travel by courier. Delivery estimates are given in business days from dispatch, not from the moment you order, and they are estimates rather than guarantees.",
          },
          {
            kind: "text",
            text: "If a parcel is delayed or goes missing, tell us. We will open the investigation with the carrier and see it through on your behalf.",
          },
        ],
      },
      {
        id: "returns",
        title: "Returns",
        blocks: [
          {
            kind: "text",
            text: "You have fourteen days from delivery to return an unopened, sealed product in its original packaging. Samples and discovery sets are final sale. Opened fragrance cannot be returned for hygiene reasons unless it is faulty.",
          },
          {
            kind: "link",
            text: "The full procedure, including damaged and incorrect orders, is set out on our",
            href: "/return-exchange",
            label: "Returns & Exchanges page",
          },
        ],
      },
      {
        id: "product-information",
        title: "Product Information",
        blocks: [
          {
            kind: "text",
            text: "We describe our fragrances as precisely as we can. Note pyramids are a guide to composition, not a chemical inventory, and photography is indicative — glass, gilding, and light behave differently on a screen than in the hand.",
          },
          {
            kind: "text",
            text: "Our materials are natural. Oud, resins, and absolutes vary from harvest to harvest, and a fragrance may differ subtly between batches. That variation is a property of the ingredients, not a defect, and it is one of the reasons we work with them.",
          },
        ],
      },
      {
        id: "fragrance-safety",
        title: "Fragrance Safety",
        blocks: [
          {
            kind: "text",
            text: "Perfume is a concentrated cosmetic product. Every bottle carries a full ingredient list and allergen declaration on its packaging. Read it before first use, and if your skin is sensitive, test a small area first.",
          },
          {
            kind: "text",
            text: "Keep fragrance away from the eyes and out of reach of children. Discontinue use if irritation appears.",
          },
          {
            kind: "note",
            text: "Perfume is flammable. Store it away from direct sunlight, heat, and open flame, and never spray it near one.",
          },
        ],
      },
      {
        id: "intellectual-property",
        title: "Intellectual Property",
        blocks: [
          {
            kind: "text",
            text: "The KHEM name and marks, our bottle and packaging designs, our photography, and the editorial writing across this site belong to us. You are welcome to share and link to them. You may not reproduce them commercially, or use them in a way that suggests we endorse something we do not, without our written permission.",
          },
        ],
      },
      {
        id: "governing-law",
        title: "Governing Law",
        blocks: [
          {
            kind: "text",
            text: "These terms are governed by the laws of the Arab Republic of Egypt, and the competent Egyptian courts have jurisdiction over any dispute arising from them.",
          },
          {
            kind: "text",
            text: `Before it reaches that point, write to us. Nearly everything is resolved by a conversation, and we would rather have it than not. Complaints reach ${LEGAL_EMAIL} and are answered within seven business days.`,
          },
        ],
      },
      {
        id: "changes-to-these-terms",
        title: "Changes To These Terms",
        blocks: [
          {
            kind: "text",
            text: "We may revise these terms as the house and the shop develop. The version that applies to your order is the one published on the day you placed it, and the revision date at the top of this page tells you when it last changed.",
          },
        ],
      },
    ],
  },

  // ── RETURNS & EXCHANGES ────────────────────────
  "return-exchange": {
    slug: "return-exchange",
    eyebrow: "Customer Care",
    title: "Returns & Exchanges",
    lede: "If a fragrance is not right, or a parcel arrives in a state it should not have, here is exactly what happens next.",
    updatedAt: LAST_UPDATED,
    banner: {
      url: `${BANNER_PARAMS}legal-logo.png`,
      alt: "",
    },
    contactEmail: CARE_EMAIL,
    sections: [
      {
        id: "cancelling-an-order",
        title: "Cancelling An Order",
        blocks: [
          {
            kind: "text",
            text: `An order can be cancelled within six hours of being placed, provided it has not yet been dispatched. Write to ${CARE_EMAIL} with your order number and we will stop it and refund you in full.`,
          },
          {
            kind: "text",
            text: "After six hours the parcel is usually already with our packing team, and the return procedure below applies instead.",
          },
        ],
      },
      {
        id: "samples-and-discovery-sets",
        title: "Samples And Discovery Sets",
        blocks: [
          {
            kind: "text",
            text: "Samples and discovery sets are final sale and cannot be returned. They exist precisely so you can explore the library before committing to a full bottle — which is the outcome we would rather have than a return.",
          },
        ],
      },
      {
        id: "returning-a-product",
        title: "Returning A Product",
        blocks: [
          {
            kind: "text",
            text: "You have fourteen days from the day your order arrives to request a return. The product must come back unopened and unused, with its seal and cellophane intact, in its original undamaged packaging and complete with everything it shipped with.",
          },
          {
            kind: "list",
            items: [
              `Email ${CARE_EMAIL} within fourteen days, quoting your order number and the items concerned.`,
              "Tell us whether you would prefer a refund or an exchange.",
              "Wait for authorisation before sending anything back.",
              "We issue a prepaid return label; use it and no other method.",
            ],
          },
          {
            kind: "text",
            text: "The prepaid label is not a formality. Glass flacons need a carrier who knows what is inside the box, and we cannot guarantee the safety of a return that travels any other way. Returns sent without authorisation cannot be accepted.",
          },
        ],
      },
      {
        id: "what-we-cannot-accept",
        title: "What We Cannot Accept",
        blocks: [
          {
            kind: "list",
            items: [
              "Fragrance that has been opened or used — a hygiene rule, and one we cannot waive unless the product is faulty.",
              "Personalised, engraved, or bespoke pieces, unless there is a manufacturing error or defect.",
              "Samples and discovery sets.",
              "Returns sent without prior authorisation, or shipped in makeshift packaging.",
              "Products returned incomplete — missing outer packaging, missing parts, or with the product label removed.",
            ],
          },
        ],
      },
      {
        id: "damaged-or-incorrect-orders",
        title: "Damaged Or Incorrect Orders",
        blocks: [
          {
            kind: "text",
            text: "Please check the parcel when it reaches you. If the outer box is crushed, opened, or shows any sign of tampering, note it with the courier before you sign.",
          },
          {
            kind: "text",
            text: `If a product arrives damaged or faulty, tell us within 48 hours of delivery at ${CARE_EMAIL} and include photographs of the product and the packaging. We use them to file the claim with the carrier and to send your replacement without waiting for the claim to close.`,
          },
          {
            kind: "note",
            text: "Do not discard or destroy a product you believe is faulty before you have spoken to us. Once it is gone we cannot examine it, and that may affect the refund or replacement you are owed.",
          },
          {
            kind: "text",
            text: "If we sent the wrong item, do not open it. Let us know and we will collect it and dispatch the correct one at our cost.",
          },
        ],
      },
      {
        id: "exchanges",
        title: "Exchanges",
        blocks: [
          {
            kind: "text",
            text: "An exchange follows the same route as a return: request it within fourteen days, wait for authorisation, and send the sealed product back on the prepaid label. The replacement is dispatched as soon as the return is received and inspected.",
          },
          {
            kind: "text",
            text: "Where the replacement costs more, we will send you the difference to settle before dispatch. Where it costs less, the difference is refunded.",
          },
        ],
      },
      {
        id: "refunds",
        title: "Refunds",
        blocks: [
          {
            kind: "text",
            text: "Refunds are issued to the original payment method within fourteen days of the returned product reaching us and passing inspection. Your bank may take a few days more to show it.",
          },
          {
            kind: "text",
            text: "Where a product is returned faulty, incorrect, or damaged in transit, we refund the shipping as well. Where a return is a change of mind, the original shipping is not refunded.",
          },
        ],
      },
    ],
  },

  // ── COOKIE POLICY ──────────────────────────────
  "cookie-policy": {
    slug: "cookie-policy",
    eyebrow: "Legal",
    title: "Cookie Policy",
    lede: "A short page, because we use few cookies. Here is every one of them and what it does.",
    updatedAt: LAST_UPDATED,
    banner: {
      url: `${BANNER_PARAMS}legal-logo.png`,
      alt: "",
    },
    contactEmail: PRIVACY_EMAIL,
    sections: [
      {
        id: "what-a-cookie-is",
        title: "What A Cookie Is",
        blocks: [
          {
            kind: "text",
            text: "A cookie is a small text file a website stores on your device. It lets the site recognise your browser the next time you arrive — which is how a shopping bag survives a page refresh, and how you stay signed in between visits.",
          },
        ],
      },
      {
        id: "how-we-use-them",
        title: "How We Use Them",
        blocks: [
          {
            kind: "text",
            text: "Three categories, and no others:",
          },
          {
            kind: "table",
            table: {
              head: ["Category", "What it does"],
              rows: [
                [
                  "Essential",
                  "Keeps you signed in, keeps your bag intact, and secures checkout. These cannot be switched off — without them the shop does not work.",
                ],
                [
                  "Preferences",
                  "Remembers your region, currency, and the fragrances you have recently viewed.",
                ],
                [
                  "Analytics",
                  "Anonymous, aggregated data on which pages are read and where visitors get stuck. It tells us what to fix; it does not tell us who you are.",
                ],
              ],
            },
          },
        ],
      },
      {
        id: "what-we-do-not-do",
        title: "What We Do Not Do",
        blocks: [
          {
            kind: "note",
            text: "We run no advertising cookies. We work with no ad networks, we do not follow you onto other websites, and we neither sell nor share your browsing data with third-party advertisers.",
          },
          {
            kind: "text",
            text: "This is worth stating plainly, because most policies of this kind quietly say the opposite. If that ever changes, this page changes first, and we will ask before it does.",
          },
        ],
      },
      {
        id: "managing-cookies",
        title: "Managing Cookies",
        blocks: [
          {
            kind: "text",
            text: "Every major browser lets you see the cookies a site has set, delete them, and block new ones — usually under Privacy or Settings. Your browser's help pages describe the exact steps.",
          },
          {
            kind: "text",
            text: "Blocking preference and analytics cookies costs you nothing but a little convenience. Blocking essential cookies will break the shopping bag and prevent checkout from completing.",
          },
        ],
      },
      {
        id: "how-long-they-last",
        title: "How Long They Last",
        blocks: [
          {
            kind: "text",
            text: "Session cookies disappear the moment you close your browser. The rest expire no later than twelve months after your last visit, and are deleted automatically when they do.",
          },
        ],
      },
      {
        id: "more-information",
        title: "More Information",
        blocks: [
          {
            kind: "link",
            text: "Some cookies process limited personal data such as an IP address. How we handle that, and the rights you have over it, are set out in our",
            href: "/privacy-policy",
            label: "Privacy Policy",
          },
          {
            kind: "text",
            text: `Anything still unclear can go to ${PRIVACY_EMAIL}.`,
          },
        ],
      },
    ],
  },
};

/** Display order for the footer, a future `/legal` index, and the sitemap. */
export const LEGAL_DOCUMENT_ORDER: readonly LegalDocumentSlug[] = [
  "privacy-policy",
  "terms-conditions",
  "return-exchange",
  "cookie-policy",
];
