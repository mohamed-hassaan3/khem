import { createClient } from "@supabase/supabase-js";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
const SLUG = "amber-body-mist";
const R = "Verification — sold-out rule";
async function main() {
  // 20 on the offline shelf, nothing the website may sell.
  await db.rpc("set_channel_stock", { p_slug: SLUG, p_channel: "OFFLINE", p_quantity: 20, p_reason: R, p_actor: "verify" });
  await db.rpc("set_channel_stock", { p_slug: SLUG, p_channel: "ONLINE",  p_quantity: 0,  p_reason: R, p_actor: "verify" });
  const { data } = await db.from("Product").select("inventory,inventoryOnline,inventoryOffline").eq("slug", SLUG).single();
  console.log("staged:", JSON.stringify(data));
}
main();
