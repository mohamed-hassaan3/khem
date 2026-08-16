/**
 * Contact enquiry validation.
 *
 * The authoritative pass. `ContactForm.tsx` checks the same fields client-side
 * for the focus/error affordance, but that is a UX nicety — this schema runs
 * inside the Server Action on every submission regardless.
 *
 * Field errors are emitted as *codes*, not sentences: the client owns the
 * copy, so server-authored English can never leak onto an Arabic page.
 */

import { z } from "zod";

import { ENQUIRY_SUBJECTS } from "@/src/constants/contact";

/** Cap on the message body, enforced independently of any client `maxlength`. */
export const MESSAGE_MAX_LENGTH = 4_000;

/** Floor, so "hi" does not consume an enquiry slot. */
export const MESSAGE_MIN_LENGTH = 10;

export const contactEnquirySchema = z.object({
  name: z.string().trim().min(2, "nameRequired").max(80, "nameTooLong"),
  email: z.email("emailInvalid").max(254, "emailInvalid"),
  /*
   * `ENQUIRY_SUBJECTS` is a `readonly string[]`, not a literal tuple, so this
   * is a refinement rather than `z.enum`. Same guarantee: a `<select>` is
   * trivially bypassed, and an unvalidated subject would land in a mail header.
   *
   * Validated against the **constant**, never against `"EnquirySubject"`: the
   * table is display copy an account with write access can edit, and the
   * allow-list guarding a mail header must not be editable without a deploy.
   */
  subject: z
    .string()
    .trim()
    .refine((value) => ENQUIRY_SUBJECTS.includes(value), "subjectInvalid"),
  message: z
    .string()
    .trim()
    .min(1, "messageRequired")
    .min(MESSAGE_MIN_LENGTH, "messageTooShort")
    .max(MESSAGE_MAX_LENGTH, "messageTooLong"),
  /**
   * Honeypot. A real visitor never sees this field, so any value at all means
   * a bot filled the form by walking the DOM. Empty string or absent only.
   */
  company: z.string().max(0).optional(),
});

export type ContactEnquiryInput = z.infer<typeof contactEnquirySchema>;
