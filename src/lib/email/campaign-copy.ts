/**
 * The house's own words in a campaign letter — the parts the editor does not
 * write.
 *
 * A campaign's subject, body and call to action come from the dashboard. What
 * remains is the frame: the voucher label, and the unsubscribe line every
 * marketing letter must carry. Those are the house's, in both languages, and
 * they are here for the same reason `copy.ts` exists — server-only prose that
 * never reaches a page bundle.
 *
 * Every string here is trusted, author-written content. The editor's prose is
 * **not**, and is escaped where it is written into the template.
 */

import type { Locale } from "@/src/lib/i18n/config";

export interface CampaignFrameCopy {
  /** The small line above the subject, naming who is writing. */
  eyebrow: string;
  /** Above the voucher code. */
  voucherLabel: string;
  /** Beneath it, in one line. */
  voucherHow: string;
  /**
   * The line before the unsubscribe link.
   *
   * Required on a marketing letter, and worded as the house would say it rather
   * than as a legal footnote.
   */
  unsubscribe: string;
  unsubscribeLink: string;
  /** Names what this letter is, so it is never mistaken for an order email. */
  marketingNote: string;
}

export const CAMPAIGN_FRAME_COPY: Record<Locale, CampaignFrameCopy> = {
  en: {
    eyebrow: "From the House",
    voucherLabel: "Your code",
    voucherHow: "Enter it at checkout, or choose it from your account.",
    unsubscribe:
      "You are receiving this because you asked the house to write to you.",
    unsubscribeLink: "Leave the Inner Circle",
    marketingNote:
      "News and private offers. Letters about your orders are sent separately and are never affected by this choice.",
  },
  ar: {
    eyebrow: "من الدار",
    voucherLabel: "رمزك",
    voucherHow: "أدخله عند إتمام الطلب، أو اختره من حسابك.",
    unsubscribe: "تصلك هذه الرسالة لأنك طلبت من الدار أن تكتب إليك.",
    unsubscribeLink: "مغادرة الدائرة الخاصة",
    marketingNote:
      "أخبار وعروض خاصة. أما رسائل طلباتك فتُرسل على حدة ولا يؤثر عليها هذا الاختيار.",
  },
};
