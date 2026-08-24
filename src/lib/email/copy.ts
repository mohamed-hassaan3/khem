/**
 * Prose for the customer-facing emails, per locale.
 *
 * Deliberately *not* in `src/lib/i18n/dictionaries/*`: those ship to the
 * browser in every page bundle, and email copy is read exclusively by the
 * server. Keeping it here costs the visitor nothing.
 *
 * Typed as `Record<Locale, …>`, so adding a third language is a compile error
 * until it is translated rather than a silent fallback to English.
 *
 * Every string here is trusted, author-written content — it is interpolated
 * into HTML without escaping. Visitor input never appears in this file, and
 * must never be added to it.
 */

import type { Locale } from "@/src/lib/i18n/config";

export interface AcknowledgementCopy {
  /** Inbox subject line. Fixed per locale — never built from user input. */
  subject: string;
  /** Preview text shown beside the subject in most clients. */
  preheader: string;
  eyebrow: string;
  /** Supports `{name}`. */
  headline: string;
  intro: string;
  /** Sets expectations, and must match what the site promises. */
  timing: string;
  quoteLabel: string;
  subjectLabel: string;
  cta: string;
  signoff: string;
}

export interface WelcomeCopy {
  subject: string;
  preheader: string;
  eyebrow: string;
  headline: string;
  intro: string;
  benefits: string[];
  cta: string;
  signoff: string;
  unsubscribe: string;
}

export interface SignatureCopy {
  house: string;
  tagline: string;
  officialHouse: string;
  /** Alt text for the seal, for the many clients that block images. */
  logoAlt: string;
  rights: string;
}

export const ACKNOWLEDGEMENT_COPY: Record<Locale, AcknowledgementCopy> = {
  en: {
    subject: "We have received your message — KHEM",
    preheader: "Your enquiry has reached the house. A reply follows shortly.",
    eyebrow: "Enquiry Received",
    headline: "Thank you, {name}.",
    intro:
      "Your message has reached the house and is with our team in Cairo. Every enquiry is read by a person, not a machine.",
    // Matches the "within 24 hours" line on the contact page. If one changes,
    // both change — an acknowledgement that promises more than the site does
    // is how a support backlog becomes a complaint.
    timing:
      "You can expect a considered reply within 24 hours, Sunday through Thursday.",
    quoteLabel: "Your message",
    subjectLabel: "Subject",
    cta: "Explore The Collections",
    signoff: "With warm regards,",
  },
  ar: {
    subject: "لقد استلمنا رسالتك — كيم",
    preheader: "وصلت رسالتك إلى الدار، وسيصلك الرد قريبًا.",
    eyebrow: "تم استلام الرسالة",
    headline: "شكرًا لك، {name}.",
    intro:
      "وصلت رسالتك إلى الدار وهي الآن بين يدي فريقنا في القاهرة. كل رسالة يقرأها إنسان، لا آلة.",
    timing: "يصلك ردٌّ وافٍ خلال 24 ساعة، من الأحد إلى الخميس.",
    quoteLabel: "رسالتك",
    subjectLabel: "الموضوع",
    cta: "اكتشف المجموعات",
    signoff: "مع أطيب التحيات،",
  },
};

export const WELCOME_COPY: Record<Locale, WelcomeCopy> = {
  en: {
    subject: "Welcome to the Inner Circle — KHEM",
    preheader: "You are on the list. Here is what it brings you.",
    eyebrow: "The Inner Circle",
    headline: "Welcome.",
    intro:
      "Thank you for joining the Inner Circle. You now sit closest to the house — where each composition is announced before it reaches the boutique.",
    benefits: [
      "First word on new compositions and house releases",
      "Invitations to private consultations and boutique evenings",
      "Notes from the perfumer on rare botanicals and their sourcing",
    ],
    cta: "Discover The House",
    signoff: "With warm regards,",
    // Honest about the fact that removal is a human action today — a one-click
    // link that quietly does nothing would be worse than none at all.
    unsubscribe:
      "Wish to step away? Reply to this message, or write to info@khemperfumes.com, and we will remove you promptly.",
  },
  ar: {
    subject: "أهلًا بك في الدائرة الخاصة — كيم",
    preheader: "أنت الآن ضمن القائمة. إليك ما تمنحك إياه.",
    eyebrow: "الدائرة الخاصة",
    headline: "أهلًا بك.",
    intro:
      "شكرًا لانضمامك إلى الدائرة الخاصة. أنت الآن الأقرب إلى الدار، حيث يُعلَن عن كل تركيبة قبل وصولها إلى البوتيك.",
    benefits: [
      "أول من يعلم بالتركيبات الجديدة وإصدارات الدار",
      "دعوات إلى الاستشارات الخاصة وأمسيات البوتيك",
      "رسائل من صانع العطر عن النباتات النادرة ومصادرها",
    ],
    cta: "تعرّف على الدار",
    signoff: "مع أطيب التحيات،",
    unsubscribe:
      "ترغب في إلغاء الاشتراك؟ ردّ على هذه الرسالة أو راسلنا على info@khemperfumes.com وسنزيل بريدك فورًا.",
  },
};

export const SIGNATURE_COPY: Record<Locale, SignatureCopy> = {
  en: {
    house: "KHEM Perfumes",
    tagline: "Essence of Heritage",
    officialHouse: "Official House",
    logoAlt: "KHEM — Essence of Heritage",
    rights: "New Cairo City, Cairo Governorate, Egypt",
  },
  ar: {
    house: "عطور كيم",
    tagline: "عبق التراث",
    officialHouse: "الموقع الرسمي",
    logoAlt: "كيم — عبق التراث",
    rights: "القاهرة الجديدة، محافظة القاهرة، مصر",
  },
};
