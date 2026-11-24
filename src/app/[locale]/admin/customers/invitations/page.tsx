import { AdminNotice } from "@/src/components/admin/fields";
import { AdminPageHeader } from "@/src/components/admin/AdminTable";
import InvitationList from "@/src/components/admin/InvitationList";
import InviteCustomerForm from "@/src/components/admin/InviteCustomerForm";
import { listAllAdminCustomers } from "@/src/services/admin/customers";
import { listInvitations } from "@/src/services/admin/invitations";
import { requireAdmin } from "@/src/lib/admin/auth";

/**
 * Invitations — who the house has invited, and what became of each letter.
 *
 * Read from Clerk on every request (`listInvitations`): Clerk is the record of
 * an invitation, so there is nothing local to fall out of step. The gate is
 * `requireAdmin()` in the admin layout; the actions call it again.
 * (prompts/admin-redesign-stage-6.md, 6b)
 */
export const dynamic = "force-dynamic";

export default async function InvitationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // The layout's gate does not cover a page on client navigation — see requireAdmin().
  await requireAdmin();

  const [query, { invitations, failed }, customers] = await Promise.all([
    searchParams,
    listInvitations(),
    listAllAdminCustomers(),
  ]);

  // An invitation still waiting for someone who already has an account (they
  // signed up on their own) can never be accepted; the list says so.
  const registered = customers.flatMap((customer) =>
    customer.hasAccount && customer.email ? [customer.email.toLowerCase()] : [],
  );

  // A walk-in's "Invite" link pre-fills the address; anything else is ignored.
  const raw = Array.isArray(query.email) ? query.email[0] : query.email;
  const initialEmail = typeof raw === "string" && raw.length <= 200 && raw.includes("@") ? raw : "";

  return (
    <>
      <AdminPageHeader
        title="Invitations"
        description="Invite someone to open an account. When they accept, they appear under Customers as Registered and receive the welcome letter."
      />

      <InviteCustomerForm initialEmail={initialEmail} />

      <h2 className="mb-2.5 font-heading text-[16px] font-normal text-ground">Sent</h2>
      {failed ? (
        <AdminNotice tone="error">Clerk could not be reached, so the list is unavailable. Try again shortly.</AdminNotice>
      ) : (
        <InvitationList invitations={invitations} registered={registered} />
      )}
    </>
  );
}
