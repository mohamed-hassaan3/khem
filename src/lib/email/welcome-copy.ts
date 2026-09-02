/**
 * Prose for the two account letters: the welcome and the invitation.
 *
 * ## Why not `./copy.ts`
 *
 * That file already exports a `WELCOME_COPY`, and it is the **Inner Circle**
 * welcome — the letter a newsletter subscriber receives. This is a different
 * letter to a different person about a different thing, and two constants called
 * welcome in one module is how the wrong one eventually gets imported.
 *
 * Everything else follows that file's rules exactly, because they are good ones:
 *
 *  - `Record<Locale, …>`, so a third language is a compile error until it is
 *    translated rather than a silent fallback to English.
 *  - Server-only prose. It is never in a page bundle, which is why it does not
 *    live in `src/lib/i18n/dictionaries/*`.
 *  - **Every string here is trusted, author-written content**, interpolated into
 *    HTML without escaping. Visitor input never appears in this file. The one
 *    visitor-supplied value either letter renders — a first name — arrives as a
 *    parameter and is escaped at the point it is written.
 */

import type { Locale } from "@/src/lib/i18n/config";

export interface AccountWelcomeCopy {
  subject: string;
  preheader: string;
  eyebrow: string;
  /** Supports `{name}`; the unnamed variant is used when Clerk holds no name. */
  headline: string;
  headlineNoName: string;
  intro: string;
  /** What the house is, in two sentences. §7.3's "short introduction". */
  house: string;
  /** Introduces the voucher block. Omitted entirely when there is no code. */
  privilegeLead: string;
  privilegeLabel: string;
  /** Supports `{date}`. */
  privilegeExpiry: string;
  privilegeNoExpiry: string;
  /** How to use it, in one line. */
  privilegeHow: string;
  cta: string;
  /** Shown in place of the privilege block when no welcome offer is running. */
  noPrivilege: string;
  signoff: string;
}

export interface InvitationCopy {
  subject: string;
  preheader: string;
  eyebrow: string;
  headline: string;
  intro: string;
  house: string;
  cta: string;
  /** Supports `{days}`. */
  expiry: string;
  /** For the plain-text part, where a bare URL has nowhere else to go. */
  linkLabel: string;
  signoff: string;
}

export const ACCOUNT_WELCOME_COPY: Record<Locale, AccountWelcomeCopy> = {
  en: {
    subject: "Welcome to KHEM House",
    preheader: "A world where heritage, craftsmanship and fragrance meet.",
    eyebrow: "Welcome to the House",
    headline: "Welcome, {name}.",
    headlineNoName: "Welcome to KHEM House.",
    intro:
      "Your account is open. From here you can follow your orders, keep your addresses, and hold the privileges the house extends to you.",
    house:
      "KHEM composes fragrance in Cairo, drawing on five millennia of Egyptian perfumery. Each bottle is finished by hand, and each composition is made in small number.",
    privilegeLead:
      "As a welcome to our House, we are pleased to offer you a private privilege.",
    privilegeLabel: "Your welcome code",
    privilegeExpiry: "Yours until {date}.",
    privilegeNoExpiry: "Yours to use whenever you are ready.",
    privilegeHow:
      "Enter it at checkout, or choose it from your account. It is already waiting there.",
    cta: "Explore KHEM House",
    noPrivilege:
      "Your account is ready whenever you are. New compositions and private offers reach you here first.",
    signoff: "With warm regards,",
  },
  ar: {
    subject: "أهلًا بك في دار كيم",
    preheader: "عالم يلتقي فيه التراث والحرفة والعطر.",
    eyebrow: "أهلًا بك في الدار",
    headline: "أهلًا بك، {name}.",
    headlineNoName: "أهلًا بك في دار كيم.",
    intro:
      "حسابك جاهز. من هنا تتابع طلباتك، وتحفظ عناوينك، وتحتفظ بالامتيازات التي تمنحها لك الدار.",
    house:
      "تصنع كيم عطورها في القاهرة، مستلهمةً خمسة آلاف عام من فنّ العطر المصري. كل زجاجة تُنهى يدويًا، وكل تركيبة تُصنع بأعداد محدودة.",
    privilegeLead: "ترحيبًا بك في دارنا، يسعدنا أن نمنحك امتيازًا خاصًا.",
    privilegeLabel: "رمزك الترحيبي",
    privilegeExpiry: "صالح لك حتى {date}.",
    privilegeNoExpiry: "استخدمه متى شئت.",
    privilegeHow:
      "أدخله عند إتمام الطلب، أو اختره من حسابك؛ فهو في انتظارك هناك.",
    cta: "تعرّف على دار كيم",
    noPrivilege:
      "حسابك جاهز متى أردت. التركيبات الجديدة والعروض الخاصة تصلك هنا أولًا.",
    signoff: "مع أطيب التحيات،",
  },
};

export const INVITATION_COPY: Record<Locale, InvitationCopy> = {
  en: {
    subject: "An invitation to KHEM House",
    preheader: "Your place at the house is waiting.",
    eyebrow: "A Private Invitation",
    headline: "You are invited.",
    intro:
      "The house has opened a place for you at KHEM. Accept the invitation below and your account will be ready in a moment, with the privileges the house extends to its members.",
    house:
      "KHEM composes fragrance in Cairo, drawing on five millennia of Egyptian perfumery. Each bottle is finished by hand, and each composition is made in small number.",
    cta: "Accept Invitation",
    expiry: "This invitation is yours for {days} days.",
    linkLabel: "Accept your invitation:",
    signoff: "With warm regards,",
  },
  ar: {
    subject: "دعوة إلى دار كيم",
    preheader: "مكانك في الدار بانتظارك.",
    eyebrow: "دعوة خاصة",
    headline: "أنت مدعو.",
    intro:
      "فتحت الدار لك مكانًا في كيم. اقبل الدعوة أدناه ليصبح حسابك جاهزًا في لحظات، بما تحمله من امتيازات تمنحها الدار لأعضائها.",
    house:
      "تصنع كيم عطورها في القاهرة، مستلهمةً خمسة آلاف عام من فنّ العطر المصري. كل زجاجة تُنهى يدويًا، وكل تركيبة تُصنع بأعداد محدودة.",
    cta: "قبول الدعوة",
    expiry: "هذه الدعوة صالحة لك لمدة {days} يومًا.",
    linkLabel: "اقبل دعوتك:",
    signoff: "مع أطيب التحيات،",
  },
};
