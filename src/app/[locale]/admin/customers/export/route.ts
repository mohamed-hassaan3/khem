import { getAdminActor } from "@/src/lib/admin/auth";
import { listAllAdminCustomers } from "@/src/services/admin/customers";

/**
 * Every customer as a CSV — name, email, phone, account, orders, spend, joined.
 * (prompts/admin-redesign-stage-6.md, 6b)
 *
 * A route handler is not wrapped by `admin/layout.tsx`, so it gates itself:
 * the same `getAdminActor()` check, and the same answer for anyone else — 404,
 * so the address is never confirmed to exist (AGENTS §10.1).
 *
 * Never cached: the file is personal data and is built per request.
 */
export const dynamic = "force-dynamic";

/**
 * One CSV cell. Quoted always; a leading `=`, `+`, `-`, `@`, tab or CR is
 * prefixed with `'` so a spreadsheet does not evaluate a customer-typed name
 * as a formula (CSV injection).
 */
function cell(value: string | number | null): string {
  const text = value === null ? "" : String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET(): Promise<Response> {
  const actor = await getAdminActor();
  if (!actor) return new Response("Not found", { status: 404 });

  const customers = await listAllAdminCustomers("", 10000);

  const header = ["Name", "Email", "Phone", "Account", "Subscribed", "Orders", "Lifetime spend (EGP)", "Joined"];
  const rows = customers.map((customer) =>
    [
      customer.name,
      customer.email,
      customer.phone,
      customer.hasAccount ? "Registered" : "Walk-in",
      customer.marketingOptIn ? "Yes" : "No",
      customer.orderCount,
      (customer.lifetimeSpendInCents / 100).toFixed(2),
      customer.joinedAt ? customer.joinedAt.slice(0, 10) : null,
    ]
      .map(cell)
      .join(","),
  );

  console.info(`[admin] customers exported (${customers.length}) by ${actor.email}`);

  const date = new Date().toISOString().slice(0, 10);
  // BOM first, so Excel reads Arabic names as UTF-8.
  const body = `﻿${[header.map(cell).join(","), ...rows].join("\r\n")}\r\n`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="khem-customers-${date}.csv"`,
      "Cache-Control": "no-store, private",
    },
  });
}
