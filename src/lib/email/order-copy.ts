/**
 * Prose for the order emails, per locale.
 *
 * Sibling of `./copy.ts` and bound by the same three rules:
 *
 *  - **Not in `src/lib/i18n/dictionaries/*`.** Those ship to the browser in
 *    every page bundle; this is read only by the server, and keeping it here
 *    costs the visitor nothing.
 *  - **`Record<Locale, …>`**, so a third language is a compile error until it
 *    is translated rather than a silent fallback to English.
 *  - **Every string is trusted, author-written content** and is interpolated
 *    into HTML *without* escaping. Visitor input never appears in this file and
 *    must never be added to it. Names, addresses and product names are escaped
 *    at the point they enter a template, in `./order-templates.ts`.
 *
 * ## Which language a message is written in
 *
 * `"Order"."locale"` — a column, not a request property. A shipping notice is
 * sent days after checkout, from an English-only dashboard, so there is no
 * request to infer a language from. See `supabase/sql/0016_checkout.sql`.
 */

import type { Locale } from "@/src/lib/i18n/config";

/**
 * The five moments a customer hears from the house about one order.
 *
 * Five messages, five statuses. `PROCESSING` — where an order begins — takes
 * `confirmation`, which is what checkout would have said: the house has the
 * order and is getting to it. See `mailKindForStatus()` in
 * `./send-order-mail.ts` for the mapping.
 */
export type OrderMailKind =
  | "confirmation"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

export interface OrderMessageCopy {
  /** Inbox subject. Supports `{orderNumber}`. */
  subject: string;
  /** Preview line beside the subject. */
  preheader: string;
  eyebrow: string;
  /** Supports `{name}`. */
  headline: string;
  intro: string;
  /** The one operational sentence — what happens next, or what already did. */
  detail: string;
  cta: string;
  signoff: string;
}

/** Labels shared by every order email: the receipt table and the panels. */
export interface OrderLabelCopy {
  orderNumber: string;
  placedOn: string;
  items: string;
  quantity: string;
  subtotal: string;
  delivery: string;
  complimentary: string;
  total: string;
  paymentMethod: string;
  card: string;
  cash: string;
  /** Supports `{amount}`. The one line a cash-on-delivery buyer needs. */
  cashInstruction: string;
  deliverTo: string;
  tracking: string;
  /** Supports `{code}`. */
  trackingCode: string;
  yourNote: string;
  /** Feedback letter: the heading above the linked item list. */
  shareYourThoughts: string;
  /** Feedback letter: the link beside each item. */
  leaveAComment: string;
}

export const ORDER_LABELS: Record<Locale, OrderLabelCopy> = {
  en: {
    orderNumber: "Order",
    placedOn: "Placed",
    items: "Your Selection",
    quantity: "Qty",
    subtotal: "Subtotal",
    delivery: "Delivery",
    complimentary: "Complimentary",
    total: "Total",
    paymentMethod: "Payment",
    card: "Card",
    cash: "Cash on delivery",
    cashInstruction:
      "Please have {amount} ready for the courier. Payment is collected at your door.",
    deliverTo: "Delivered To",
    tracking: "Tracking",
    trackingCode: "Your tracking reference is {code}.",
    yourNote: "Your Note",
    shareYourThoughts: "What You Chose",
    leaveAComment: "Share your thoughts",
  },
  ar: {
    orderNumber: "الطلب",
    placedOn: "تاريخ الطلب",
    items: "اختيارك",
    quantity: "الكمية",
    subtotal: "المجموع الفرعي",
    delivery: "التوصيل",
    complimentary: "مجاني",
    total: "الإجمالي",
    paymentMethod: "الدفع",
    card: "بطاقة",
    cash: "الدفع عند الاستلام",
    cashInstruction:
      "يرجى تجهيز مبلغ {amount} لمندوب التوصيل. يتم تحصيل المبلغ عند بابك.",
    deliverTo: "عنوان التوصيل",
    tracking: "التتبع",
    trackingCode: "رقم تتبع شحنتك هو {code}.",
    yourNote: "ملاحظتك",
    shareYourThoughts: "ما اخترته",
    leaveAComment: "شاركنا رأيك",
  },
};

