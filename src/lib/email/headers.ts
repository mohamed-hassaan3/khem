/**
 * Headers that stop an auto-reply from starting a conversation with a robot.
 *
 * Without these, a visitor whose own vacation responder is switched on replies
 * to our acknowledgement, which arrives at the house mailbox — and if anything
 * on that side ever auto-answers, the two bounce mail off each other until
 * someone notices. The 3-per-10-minute throttle caps how fast that can start;
 * these headers are what stop well-behaved responders from starting it at all.
 *
 * `Auto-Submitted: auto-replied` is the standard signal (RFC 3834). The
 * `X-Auto-Response-Suppress` value is Microsoft's, and is what Outlook and
 * Exchange actually read.
 */
export const AUTO_REPLY_HEADERS: Record<string, string> = {
  "Auto-Submitted": "auto-replied",
  "X-Auto-Response-Suppress": "All",
};
