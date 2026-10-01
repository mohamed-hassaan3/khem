/**
 * Cities the house delivers to, per country.
 *
 * Keyed by ISO-3166 alpha-2 code, the same code the country dropdown uses. A
 * country with no entry here has no city list, and the checkout falls back to a
 * plain text field for it, so adding a country later is one entry in this file.
 *
 * `value` is what reaches `"Order"."shipCity"`: stable English, so a picking
 * slip reads the same whichever language the order was placed in. `ar` is only
 * the label on `/ar/checkout`.
 *
 * This list is the house's to edit. Remove a city to stop offering it; add one
 * to start.
 */

export interface DeliveryCity {
  value: string;
  ar: string;
}

export const DELIVERY_CITIES: Readonly<Record<string, readonly DeliveryCity[]>> = {
  EG: [
    { value: "Cairo", ar: "القاهرة" },
    { value: "New Cairo", ar: "القاهرة الجديدة" },
    { value: "Nasr City", ar: "مدينة نصر" },
    { value: "Heliopolis", ar: "مصر الجديدة" },
    { value: "Maadi", ar: "المعادي" },
    { value: "Giza", ar: "الجيزة" },
    { value: "6th of October", ar: "السادس من أكتوبر" },
    { value: "Sheikh Zayed", ar: "الشيخ زايد" },
    { value: "Shubra El Kheima", ar: "شبرا الخيمة" },
    { value: "Alexandria", ar: "الإسكندرية" },
    { value: "Port Said", ar: "بورسعيد" },
    { value: "Suez", ar: "السويس" },
    { value: "Ismailia", ar: "الإسماعيلية" },
    { value: "Damietta", ar: "دمياط" },
    { value: "Mansoura", ar: "المنصورة" },
    { value: "Zagazig", ar: "الزقازيق" },
    { value: "Tanta", ar: "طنطا" },
    { value: "Banha", ar: "بنها" },
    { value: "Damanhur", ar: "دمنهور" },
    { value: "Kafr El Sheikh", ar: "كفر الشيخ" },
    { value: "Shebin El Kom", ar: "شبين الكوم" },
    { value: "Faiyum", ar: "الفيوم" },
    { value: "Beni Suef", ar: "بني سويف" },
    { value: "Minya", ar: "المنيا" },
    { value: "Asyut", ar: "أسيوط" },
    { value: "Sohag", ar: "سوهاج" },
    { value: "Qena", ar: "قنا" },
    { value: "Luxor", ar: "الأقصر" },
    { value: "Aswan", ar: "أسوان" },
    { value: "Hurghada", ar: "الغردقة" },
    { value: "Sharm El Sheikh", ar: "شرم الشيخ" },
    { value: "Marsa Matrouh", ar: "مرسى مطروح" },
  ],
};