export const ORDER_COPY: Record<Locale, Record<OrderMailKind, OrderMessageCopy>> = {
  en: {
    confirmation: {
      subject: "Your KHEM order {orderNumber} is confirmed",
      preheader: "Your order has reached the house and is being prepared.",
      eyebrow: "Order Confirmed",
      headline: "Thank you, {name}.",
      intro:
        "Your order has reached the house in Cairo and is now being prepared by hand. Each bottle is checked, sealed and wrapped before it leaves us.",
      detail:
        "We will write to you again the moment your parcel is with the courier, and once more when it arrives.",
      cta: "View Your Order",
      signoff: "With warm regards,",
    },
    shipped: {
      subject: "Your KHEM order {orderNumber} is on its way",
      preheader: "Your parcel has left the house and is with the courier.",
      eyebrow: "On Its Way",
      headline: "Your parcel has left us, {name}.",
      intro:
        "Your order has been wrapped, sealed and handed to our courier. It is now making its way to you.",
      detail:
        "Deliveries within Cairo usually arrive within two working days, and elsewhere in Egypt within three to five.",
      cta: "Track Your Order",
      signoff: "With warm regards,",
    },
    delivered: {
      subject: "Your KHEM order {orderNumber} has arrived",
      preheader: "Your parcel has been delivered. We hope it finds you well.",
      eyebrow: "Delivered",
      headline: "It has arrived, {name}.",
      intro:
        "Your order has been delivered. We hope the first impression is everything you hoped for — a fragrance is best met unhurried, in the quiet of your own room.",
      detail:
        "If anything is not as it should be, write to us within fourteen days and we will put it right.",
      cta: "Explore The Collections",
      signoff: "With warm regards,",
    },
    cancelled: {
      subject: "Your KHEM order {orderNumber} has been cancelled",
      preheader: "Your order has been cancelled. Nothing further is owed.",
      eyebrow: "Order Cancelled",
      headline: "Your order has been cancelled, {name}.",
      intro:
        "This order has been cancelled and will not be dispatched. Nothing further is owed, and any authorisation taken against your card is released.",
      detail:
        "If this was not what you expected, write to us and we will look into it personally.",
      cta: "Return To The House",
      signoff: "With our apologies,",
    },
    refunded: {
      subject: "Your KHEM order {orderNumber} has been refunded",
      preheader: "Your refund is on its way back to you.",
      eyebrow: "Refund Issued",
      headline: "Your refund is on its way, {name}.",
      intro:
        "We have issued a full refund for this order. It returns by the same method you paid with.",
      detail:
        "Card refunds usually appear within five to ten working days, depending on your bank.",
      cta: "Return To The House",
      signoff: "With our thanks for your patience,",
    },
  },
  ar: {
    confirmation: {
      subject: "تم تأكيد طلبك {orderNumber} من كيم",
      preheader: "وصل طلبك إلى الدار وجاري تجهيزه.",
      eyebrow: "تم تأكيد الطلب",
      headline: "شكرًا لك، {name}.",
      intro:
        "وصل طلبك إلى الدار في القاهرة ويجري تجهيزه يدويًا الآن. تُفحص كل زجاجة وتُختم وتُغلَّف قبل أن تغادرنا.",
      detail:
        "سنكتب إليك مجددًا فور تسليم شحنتك لمندوب الشحن، ومرة أخرى عند وصولها.",
      cta: "عرض طلبك",
      signoff: "مع أطيب التحيات،",
    },
    shipped: {
      subject: "طلبك {orderNumber} من كيم في طريقه إليك",
      preheader: "غادرت شحنتك الدار وهي الآن مع مندوب الشحن.",
      eyebrow: "في الطريق إليك",
      headline: "غادرت شحنتك الدار، {name}.",
      intro:
        "تم تغليف طلبك وختمه وتسليمه إلى مندوب الشحن، وهو الآن في طريقه إليك.",
      detail:
        "تصل الشحنات داخل القاهرة عادةً خلال يومَي عمل، وفي باقي أنحاء مصر خلال ثلاثة إلى خمسة أيام.",
      cta: "تتبع طلبك",
      signoff: "مع أطيب التحيات،",
    },
    delivered: {
      subject: "وصل طلبك {orderNumber} من كيم",
      preheader: "تم تسليم شحنتك. نرجو أن تنال إعجابك.",
      eyebrow: "تم التسليم",
      headline: "لقد وصل، {name}.",
      intro:
        "تم تسليم طلبك. نرجو أن يكون الانطباع الأول كما تمنيت — فالعطر يُستقبل على مهل، في هدوء غرفتك.",
      detail:
        "إن كان هناك ما لا يرضيك، اكتب إلينا خلال أربعة عشر يومًا وسنعالج الأمر.",
      cta: "استكشف المجموعات",
      signoff: "مع أطيب التحيات،",
    },
    cancelled: {
      subject: "تم إلغاء طلبك {orderNumber} من كيم",
      preheader: "تم إلغاء طلبك. لا توجد أي مستحقات عليك.",
      eyebrow: "تم إلغاء الطلب",
      headline: "تم إلغاء طلبك، {name}.",
      intro:
        "تم إلغاء هذا الطلب ولن يتم شحنه. لا توجد أي مستحقات عليك، وسيُفك أي حجز تم على بطاقتك.",
      detail: "إن لم يكن هذا ما توقعته، اكتب إلينا وسننظر في الأمر بأنفسنا.",
      cta: "العودة إلى الدار",
      signoff: "مع اعتذارنا،",
    },
    refunded: {
      subject: "تم رد قيمة طلبك {orderNumber} من كيم",
      preheader: "المبلغ المسترد في طريقه إليك.",
      eyebrow: "تم رد المبلغ",
      headline: "المبلغ المسترد في طريقه إليك، {name}.",
      intro:
        "قمنا برد كامل قيمة هذا الطلب، ويعود إليك بنفس وسيلة الدفع التي استخدمتها.",
      detail:
        "يظهر المبلغ المسترد على البطاقة عادةً خلال خمسة إلى عشرة أيام عمل، حسب البنك.",
      cta: "العودة إلى الدار",
      signoff: "مع شكرنا لسعة صدرك،",
    },
  },
};

