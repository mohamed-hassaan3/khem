-- KHEM — make the complete /collections overview editable from the dashboard.

alter table public."MerchPage"
  drop constraint if exists merch_page_known_slug;

alter table public."MerchPage"
  add constraint merch_page_known_slug
  check (slug in ('best-sellers', 'all-collections'));

insert into public."MerchPage"
  (slug, name, description, "bannerUrl", "bannerAlt", name_ar, description_ar, "bannerAlt_ar")
values (
  'all-collections',
  'Collections',
  'The complete KHEM catalogue — every fragrance, body care piece, home scent, discovery set, and gift set in one place.',
  'https://images.unsplash.com/photo-1738664926458-d8ca7f56549f?w=1800&h=900&fit=crop&auto=format',
  'Black marble lit from one side, veined with pale gold',
  'المجموعات',
  'كتالوج كيم الكامل — كل العطور والعناية بالجسم وعطور المنزل وأطقم الاكتشاف والهدايا في مكان واحد.',
  'رخام أسود يضيئه ضوء جانبي، تتخلله عروق ذهبية شاحبة'
)
on conflict (slug) do nothing;