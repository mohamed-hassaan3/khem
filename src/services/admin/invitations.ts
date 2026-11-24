import "server-only";

import { clerkClient } from "@clerk/nextjs/server";

/**
 * Customer invitations, as Clerk holds them.
 *
 * Invitations were write-only from the desk: `inviteCustomer` created one and
 * nothing ever read them back, so an admin could not tell whether a letter was
 * still waiting, had been accepted or had lapsed (prompts/admin-redesign-
 * stage-6.md, 6b). Clerk is the record — there is no local table to keep in
 * step — so this reads it directly, server-side, with the secret key.
 *
 * Callers are admin pages behind `requireAdmin()` in the admin layout.
 */

export type InvitationState = "pending" | "accepted" | "revoked" | "expired";

export interface AdminInvitation {
  id: string;
  email: string;
  status: InvitationState;
  createdAt: string;
  /** The letter's language, from the metadata `inviteCustomer` writes. */
  locale: "en" | "ar";
}

const STATES = new Set<InvitationState>(["pending", "accepted", "revoked", "expired"]);

/** The 100 most recent invitations, newest first. Empty if Clerk cannot answer. */
export async function listInvitations(): Promise<{ invitations: AdminInvitation[]; failed: boolean }> {
  try {
    const clerk = await clerkClient();
    const { data } = await clerk.invitations.getInvitationList({
      limit: 100,
      orderBy: "-created_at",
    });

    return {
      failed: false,
      invitations: data.flatMap((invitation) =>
        STATES.has(invitation.status as InvitationState)
          ? [
              {
                id: invitation.id,
                email: invitation.emailAddress.toLowerCase(),
                status: invitation.status as InvitationState,
                createdAt: new Date(invitation.createdAt).toISOString(),
                locale: invitation.publicMetadata?.locale === "ar" ? "ar" : "en",
              },
            ]
          : [],
      ),
    };
  } catch (error) {
    console.error(
      `[admin] listInvitations failed: ${error instanceof Error ? error.message : "unknown"}`,
    );
    return { invitations: [], failed: true };
  }
}