/**
 * The letter that arrives a day after the parcel did.
 *
 * A sixth message, and deliberately **not** a member of {@link OrderMailKind}.
 * That union is the status mapping — `mailKindForStatus()` switches over it
 * exhaustively so that adding an `OrderStatus` fails to compile — and a member
 * that no status maps to would quietly weaken the one guarantee it gives.
 *
 * It reuses {@link OrderMessageCopy} because the shape is genuinely the same:
 * an eyebrow, a headline addressed by first name, prose, one operational
 * sentence, a button. What differs is that the body between them is a list of
 * what the reader bought, each line linking to that product's comment area.
 *
 * `detail` is where the honesty lives: a comment is public, and somebody about
 * to write one should know that before they write it, not after.
 */
export const FEEDBACK_COPY: Record<Locale, OrderMessageCopy> = {
  en: {
    subject: "How are you finding your KHEM order {orderNumber}?",
    preheader: "A day with your fragrance — we would love to hear how it wears.",
    eyebrow: "A Day Later",
    headline: "How is it wearing, {name}?",
    intro:
      "A fragrance tells the truth on the second day, not the first — after it has met your skin, your rooms and your hours. Now that yours has had a day, we would be glad to know what you found.",
    detail:
      "Choose any piece below to leave a note and a rating on its page. What you write appears publicly beside it, under your name or as a guest, and it helps the next person choose.",
    // Points at the order itself, as the delivered message does — see
    // `customerFeedbackEmail`. The collections are one click further on.
    cta: "Track Your Order",
    signoff: "With warm regards,",
  },
  ar: {
    subject: "كيف تجد طلبك {orderNumber} من كيم؟",
    preheader: "يوم واحد مع عطرك — يسعدنا أن نعرف كيف وجدته.",
    eyebrow: "بعد يوم",
    headline: "كيف وجدته، {name}؟",
    intro:
      "العطر يصدق في يومه الثاني لا الأول — بعد أن يلتقي ببشرتك وغرفك وساعات يومك. وقد مضى على عطرك يوم، فيسعدنا أن نعرف ما وجدت.",
    detail:
      "اختر أي قطعة أدناه لتترك ملاحظتك وتقييمك على صفحتها. ما تكتبه يظهر علنًا بجوارها، باسمك أو كضيف، ويساعد من يأتي بعدك على الاختيار.",
    cta: "تتبع طلبك",
    signoff: "مع أطيب التحيات،",
  },
};
