import { AdminPageHeader } from "@/src/components/admin/AdminTable";
import OrderForm from "@/src/components/admin/OrderForm";
import { isLocale } from "@/src/lib/i18n/config";
import { listAdminProducts } from "@/src/services/admin/catalog";
import { listDeliverySettings } from "@/src/services/admin/settings";

/**
 * Recording a sale that happened at the boutique.
 *
 * The product list is fetched here and handed down: the form is a Client
 * Component, and a client that could query the catalog itself would be a
 * client holding a key. Archived products are filtered out — the database
 * refuses to sell one anyway, and offering it in the dropdown would be an
 * invitation to an error.
 */

export const dynamic = "force-dynamic";

export default async function NewOrderPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  /*
   * Both channels' terms travel with the form for the same reason the products
   * do: the channel select changes which set applies, and a client that could
   * read `"DeliverySetting"` itself would be a client holding a key. Two rows is
   * a smaller payload than one round trip.
   */
  const delivery = await listDeliverySettings();

  const products = (await listAdminProducts())
    .filter((product) => !product.isArchived)
    .map((product) => ({
      slug: product.slug,
      name: product.name,
      priceInCents: product.priceInCents,
      inventory: product.inventory,
    }));

  return (
    <>
      <AdminPageHeader
        title="Record order"
        description="For a sale taken at the counter or over the phone. Prices come from the catalog, not from this form, and the stock comes off the website's inventory the moment it saves."
      />

      <OrderForm
        locale={activeLocale}
        products={products}
        deliveryTerms={delivery}
      />
    </>
  );
}
