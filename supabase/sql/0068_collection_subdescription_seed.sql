-- KHEM — initial short card copy for the existing collection rows.
--
-- Keep the long `description` column unchanged: it remains the banner copy.

update public."Collection" as collection
set
  subdescription = copy.subdescription,
  subdescription_ar = copy.subdescription_ar
from (values
  ('signature',
   'A timeless fragrance wardrobe shaped by temple warmth, sacred rituals, and enduring Egyptian heritage.',
   'خزانة عطرية خالدة تشكّلها حرارة المعابد والطقوس المقدّسة والتراث المصري العريق.'),
  ('noir',
   'The house at its darkest: concentrated incense, rare woods, and compositions that refuse to sit quietly.',
   'أشدّ فصول الدار عتمة: بخور مركز وأخشاب نادرة وتركيبات ترفض الهدوء.'),
  ('gemstone',
   'Six mineral fragrances inspired by lapis, turquoise, amber, emerald, sapphire, and opal.',
   'ستة عطور معدنية مستوحاة من اللازورد والفيروز والعنبر والزمرد والياقوت والأوبال.'),
  ('body-mist',
   'Light Gemstone accords for skin and hair, worn alone or layered beneath their matching fragrance.',
   'أنفاس الأحجار الكريمة الخفيفة للبشرة والشعر، تُرتدى وحدها أو تحت عطرها المطابق.'),
  ('room-spray',
   'The KHEM accords released into a room, creating atmosphere without heaviness or excess.',
   'أنفاس كيم في الغرفة، تصنع أجواءً عطرية دون ثقل أو مبالغة.'),
  ('discovery-sets',
   'Explore the KHEM olfactory world through curated vials before choosing your full-size signature.',
   'استكشف عالم كيم الشمّي عبر قوارير منتقاة قبل اختيار عطرك بالحجم الكامل.'),
  ('gift-sets',
   'Full-size fragrances and ritual objects, composed by hand for the art of giving.',
   'عطور بالحجم الكامل وأدوات طقسية، تُنسّق يدويًا لفنّ العطاء.'),
  ('body-cream',
   'A nourishing velvet cream that softens skin and deepens your signature fragrance throughout the day.',
   null)
) as copy(slug, subdescription, subdescription_ar)
where collection.slug = copy.slug;