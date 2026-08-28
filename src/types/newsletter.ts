/**
 * The Inner Circle vocabulary.
 *
 * Mirrors the enums and columns in `supabase/sql/0025_newsletter.sql`. The
 * unsubscribe token is deliberately absent from every shape here: it is read
 * once, by the action that puts it in a letter, and never travels into a page.
 */

/** Whether the house may write to them today. */
export type NewsletterStatus = "SUBSCRIBED" | "UNSUBSCRIBED";

/**
 * Where the address came from.
 *
 * Recorded because the three carry different evidence of consent: a form the
 * person filled in, a box they ticked while making an account, and somebody at
 * the desk typing it in.
 */
export type NewsletterSource =
  | "HOME_FORM"
  | "SIGN_UP"
  | "ADMIN"
  /** The offer popup — see `supabase/sql/0035_marketing.sql`. */
  | "POPUP";

/** One subscriber, as the dashboard lists them. */
export interface NewsletterSubscriber {
  id: string;
  email: string;
  status: NewsletterStatus;
  source: NewsletterSource;
  locale: "en" | "ar";
  /** Set when the address belongs to a registered account. */
  clerkUserId: string | null;
  /** When consent was last *given*. A re-subscription moves it. */
  consentAt: string;
  /** When it was withdrawn. Null while subscribed. */
  unsubscribedAt: string | null;
  createdAt: string;
}

/** A page of the list, with the figure its pager needs. */
export interface NewsletterPage {
  subscribers: readonly NewsletterSubscriber[];
  /** Matching subscribers *before* the limit — not the number on this page. */
  total: number;
}

/** The three figures above the list, over the whole table. */
export interface NewsletterCounts {
  total: number;
  subscribed: number;
  unsubscribed: number;
}

/**
 * What `subscribe_newsletter()` reports back.
 *
 * `isNew` and `reactivated` are what decide whether a welcome letter is owed —
 * either is a yes, neither means the address was already on the list and
 * writing again would be the house mailing somebody for filling in a form
 * twice.
 */
export interface SubscribeOutcome {
  id: string;
  /** The row's own unsubscribe token. Goes into the letter, nowhere else. */
  token: string;
  isNew: boolean;
  reactivated: boolean;
}

/** What the unsubscribe page learned about the token it was handed. */
export interface UnsubscribeOutcome {
  found: boolean;
  /** True when they were already off the list — still a success, worded differently. */
  alreadyOff: boolean;
  /** Shown back so the reader can see *which* address was removed. */
  email: string | null;
}
